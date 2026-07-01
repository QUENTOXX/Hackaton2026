// =====================================================================
// Liste blanche d'IP (côté routes Next / TypeScript).
// Une IP de confiance (poste de démo, IP bureau…) est exemptée du
// verrouillage anti-brute-force ET du pare-feu applicatif.
// =====================================================================
import { prisma } from '@/lib/db'
import { isPrivateIp } from '@/lib/ip-utils'

// Vrai si l'IP doit être exemptée (locale/privée OU présente en liste blanche).
export async function isExemptIp(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return true // loopback / réseaux privés = confiance
  try {
    const found = await prisma.allowedIP.findUnique({ where: { ipAddress: ip } })
    return !!found
  } catch {
    return false
  }
}
