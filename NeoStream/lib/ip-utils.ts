// =====================================================================
// Utilitaires pour la détection IP (géolocalisation + réputation VPN/Proxy)
// On utilise l'API gratuite ip-api.com (aucune clé requise).
// =====================================================================
import { NextRequest } from 'next/server'

// Récupère l'adresse IP du visiteur à partir des en-têtes de la requête.
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // Le premier élément est l'IP réelle du client
    return forwarded.split(',')[0]?.trim() ?? 'inconnue'
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'inconnue'
}

// Indique si une IP est privée / locale (donc non analysable par ip-api).
export function isPrivateIp(ip: string): boolean {
  if (!ip || ip === 'inconnue') return true
  if (ip === '::1' || ip.startsWith('127.') || ip === 'localhost') return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1] ?? '0', 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export interface IpReputation {
  ip: string
  country: string
  city: string
  location: string
  lat: number | null  // coordonnées (pour le geo-velocity)
  lon: number | null
  isp: string
  org: string
  proxy: boolean      // VPN / proxy détecté
  hosting: boolean    // hébergeur / datacenter (souvent un VPN)
  mobile: boolean
  isSuspicious: boolean
  reason: string
}

// Distance en km entre deux points géographiques (formule de haversine).
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // rayon terrestre (km)
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Interroge ip-api.com pour obtenir la réputation et la géolocalisation d'une IP.
// Si l'IP est privée/locale, on interroge l'IP publique du serveur (utile en local).
export async function checkIpReputation(ip: string): Promise<IpReputation> {
  const fields =
    'status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,mobile,proxy,hosting,query'

  // En local, ip-api ne peut pas analyser une IP privée -> on teste l'IP publique sortante
  const target = isPrivateIp(ip) ? '' : ip

  try {
    const res = await fetch(`http://ip-api.com/json/${target}?fields=${fields}`, {
      cache: 'no-store',
    })
    const data: any = await res.json().catch(() => ({}))

    if (data?.status !== 'success') {
      return {
        ip,
        country: 'Inconnu',
        city: 'Inconnu',
        location: 'Localisation inconnue',
        lat: null,
        lon: null,
        isp: 'Inconnu',
        org: '',
        proxy: false,
        hosting: false,
        mobile: false,
        isSuspicious: false,
        reason: "Impossible d'analyser cette IP",
      }
    }

    const proxy = Boolean(data?.proxy)
    const hosting = Boolean(data?.hosting)
    const isSuspicious = proxy || hosting
    const reasons: string[] = []
    if (proxy) reasons.push('VPN / Proxy détecté')
    if (hosting) reasons.push('IP de datacenter / hébergeur')

    return {
      ip: data?.query ?? ip,
      country: data?.country ?? 'Inconnu',
      city: data?.city ?? 'Inconnu',
      location: `${data?.city ?? 'Inconnu'}, ${data?.country ?? 'Inconnu'}`,
      lat: typeof data?.lat === 'number' ? data.lat : null,
      lon: typeof data?.lon === 'number' ? data.lon : null,
      isp: data?.isp ?? 'Inconnu',
      org: data?.org ?? '',
      proxy,
      hosting,
      mobile: Boolean(data?.mobile),
      isSuspicious,
      reason: reasons.length ? reasons.join(' · ') : 'Connexion normale',
    }
  } catch (e) {
    // En cas d'erreur réseau, on renvoie un résultat neutre (pas de plantage)
    return {
      ip,
      country: 'Inconnu',
      city: 'Inconnu',
      location: 'Localisation inconnue',
      lat: null,
      lon: null,
      isp: 'Inconnu',
      org: '',
      proxy: false,
      hosting: false,
      mobile: false,
      isSuspicious: false,
      reason: "Erreur lors de l'analyse de l'IP",
    }
  }
}

// Déduit un type d'appareil simple à partir du User-Agent.
export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Inconnu'
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone'))
    return 'Mobile'
  if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablette'
  let browser = 'Navigateur'
  if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari')) browser = 'Safari'
  return `Ordinateur (${browser})`
}
