// =====================================================================
// Statut du module d'analyse Streamlit : indique s'il répond sur son port.
// Utilisé par la page Analytics pour afficher (ou non) le bouton « Démarrer ».
// =====================================================================
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/guard'

export const dynamic = 'force-dynamic'

const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL || 'http://localhost:8501'

async function ping(url: string, timeoutMs = 1500): Promise<boolean> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // Endpoint de santé natif de Streamlit ; on retombe sur la racine sinon.
    const res = await fetch(`${url}/_stcore/health`, { signal: controller.signal, cache: 'no-store' })
    return res.ok
  } catch {
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      return res.ok || res.status > 0
    } catch {
      return false
    }
  } finally {
    clearTimeout(t)
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const running = await ping(ANALYTICS_URL)
  return NextResponse.json({ running, url: ANALYTICS_URL })
}
