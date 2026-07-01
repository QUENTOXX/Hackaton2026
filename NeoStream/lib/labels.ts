// Constantes partagées côté client (libellés français + couleurs des menaces).
// Ce fichier n'importe PAS prisma : il peut être utilisé dans les composants client.
import {
  ShieldAlert, Wifi, Camera, Ban, LogIn, Info,
  Radio, LogOut, PowerOff, Crown, Gauge, type LucideIcon,
} from 'lucide-react'

export const THREAT_LABELS: Record<string, string> = {
  SIMULTANEOUS_LOGIN: 'Connexion simultanée',
  VPN_PROXY: 'VPN / Proxy',
  SCREENSHOT_ATTEMPT: "Capture d'écran",
  BLOCKED_IP: 'IP bloquée',
  RATE_LIMIT: 'Rate-limit (pare-feu)',
  LOGIN: 'Connexion',
  INFO: 'Information',
  // --- Watch Together (événements de salle) ---
  WATCH: 'Watch Together',
  ROOM_CREATED: 'Salle créée',
  ROOM_JOIN: 'Entrée en salle',
  ROOM_LEAVE: 'Sortie de salle',
  ROOM_ENDED: 'Salle terminée',
  ROOM_HOST_CHANGED: 'Changement de présentateur',
}

export const THREAT_ICONS: Record<string, LucideIcon> = {
  SIMULTANEOUS_LOGIN: ShieldAlert,
  VPN_PROXY: Wifi,
  SCREENSHOT_ATTEMPT: Camera,
  BLOCKED_IP: Ban,
  RATE_LIMIT: Gauge,
  LOGIN: LogIn,
  INFO: Info,
  // --- Watch Together ---
  WATCH: Radio,
  ROOM_CREATED: Radio,
  ROOM_JOIN: LogIn,
  ROOM_LEAVE: LogOut,
  ROOM_ENDED: PowerOff,
  ROOM_HOST_CHANGED: Crown,
}

export const SEVERITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
}

// Classes Tailwind par niveau de gravité (texte + fond)
export const SEVERITY_STYLES: Record<string, string> = {
  low: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  high: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
}

export function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Paris',
    })
  } catch {
    return iso
  }
}
