// =====================================================================
// Analyse une adresse IP : géolocalisation + détection VPN/Proxy.
// Utilisé par le simulateur du dashboard et pour les tests.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { checkIpReputation, getClientIp } from '@/lib/ip-utils'
import { getSessionUser } from '@/lib/guard'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ip = (body?.ip ?? '').toString().trim() || getClientIp(req)

  const reputation = await checkIpReputation(ip)
  const blocked = await prisma.blockedIP.findUnique({ where: { ipAddress: reputation.ip } })

  return NextResponse.json({ ...reputation, isBlocked: Boolean(blocked) })
}
