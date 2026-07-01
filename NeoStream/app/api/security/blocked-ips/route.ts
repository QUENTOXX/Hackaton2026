// Gestion des adresses IP bloquées (lister / bloquer / débloquer).
// Réservé à l'administrateur.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Liste des IP bloquées
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const ips = await prisma.blockedIP.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    blockedIps: ips.map((b) => ({
      id: b.id,
      ipAddress: b.ipAddress,
      reason: b.reason,
      blockedBy: b.blockedBy,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}

// Bloquer une nouvelle IP
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const ipAddress = (body?.ipAddress ?? '').toString().trim()
  const reason = (body?.reason ?? 'Bloquée manuellement').toString().trim()

  if (!ipAddress) {
    return NextResponse.json({ error: 'Adresse IP requise.' }, { status: 400 })
  }

  const created = await prisma.blockedIP.upsert({
    where: { ipAddress },
    update: { reason, blockedBy: 'manuel' },
    create: { ipAddress, reason, blockedBy: 'manuel' },
  })

  await logSecurityEvent({
    type: 'BLOCKED_IP',
    severity: 'medium',
    message: `IP ${ipAddress} bloquée manuellement (${reason})`,
    ipAddress,
  })

  return NextResponse.json({ success: true, id: created.id })
}

// Débloquer une IP (paramètre ?ip=...)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const ip = (searchParams.get('ip') ?? '').trim()
  if (!ip) return NextResponse.json({ error: 'Adresse IP requise.' }, { status: 400 })

  await prisma.blockedIP.deleteMany({ where: { ipAddress: ip } })
  await logSecurityEvent({
    type: 'INFO',
    severity: 'low',
    message: `IP ${ip} débloquée par l'administrateur`,
    ipAddress: ip,
  })
  return NextResponse.json({ success: true })
}
