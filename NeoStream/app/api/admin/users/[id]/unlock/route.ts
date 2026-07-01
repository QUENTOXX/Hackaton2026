// Déverrouillage manuel d'un compte verrouillé par l'anti-brute-force (admin).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { clearUserLockout } from '@/lib/login-guard'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })

  const cleared = clearUserLockout(user.email)
  await logSecurityEvent({
    type: 'INFO',
    severity: 'low',
    message: `Compte ${user.email} déverrouillé manuellement par l'administrateur`,
    userId: params.id,
  })
  return NextResponse.json({ success: true, cleared })
}
