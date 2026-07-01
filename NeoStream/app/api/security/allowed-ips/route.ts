// Gestion de la liste blanche d'IP (lister / ajouter / retirer).
// Une IP en liste blanche est exemptée du pare-feu et du verrouillage login.
// Réservé à l'administrateur.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Liste des IP autorisées
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const ips = await prisma.allowedIP.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    allowedIps: ips.map((a) => ({
      id: a.id,
      ipAddress: a.ipAddress,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

// Ajouter une IP à la liste blanche
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const ipAddress = (body?.ipAddress ?? '').toString().trim()
  const reason = (body?.reason ?? 'IP de confiance').toString().trim()

  if (!ipAddress) {
    return NextResponse.json({ error: 'Adresse IP requise.' }, { status: 400 })
  }

  // Une IP autorisée ne doit pas rester bloquée en même temps.
  await prisma.blockedIP.deleteMany({ where: { ipAddress } })

  const created = await prisma.allowedIP.upsert({
    where: { ipAddress },
    update: { reason },
    create: { ipAddress, reason },
  })

  await logSecurityEvent({
    type: 'INFO',
    severity: 'low',
    message: `IP ${ipAddress} ajoutée à la liste blanche (${reason})`,
    ipAddress,
  })

  return NextResponse.json({ success: true, id: created.id })
}

// Retirer une IP de la liste blanche (paramètre ?ip=...)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const ip = (searchParams.get('ip') ?? '').trim()
  if (!ip) return NextResponse.json({ error: 'Adresse IP requise.' }, { status: 400 })

  await prisma.allowedIP.deleteMany({ where: { ipAddress: ip } })
  await logSecurityEvent({
    type: 'INFO',
    severity: 'low',
    message: `IP ${ip} retirée de la liste blanche par l'administrateur`,
    ipAddress: ip,
  })
  return NextResponse.json({ success: true })
}
