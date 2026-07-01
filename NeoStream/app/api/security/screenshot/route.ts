// Enregistre une tentative de capture d'écran détectée côté navigateur.
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/guard'
import { getClientIp, checkIpReputation } from '@/lib/ip-utils'
import { logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const method = (body?.method ?? 'inconnue').toString()
  const ip = getClientIp(req)
  const rep = await checkIpReputation(ip)

  await logSecurityEvent({
    type: 'SCREENSHOT_ATTEMPT',
    severity: 'medium',
    message: `Tentative de capture d'écran détectée (${method}) — ${user.email}`,
    ipAddress: rep.ip,
    location: rep.location,
    userId: user.id,
    metadata: { method },
  })

  return NextResponse.json({ success: true })
}
