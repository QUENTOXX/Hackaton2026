// =====================================================================
// Gestion des comptes utilisateurs (réservé à l'administrateur).
// GET : liste des utilisateurs avec quelques compteurs utiles.
// =====================================================================
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { isEmailLocked } from '@/lib/login-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { sessions: true, securityLogs: true } },
    },
  })

  return NextResponse.json({
    currentUserId: auth.user?.id ?? null,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      sessionCount: u._count.sessions,
      logCount: u._count.securityLogs,
      locked: isEmailLocked(u.email),
    })),
  })
}
