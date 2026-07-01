// Interface commune à tous les lecteurs (HLS/MP4 et YouTube).
// Permet à RoomClient de piloter n'importe quel lecteur de la même façon.
export interface PlayerHandle {
  applyPlay: (positionSec: number) => void
  applyPause: (positionSec: number) => void
  applySeek: (positionSec: number) => void
  getTime: () => number
}

/** Extrait l'identifiant d'une vidéo YouTube depuis une URL, sinon null. */
export function getYouTubeId(url: string): string | null {
  if (!url) return null
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}
