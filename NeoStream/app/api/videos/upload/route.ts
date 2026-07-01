// =====================================================================
// Upload d'une vidéo locale (déposée dans public/videos) — utilisateur
// authentifié. Sécurité :
//   - whitelist d'extensions vidéo (lib/video-formats)
//   - vérification du type MIME (video/* ou vide/générique toléré)
//   - taille maximale (MAX_UPLOAD_BYTES)
//   - nom de fichier assaini (anti path-traversal) + anti-collision
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, access } from 'fs/promises'
import path from 'path'
import { getSessionUser } from '@/lib/guard'
import {
  MAX_UPLOAD_BYTES,
  VIDEO_MIME_PREFIX,
  TOLERATED_EMPTY_MIME,
  isAllowedVideoExt,
  sanitizeVideoFilename,
  extname,
} from '@/lib/video-formats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function uniquePath(dir: string, filename: string): Promise<string> {
  const ext = extname(filename)
  const stem = filename.slice(0, filename.length - ext.length)
  let candidate = filename
  let n = 1
  // Tant que le fichier existe, on suffixe -1, -2, … (jamais d'écrasement).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await access(path.join(dir, candidate))
      candidate = `${stem}-${n++}${ext}`
    } catch {
      return candidate // n'existe pas -> disponible
    }
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Requête invalide (multipart attendu).' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
  }

  // 1) Extension autorisée ?
  if (!isAllowedVideoExt(file.name)) {
    return NextResponse.json(
      { error: `Extension non autorisée. Formats acceptés : mp4, mov, mkv, webm, ogg, m4v, avi.` },
      { status: 415 },
    )
  }

  // 2) Type MIME cohérent (on tolère un type vide/générique que certains
  //    navigateurs envoient, mais on refuse un type non-vidéo explicite).
  const mime = (file.type || '').toLowerCase()
  if (mime && !mime.startsWith(VIDEO_MIME_PREFIX) && !TOLERATED_EMPTY_MIME.includes(mime)) {
    return NextResponse.json(
      { error: `Type de fichier invalide (${mime}). Une vidéo est attendue.` },
      { status: 415 },
    )
  }

  // 3) Taille bornée.
  if (file.size <= 0) {
    return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
    return NextResponse.json({ error: `Fichier trop volumineux (max ${mb} Mo).` }, { status: 413 })
  }

  // 4) Nom assaini (anti path-traversal).
  const safeName = sanitizeVideoFilename(file.name)
  if (!safeName) {
    return NextResponse.json({ error: 'Nom de fichier invalide.' }, { status: 400 })
  }

  try {
    const dir = path.join(process.cwd(), 'public', 'videos')
    await mkdir(dir, { recursive: true })
    const finalName = await uniquePath(dir, safeName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, finalName), buffer)

    return NextResponse.json({
      ok: true,
      file: finalName,
      src: `/videos/${encodeURIComponent(finalName)}`,
      label: finalName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    })
  } catch (e) {
    console.error('[videos] upload', e)
    return NextResponse.json({ error: "Échec de l'enregistrement du fichier." }, { status: 500 })
  }
}
