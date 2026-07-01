// =====================================================================
// Création d'un nouveau compte utilisateur.
// Le mot de passe est haché avec bcrypt avant d'être stocké.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = (body?.email ?? '').toString().toLowerCase().trim()
    const password = (body?.password ?? '').toString()
    const name = (body?.name ?? '').toString().trim()

    // Validation simple des champs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe sont obligatoires.' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      )
    }

    // Vérifie qu'aucun compte n'existe déjà avec cet email
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email.' },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: { email, password: hashed, name: name || null, role: 'user' },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création du compte.' },
      { status: 500 }
    )
  }
}
