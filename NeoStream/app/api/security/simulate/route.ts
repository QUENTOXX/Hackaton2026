// =====================================================================
// Simulateur de menaces (pour la démonstration).
// Permet à l'administrateur de générer des événements de test
// sans avoir besoin de plusieurs vrais appareils.
//
// Chaque événement produit ici est marqué `metadata.simulated = true` :
// il apparaît avec un badge « Démo » dans le journal, se distingue des
// vraies détections (« Réel »), et est PRÉSERVÉ lors de la purge des logs.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { checkIpReputation } from '@/lib/ip-utils'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Quelques IP réalistes pour la démo (avec coordonnées -> carte des menaces)
const DEMO_IPS = [
  { ip: '185.220.101.1', loc: 'Berlin, Allemagne', lat: 52.52, lon: 13.4 }, // nœud Tor connu
  { ip: '45.83.91.10', loc: 'Amsterdam, Pays-Bas', lat: 52.37, lon: 4.9 },
  { ip: '104.16.0.1', loc: 'San Francisco, États-Unis', lat: 37.77, lon: -122.42 },
  { ip: '51.158.1.1', loc: 'Paris, France', lat: 48.85, lon: 2.35 },
]

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const scenario = (body?.scenario ?? '').toString()

  // On rattache les sessions simulées à un utilisateur "démo"
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo.utilisateur@sentinel.fr' },
    update: {},
    create: {
      email: 'demo.utilisateur@sentinel.fr',
      name: 'Utilisateur Démo',
      password: 'x', // jamais utilisé pour se connecter
      role: 'user',
    },
  })

  if (scenario === 'simultaneous') {
    // Crée deux sessions actives depuis deux pays différents
    const a = DEMO_IPS[0]
    const b = DEMO_IPS[2]
    for (const s of [a, b]) {
      await prisma.userSession.create({
        data: {
          userId: demoUser.id,
          ipAddress: s.ip,
          location: s.loc,
          latitude: s.lat,
          longitude: s.lon,
          device: 'Ordinateur (Chrome)',
          isActive: true,
          isFlagged: true,
        },
      })
    }
    await logSecurityEvent({
      type: 'SIMULTANEOUS_LOGIN',
      severity: 'high',
      message: `Connexions simultanées anormales pour ${demoUser.email} (${a.loc} et ${b.loc})`,
      ipAddress: a.ip,
      location: a.loc,
      userId: demoUser.id,
      metadata: { simulated: true, ips: [a.ip, b.ip] },
    })
    return NextResponse.json({ success: true, message: 'Connexions simultanées simulées.' })
  }

  if (scenario === 'vpn') {
    const s = DEMO_IPS[1]
    const rep = await checkIpReputation(s.ip)
    await prisma.userSession.create({
      data: {
        userId: demoUser.id,
        ipAddress: s.ip,
        location: rep.location || s.loc,
        latitude: rep.lat ?? s.lat,
        longitude: rep.lon ?? s.lon,
        device: 'Ordinateur (Firefox)',
        isActive: true,
        isFlagged: true,
      },
    })
    await logSecurityEvent({
      type: 'VPN_PROXY',
      severity: 'high',
      message: `VPN/Proxy détecté pour ${demoUser.email} (${rep.reason})`,
      ipAddress: s.ip,
      location: rep.location || s.loc,
      userId: demoUser.id,
      metadata: { simulated: true, proxy: rep.proxy, hosting: rep.hosting, isp: rep.isp },
    })
    return NextResponse.json({ success: true, message: 'Connexion VPN/Proxy simulée.' })
  }

  if (scenario === 'screenshot') {
    await logSecurityEvent({
      type: 'SCREENSHOT_ATTEMPT',
      severity: 'medium',
      message: `Tentative de capture d'écran détectée (touche Impr. écran) — ${demoUser.email}`,
      ipAddress: DEMO_IPS[3].ip,
      location: DEMO_IPS[3].loc,
      userId: demoUser.id,
      metadata: { simulated: true, method: 'PrintScreen' },
    })
    return NextResponse.json({ success: true, message: "Tentative de capture d'écran simulée." })
  }

  if (scenario === 'blocked') {
    const s = DEMO_IPS[0]
    await prisma.blockedIP.upsert({
      where: { ipAddress: s.ip },
      update: { reason: 'Nœud Tor / activité malveillante', blockedBy: 'auto' },
      create: { ipAddress: s.ip, reason: 'Nœud Tor / activité malveillante', blockedBy: 'auto' },
    })
    await logSecurityEvent({
      type: 'BLOCKED_IP',
      severity: 'critical',
      message: `Tentative d'accès depuis une IP bloquée (${s.ip})`,
      ipAddress: s.ip,
      location: s.loc,
      userId: demoUser.id,
      metadata: { simulated: true },
    })
    return NextResponse.json({ success: true, message: 'Accès depuis une IP bloquée simulé.' })
  }

  return NextResponse.json({ error: 'Scénario inconnu.' }, { status: 400 })
}
