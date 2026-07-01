// =====================================================================
// Fonctions partagées pour la sécurité :
//  - enregistrement des événements dans le journal (SecurityLog)
//  - libellés en français des types de menaces
// =====================================================================
import { prisma } from '@/lib/db'

export type ThreatType =
  | 'SIMULTANEOUS_LOGIN'
  | 'VPN_PROXY'
  | 'SCREENSHOT_ATTEMPT'
  | 'BLOCKED_IP'
  | 'LOGIN'
  | 'INFO'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

// Libellés lisibles (affichés dans l'interface)
export const THREAT_LABELS: Record<string, string> = {
  SIMULTANEOUS_LOGIN: 'Connexion simultanée',
  VPN_PROXY: 'VPN / Proxy',
  SCREENSHOT_ATTEMPT: "Capture d'écran",
  BLOCKED_IP: 'IP bloquée',
  LOGIN: 'Connexion',
  INFO: 'Information',
}

export const SEVERITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
}

// Enregistre un événement de sécurité dans la base de données.
export async function logSecurityEvent(params: {
  type: ThreatType
  severity: Severity
  message: string
  ipAddress?: string | null
  location?: string | null
  userId?: string | null
  metadata?: any
}) {
  try {
    return await prisma.securityLog.create({
      data: {
        type: params.type,
        severity: params.severity,
        message: params.message,
        ipAddress: params.ipAddress ?? null,
        location: params.location ?? null,
        userId: params.userId ?? null,
        metadata: params.metadata ?? undefined,
      },
    })
  } catch (e) {
    // On ne fait jamais planter l'app à cause du journal
    return null
  }
}
