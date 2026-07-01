// Liste des connexions actives (réservé à l'administrateur).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { expireStaleSessions } from '@/lib/session-hygiene'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  // Expire d'abord les sessions inactives (voyage impossible / simultané fiables).
  await expireStaleSessions()

  const sessions = await prisma.userSession.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: 'desc' },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  })

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      device: s.device,
      isFlagged: s.isFlagged,
      userEmail: s.user?.email ?? 'inconnu',
      userName: s.user?.name ?? null,
      createdAt: s.createdAt.toISOString(),
      lastSeen: s.lastSeen.toISOString(),
    })),
  })
}
