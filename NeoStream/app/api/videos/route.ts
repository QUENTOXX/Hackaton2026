// =====================================================================
// Liste les vidéos disponibles en local (dossier public/videos).
// Sert à peupler le sélecteur de source à la création d'une salle.
// =====================================================================
import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'
import { getSessionUser } from '@/lib/guard'
import { VIDEO_EXT } from '@/lib/video-formats'

// On liste aussi les playlists HLS locales éventuelles (.m3u8) en plus des fichiers vidéo.
const LISTABLE_EXT = [...VIDEO_EXT, '.m3u8']

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const dir = path.join(process.cwd(), 'public', 'videos')
  let files: string[] = []
  try {
    files = await readdir(dir)
  } catch {
    // dossier absent -> aucune vidéo locale
    return NextResponse.json({ videos: [] })
  }

  const videos = files
    .filter((f) => LISTABLE_EXT.includes(path.extname(f).toLowerCase()))
    .map((f) => ({
      file: f,
      label: f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      src: `/videos/${encodeURIComponent(f)}`,
    }))

  return NextResponse.json({ videos })
}
