// =====================================================================
// Historique des diffusions passées (salles terminées).
// Retourne, pour chaque salle close : durée de diffusion + participants
// (qui, heure d'arrivée, temps de présence).
// =====================================================================
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/guard'

function durationSec(from: Date, to: Date | null) {
  if (!to) return null
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000))
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const rooms = await prisma.room.findMany({
    where: { isLive: false },
    orderBy: { endedAt: 'desc' },
    take: 50,
    include: {
      host: { select: { name: true, email: true } },
      participants: {
        orderBy: { joinedAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  const history = rooms.map((r) => ({
    code: r.code,
    name: r.name,
    hostName: r.host?.name || r.host?.email || 'Inconnu',
    createdAt: r.createdAt,
    endedAt: r.endedAt,
    broadcastSec: durationSec(r.createdAt, r.endedAt),
    participants: r.participants.map((p) => ({
      name: p.user?.name || p.user?.email || 'Inconnu',
      role: p.role,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      presentSec: durationSec(p.joinedAt, p.leftAt),
    })),
  }))

  return NextResponse.json({ history })
}
