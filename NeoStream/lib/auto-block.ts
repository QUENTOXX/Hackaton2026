// =====================================================================
// Auto-blocage d'IP (réponse automatique aux menaces).
// Transforme une détection en contre-mesure : une IP publique jugée
// hostile est ajoutée à la liste noire (BlockedIP, blockedBy = 'auto'),
// que le pare-feu applicatif (server/firewall.js) fera respecter.
//
// GARDE-FOU : on ne bloque JAMAIS une IP locale/privée -> impossible de se
// verrouiller soi-même pendant la démo (le loopback n'est de toute façon
// pas filtré par le pare-feu).
// =====================================================================
import { prisma } from '@/lib/db'
import { isPrivateIp } from '@/lib/ip-utils'
import { logSecurityEvent } from '@/lib/security'

export async function autoBlockIp(ip: string, reason: string): Promise<boolean> {
  if (!ip || isPrivateIp(ip)) return false // jamais d'auto-blocage en local
  try {
    await prisma.blockedIP.upsert({
      where: { ipAddress: ip },
      update: { reason, blockedBy: 'auto' },
      create: { ipAddress: ip, reason, blockedBy: 'auto' },
    })
    await logSecurityEvent({
      type: 'BLOCKED_IP',
      severity: 'critical',
      message: `Auto-blocage : ${ip} ajoutée à la liste noire (${reason})`,
      ipAddress: ip,
      metadata: { auto: true, reason },
    })
    return true
  } catch {
    return false
  }
}
