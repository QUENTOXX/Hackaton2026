// =====================================================================
// API des salles Watch Together.
//  - POST /api/rooms  : crée une salle (le créateur devient hôte/présentateur)
//  - GET  /api/rooms  : liste les salles actives
// L'état temps réel (participants, position) vit dans le serveur Socket.io ;
// cette API ne gère que la persistance (création, listing).
// =====================================================================
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/guard'

// Source par défaut : flux HLS de TEST public (nécessite Internet).
// TODO J2 : remplacer par le HLS local '/hls/demo/index.m3u8'.
const DEFAULT_VIDEO =
  process.env.WATCH_DEFAULT_HLS || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

// Codes lisibles (sans caractères ambigus : 0/O, 1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(length = 5) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

async function uniqueCode() {
  for (let i = 0; i < 12; i++) {
    const code = generateCode()
    const exists = await prisma.room.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('Impossible de générer un code de salle unique')
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const rooms = await prisma.room.findMany({
    where: { isLive: true },
    orderBy: { createdAt: 'desc' },
    include: { host: { select: { name: true, email: true } } },
    take: 50,
  })

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      code: r.code,
      name: r.name,
      hostName: r.host?.name || r.host?.email || 'Inconnu',
      isHost: r.hostId === user.id,
      createdAt: r.createdAt,
    })),
  })
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim() || 'Session de visionnage'
  const videoSrc = String(body?.videoSrc || '').trim() || DEFAULT_VIDEO

  const code = await uniqueCode()
  const room = await prisma.room.create({
    data: { code, name, hostId: user.id, videoSrc },
  })

  // Journalise la création dans le dashboard de sécurité (couture Pôle 2).
  await prisma.securityLog.create({
    data: {
      type: 'ROOM_CREATED',
      severity: 'low',
      message: `Salle « ${name} » créée (${code})`,
      userId: user.id,
      metadata: { roomCode: code, roomId: room.id },
    },
  })

  return NextResponse.json({ code: room.code, name: room.name })
}
