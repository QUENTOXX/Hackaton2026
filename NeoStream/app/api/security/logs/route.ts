// Journal des événements de sécurité (réservé à l'administrateur).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60', 10) || 60, 200)
  const type = searchParams.get('type')

  // Le filtre "WATCH" regroupe tous les événements de salle Watch Together.
  const ROOM_TYPES = ['ROOM_CREATED', 'ROOM_JOIN', 'ROOM_LEAVE', 'ROOM_ENDED', 'ROOM_HOST_CHANGED', 'ROOM_CONTROL_GRANTED', 'ROOM_CONTROL_REVOKED']
  const where =
    !type || type === 'ALL'
      ? undefined
      : type === 'WATCH'
        ? { type: { in: ROOM_TYPES } }
        : { type }

  const logs = await prisma.securityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { email: true } } },
  })

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      severity: l.severity,
      message: l.message,
      ipAddress: l.ipAddress,
      location: l.location,
      userEmail: l.user?.email ?? null,
      // Un log est "démo" s'il a été produit par le simulateur (metadata.simulated).
      simulated: (l.metadata as any)?.simulated === true,
      createdAt: l.createdAt.toISOString(),
    })),
  })
}

// ---------------------------------------------------------------------
// Purge du journal (réservé à l'administrateur).
// Par sécurité, on ne supprime QUE les logs RÉELS : les logs de démo
// (metadata.simulated = true) sont conservés pour la présentation.
// Justification : la télémétrie de visionnage est exportable (CSV Pôle 3)
// puis ré-importable ; on peut donc purger les anciens événements réels
// sans rien perdre d'irrécupérable, tout en gardant l'historique de démo.
// ---------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  // IDs des logs de démo à préserver.
  const demo = await prisma.securityLog.findMany({
    where: { metadata: { path: ['simulated'], equals: true } },
    select: { id: true },
  })
  const keepIds = demo.map((d) => d.id)

  // Supprime tout le reste (= les logs réels). Si aucun log démo, notIn:[] purge tout le réel.
  const result = await prisma.securityLog.deleteMany({
    where: { id: { notIn: keepIds } },
  })

  return NextResponse.json({ success: true, deleted: result.count, kept: keepIds.length })
}
