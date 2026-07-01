// =====================================================================
// Hygiène des sessions : expiration automatique des connexions inactives.
// Une UserSession active dont le dernier signe de vie (lastSeen) dépasse le
// TTL est passée à isActive = false. Cela fiabilise la détection de
// connexions simultanées (on ne compte plus des sessions fantômes) et le
// compteur de connexions actives du dashboard.
//
// Appelé de façon paresseuse (lazy) au début des routes qui lisent les
// sessions -> pas besoin de tâche planifiée.
// =====================================================================
import { prisma } from '@/lib/db'

export const SESSION_TTL_MS = 30 * 60_000 // 30 min d'inactivité

export async function expireStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS)
  try {
    const res = await prisma.userSession.updateMany({
      where: { isActive: true, lastSeen: { lt: cutoff } },
      data: { isActive: false },
    })
    return res.count
  } catch {
    return 0
  }
}
