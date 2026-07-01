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

  const logs = await prisma.securityLog.findMany({
    where: type && type !== 'ALL' ? { type } : undefined,
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
      createdAt: l.createdAt.toISOString(),
    })),
  })
}
