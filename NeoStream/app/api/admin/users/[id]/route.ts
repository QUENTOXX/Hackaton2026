// =====================================================================
// Modification / suppression d'un compte utilisateur (admin uniquement).
// PATCH  : nom, rôle (user|admin), réinitialisation du mot de passe.
// DELETE : suppression du compte.
//
// GARDE-FOUS :
//  - impossible de supprimer son propre compte ;
//  - impossible de supprimer OU de rétrograder le dernier administrateur.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

async function isLastAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (target?.role !== 'admin') return false
  const admins = await prisma.user.count({ where: { role: 'admin' } })
  return admins <= 1
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const id = params.id
  const body = await req.json().catch(() => ({}))
  const data: { name?: string | null; role?: string; password?: string } = {}

  if (typeof body?.name === 'string') data.name = body.name.trim() || null

  if (typeof body?.role === 'string') {
    const role = body.role.toLowerCase()
    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 })
    }
    // Empêche de rétrograder le dernier admin.
    if (role === 'user' && (await isLastAdmin(id))) {
      return NextResponse.json({ error: 'Impossible de rétrograder le dernier administrateur.' }, { status: 400 })
    }
    data.role = role
  }

  if (typeof body?.password === 'string' && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 })
    }
    data.password = await bcrypt.hash(body.password, 10)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data })
    await logSecurityEvent({
      type: 'INFO',
      severity: 'low',
      message: `Compte ${updated.email} modifié par l'administrateur (${Object.keys(data).join(', ')})`,
      userId: updated.id,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const id = params.id

  if (auth.user?.id === id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
  }
  if (await isLastAdmin(id)) {
    return NextResponse.json({ error: 'Impossible de supprimer le dernier administrateur.' }, { status: 400 })
  }

  try {
    const deleted = await prisma.user.delete({ where: { id } })
    await logSecurityEvent({
      type: 'INFO',
      severity: 'medium',
      message: `Compte ${deleted.email} supprimé par l'administrateur`,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
  }
}
