// =====================================================================
// Enregistre la session de connexion d'un utilisateur et lance
// les détections : IP bloquée, VPN/Proxy, connexions simultanées.
// Appelé par la page protégée côté utilisateur.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/guard'
import { checkIpReputation, getClientIp, parseDevice, isPrivateIp, haversineKm } from '@/lib/ip-utils'
import { logSecurityEvent } from '@/lib/security'
import { expireStaleSessions } from '@/lib/session-hygiene'

export const dynamic = 'force-dynamic'

// Seuils du geo-velocity (voyage impossible).
const GEO_MIN_KM = 100 // en-deçà, on ignore (marge d'imprécision de la géoloc IP)
const GEO_MAX_KMH = 900 // au-delà de ~900 km/h entre deux sessions actives = impossible

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Hygiène : on expire les sessions inactives avant toute analyse.
  await expireStaleSessions()

  const body = await req.json().catch(() => ({}))
  // En démo, l'utilisateur peut simuler une IP / localisation différente
  const simulatedIp = (body?.simulatedIp ?? '').toString().trim()
  const ip = simulatedIp || getClientIp(req)
  const userAgent = req.headers.get('user-agent')
  const device = parseDevice(userAgent)

  // 1) Réputation de l'IP (VPN / Proxy / datacenter)
  const reputation = await checkIpReputation(ip)
  const location = body?.simulatedLocation?.toString().trim() || reputation.location
  const alerts: { type: string; severity: string; message: string }[] = []

  // 2) L'IP est-elle bloquée ?
  const blocked = await prisma.blockedIP.findUnique({
    where: { ipAddress: reputation.ip },
  })
  if (blocked) {
    await logSecurityEvent({
      type: 'BLOCKED_IP',
      severity: 'critical',
      message: `Tentative d'accès depuis une IP bloquée (${reputation.ip})`,
      ipAddress: reputation.ip,
      location,
      userId: user.id,
    })
    return NextResponse.json({
      blocked: true,
      reputation,
      alerts: [
        {
          type: 'BLOCKED_IP',
          severity: 'critical',
          message: 'Votre adresse IP est bloquée par le système de sécurité.',
        },
      ],
    })
  }

  // 3) Crée ou met à jour la session active
  const existing = await prisma.userSession.findFirst({
    where: { userId: user.id, ipAddress: reputation.ip, isActive: true },
  })
  const session = existing
    ? await prisma.userSession.update({
        where: { id: existing.id },
        data: { lastSeen: new Date(), location, device, userAgent, latitude: reputation.lat, longitude: reputation.lon },
      })
    : await prisma.userSession.create({
        data: {
          userId: user.id,
          ipAddress: reputation.ip,
          location,
          device,
          userAgent,
          latitude: reputation.lat,
          longitude: reputation.lon,
          isActive: true,
        },
      })

  // 4) Détection VPN / Proxy
  if (reputation.isSuspicious) {
    alerts.push({
      type: 'VPN_PROXY',
      severity: 'high',
      message: `Connexion via ${reputation.reason}.`,
    })
    await logSecurityEvent({
      type: 'VPN_PROXY',
      severity: 'high',
      message: `VPN/Proxy détecté pour ${user.email} (${reputation.reason})`,
      ipAddress: reputation.ip,
      location,
      userId: user.id,
      metadata: { proxy: reputation.proxy, hosting: reputation.hosting, isp: reputation.isp },
    })
  }

  // 5) Détection de connexions simultanées (plusieurs IP actives pour le même compte)
  const activeSessions = await prisma.userSession.findMany({
    where: { userId: user.id, isActive: true },
  })
  const distinctIps = Array.from(new Set(activeSessions.map((s) => s.ipAddress)))
  if (distinctIps.length > 1) {
    // On marque toutes les sessions concernées comme suspectes
    await prisma.userSession.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isFlagged: true },
    })
    alerts.push({
      type: 'SIMULTANEOUS_LOGIN',
      severity: 'high',
      message: `Connexions simultanées depuis ${distinctIps.length} adresses IP différentes.`,
    })
    await logSecurityEvent({
      type: 'SIMULTANEOUS_LOGIN',
      severity: 'high',
      message: `Connexions simultanées anormales pour ${user.email} (${distinctIps.length} IP : ${distinctIps.join(', ')})`,
      ipAddress: reputation.ip,
      location,
      userId: user.id,
      metadata: { ips: distinctIps },
    })
  }

  // 5b) Geo-velocity : "voyage impossible" entre deux sessions actives.
  // Si le même compte est actif à > GEO_MIN_KM avec une vitesse implicite
  // > GEO_MAX_KMH (distance / temps écoulé), c'est physiquement impossible.
  if (reputation.lat != null && reputation.lon != null) {
    const others = await prisma.userSession.findMany({
      where: {
        userId: user.id,
        isActive: true,
        id: { not: session.id },
        latitude: { not: null },
        longitude: { not: null },
      },
    })
    for (const o of others) {
      const distKm = haversineKm(reputation.lat, reputation.lon, o.latitude!, o.longitude!)
      if (distKm < GEO_MIN_KM) continue
      const hours = Math.max((Date.now() - o.lastSeen.getTime()) / 3_600_000, 1 / 60) // min 1 min
      const speed = distKm / hours
      if (speed > GEO_MAX_KMH) {
        await prisma.userSession.updateMany({
          where: { id: { in: [session.id, o.id] } },
          data: { isFlagged: true },
        })
        alerts.push({
          type: 'GEO_VELOCITY',
          severity: 'critical',
          message: `Voyage impossible : ${Math.round(distKm)} km en ${hours < 1 ? Math.round(hours * 60) + ' min' : hours.toFixed(1) + ' h'} (~${Math.round(speed)} km/h).`,
        })
        await logSecurityEvent({
          type: 'GEO_VELOCITY',
          severity: 'critical',
          message: `Voyage impossible pour ${user.email} : ${o.location ?? 'inconnu'} → ${location} (${Math.round(distKm)} km, ~${Math.round(speed)} km/h)`,
          ipAddress: reputation.ip,
          location,
          userId: user.id,
          metadata: { distanceKm: Math.round(distKm), speedKmh: Math.round(speed), from: o.location, to: location },
        })
        break // une alerte suffit
      }
    }
  }

  // Journalise la connexion normale si rien de suspect
  if (alerts.length === 0) {
    await logSecurityEvent({
      type: 'LOGIN',
      severity: 'low',
      message: `Connexion de ${user.email} depuis ${location}`,
      ipAddress: reputation.ip,
      location,
      userId: user.id,
    })
  }

  return NextResponse.json({ blocked: false, reputation, sessionId: session.id, alerts })
}

// Termine la session active (déconnexion / quitte la page protégée)
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await prisma.userSession.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  })
  return NextResponse.json({ success: true })
}
