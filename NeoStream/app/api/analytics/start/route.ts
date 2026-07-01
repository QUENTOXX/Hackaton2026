// =====================================================================
// Démarre le module d'analyse Streamlit (video_analytics) en tâche de fond.
// Réservé à l'administrateur. Sécurité : commande FIXE (aucune entrée
// utilisateur), on lance uniquement `streamlit run app.py` dans le dossier
// du module. Détecte automatiquement un venv (Windows/POSIX), sinon retombe
// sur le python/streamlit du PATH.
// =====================================================================
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL || 'http://localhost:8501'
const PORT = (() => {
  try {
    return new URL(ANALYTICS_URL).port || '8501'
  } catch {
    return '8501'
  }
})()

async function isRunning(): Promise<boolean> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 1200)
  try {
    const res = await fetch(`${ANALYTICS_URL}/_stcore/health`, { signal: controller.signal, cache: 'no-store' })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  if (await isRunning()) {
    return NextResponse.json({ ok: true, already: true, message: 'Le module est déjà démarré.' })
  }

  // Le module vit à la racine du dépôt, à côté de NeoStream/.
  const moduleDir = path.resolve(process.cwd(), '..', 'video_analytics')
  if (!existsSync(path.join(moduleDir, 'app.py'))) {
    return NextResponse.json(
      { ok: false, error: `Module introuvable (${moduleDir}). Vérifiez le dossier video_analytics/.` },
      { status: 404 },
    )
  }

  const isWin = process.platform === 'win32'
  const venvPython = isWin
    ? path.join(moduleDir, 'venv', 'Scripts', 'python.exe')
    : path.join(moduleDir, 'venv', 'bin', 'python')

  // On préfère le python du venv s'il existe ; sinon celui du PATH (via shell).
  const hasVenv = existsSync(venvPython)
  const cmd = hasVenv ? venvPython : isWin ? 'python' : 'python3'
  const args = [
    '-m', 'streamlit', 'run', 'app.py',
    '--server.port', PORT,
    '--server.headless', 'true',
    '--browser.gatherUsageStats', 'false',
  ]

  try {
    const child = spawn(cmd, args, {
      cwd: moduleDir,
      detached: true,       // survit à la requête (process indépendant)
      stdio: 'ignore',
      shell: !hasVenv,      // shell requis pour résoudre `python` du PATH sous Windows
      windowsHide: true,
    })

    let earlyError: string | null = null
    child.on('error', (e) => {
      earlyError = e.message
      console.error('[analytics] start', e.message)
    })
    child.unref()

    // Laisse une fenêtre courte pour capter une erreur immédiate (ENOENT…).
    await new Promise((r) => setTimeout(r, 400))
    if (earlyError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Impossible de lancer Streamlit. Vérifiez que les dépendances sont installées " +
            '(pip install -r requirements.txt) et que Python est accessible.',
          detail: earlyError,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Démarrage du module en cours…',
      via: hasVenv ? 'venv' : 'python (PATH)',
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'Échec du démarrage du module.', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
