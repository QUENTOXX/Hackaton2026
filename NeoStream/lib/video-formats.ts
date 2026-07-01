// =====================================================================
// Formats vidéo autorisés (partagé entre le listing et l'upload).
// Sert de whitelist de sécurité : seules ces extensions sont acceptées.
// =====================================================================

/** Extensions vidéo acceptées (upload + listing). */
export const VIDEO_EXT = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi'] as const

/** Types MIME vidéo tolérés (certains navigateurs envoient un type vide/générique). */
export const VIDEO_MIME_PREFIX = 'video/'
export const TOLERATED_EMPTY_MIME = ['', 'application/octet-stream']

/** Taille maximale d'un upload (512 Mo) — garde-fou mémoire/disque. */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

/** Formats lus nativement par la plupart des navigateurs (info UI). */
export const BROWSER_FRIENDLY_EXT = ['.mp4', '.webm', '.ogg', '.ogv', '.m4v', '.mov']

export function extname(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i).toLowerCase() : ''
}

export function isAllowedVideoExt(filename: string): boolean {
  return (VIDEO_EXT as readonly string[]).includes(extname(filename))
}

/**
 * Assainit un nom de fichier pour l'écriture disque :
 *  - ne garde que le nom de base (anti path-traversal : pas de / \ ..)
 *  - remplace tout caractère non sûr par « _ »
 *  - borne la longueur
 * Retourne null si l'extension n'est pas autorisée.
 */
export function sanitizeVideoFilename(rawName: string): string | null {
  // Retire tout composant de chemin (garde uniquement le dernier segment).
  const base = rawName.replace(/^.*[\\/]/, '').trim()
  const ext = extname(base)
  if (!(VIDEO_EXT as readonly string[]).includes(ext)) return null

  const stem = base.slice(0, base.length - ext.length)
  const safeStem = stem
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_ ]/g, '') // caractères sûrs uniquement
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 80)

  const finalStem = safeStem || 'video'
  return `${finalStem}${ext}`
}
