// Statistiques agrégées pour le dashboard (réservé à l'administrateur).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'

export const dynamic = 'force-dynamic'

const THREAT_TYPES = ['SIMULTANEOUS_LOGIN', 'VPN_PROXY', 'SCREENSHOT_ATTEMPT', 'BLOCKED_IP']

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  // Nombre total de menaces (on exclut les simples connexions / infos)
  const totalThreats = await prisma.securityLog.count({
    where: { type: { in: THREAT_TYPES } },
  })
  const activeSessions = await prisma.userSession.count({ where: { isActive: true } })
  const blockedIps = await prisma.blockedIP.count()
  const criticalCount = await prisma.securityLog.count({
    where: { severity: { in: ['high', 'critical'] }, type: { in: THREAT_TYPES } },
  })

  // Répartition par type de menace (pour le camembert)
  const byTypeRaw = await prisma.securityLog.groupBy({
    by: ['type'],
    where: { type: { in: THREAT_TYPES } },
    _count: { _all: true },
  })
  const byType = THREAT_TYPES.map((t) => ({
    type: t,
    count: byTypeRaw.find((r) => r.type === t)?._count?._all ?? 0,
  }))

  // Activité des 7 derniers jours (pour le graphique en barres/lignes)
  const since = new Date()
  since.setDate(since.getDate() - 6)
  since.setHours(0, 0, 0, 0)
  const recent = await prisma.securityLog.findMany({
    where: { createdAt: { gte: since }, type: { in: THREAT_TYPES } },
    select: { createdAt: true },
  })
  const days: { day: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const label = d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      timeZone: 'Europe/Paris',
    })
    const count = recent.filter(
      (r) => r.createdAt >= d && r.createdAt < next
    ).length
    days.push({ day: label, count })
  }

  return NextResponse.json({
    totalThreats,
    activeSessions,
    blockedIps,
    criticalCount,
    byType,
    timeline: days,
  })
}
