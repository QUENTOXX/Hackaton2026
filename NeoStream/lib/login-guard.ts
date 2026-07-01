// =====================================================================
// Protection anti-brute-force du login (compteurs EN MÉMOIRE).
//
// Choix assumé : stockage en RAM (remis à zéro au redémarrage) -> simple,
// sans table dédiée, et sans risque de rester bloqué après la démo.
// On compte les échecs par couple (email + IP) sur une fenêtre glissante ;
// au-delà d'un seuil, le compte est verrouillé temporairement. Un acharnement
// depuis une IP publique déclenche un auto-blocage réseau (voir auto-block).
// =====================================================================
import { autoBlockIp } from '@/lib/auto-block'
import { logSecurityEvent } from '@/lib/security'

const FAIL_WINDOW_MS = 10 * 60_000 // fenêtre d'observation des échecs (10 min)
const LOCK_THRESHOLD = 5 // nb d'échecs avant verrouillage
const LOCK_MS = 15 * 60_000 // durée du verrouillage (15 min)
const AUTO_BLOCK_THRESHOLD = 10 // acharnement -> auto-blocage de l'IP publique

interface Entry {
  count: number
  firstAt: number
  lockedUntil: number
  logged: boolean // évite de spammer le journal
}

const attempts = new Map<string, Entry>() // clé "email|ip"

function keyOf(email: string, ip: string) {
  return `${(email || '').toLowerCase()}|${ip || 'inconnue'}`
}

// Le compte/IP est-il actuellement verrouillé ? -> temps restant en ms (0 sinon).
export function lockRemainingMs(email: string, ip: string): number {
  const e = attempts.get(keyOf(email, ip))
  if (!e) return 0
  const now = Date.now()
  return e.lockedUntil > now ? e.lockedUntil - now : 0
}

// L'email est-il verrouillé depuis AU MOINS une IP ? (pour l'affichage admin)
export function isEmailLocked(email: string): boolean {
  const prefix = `${(email || '').toLowerCase()}|`
  const now = Date.now()
  for (const [key, e] of attempts) {
    if (key.startsWith(prefix) && e.lockedUntil > now) return true
  }
  return false
}

// Déverrouillage manuel par un admin : efface tous les compteurs de cet email.
export function clearUserLockout(email: string): number {
  const prefix = `${(email || '').toLowerCase()}|`
  let n = 0
  for (const key of Array.from(attempts.keys())) {
    if (key.startsWith(prefix)) {
      attempts.delete(key)
      n++
    }
  }
  return n
}

// Enregistre un échec de connexion et applique la politique (verrou + auto-block).
export async function registerFailedLogin(email: string, ip: string): Promise<void> {
  const key = keyOf(email, ip)
  const now = Date.now()
  let e = attempts.get(key)

  // Réinitialise le compteur si la fenêtre est dépassée.
  if (!e || now - e.firstAt > FAIL_WINDOW_MS) {
    e = { count: 0, firstAt: now, lockedUntil: 0, logged: false }
    attempts.set(key, e)
  }

  e.count++

  if (e.count >= LOCK_THRESHOLD && !e.logged) {
    e.lockedUntil = now + LOCK_MS
    e.logged = true
    await logSecurityEvent({
      type: 'BRUTE_FORCE',
      severity: 'high',
      message: `Brute-force détecté : ${e.count} échecs de connexion pour ${email} depuis ${ip} — compte verrouillé ${LOCK_MS / 60000} min`,
      ipAddress: ip,
      metadata: { email, failCount: e.count },
    })
  } else if (e.count >= LOCK_THRESHOLD) {
    // Prolonge le verrou tant que l'attaque continue.
    e.lockedUntil = now + LOCK_MS
  }

  // Acharnement soutenu -> auto-blocage réseau de l'IP (publique uniquement).
  if (e.count >= AUTO_BLOCK_THRESHOLD) {
    await autoBlockIp(ip, `Brute-force login (${e.count} échecs sur ${email})`)
  }
}

// Connexion réussie -> on efface le compteur.
export function clearFailedLogin(email: string, ip: string): void {
  attempts.delete(keyOf(email, ip))
}

// Extraction d'IP depuis l'objet `req` fourni par NextAuth à authorize().
export function ipFromNextAuthReq(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | string[]> })?.headers || {}
  const xff = headers['x-forwarded-for']
  if (xff) return String(Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim()
  const xr = headers['x-real-ip']
  if (xr) return String(Array.isArray(xr) ? xr[0] : xr).trim()
  return 'inconnue'
}
