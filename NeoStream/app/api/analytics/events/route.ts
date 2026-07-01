// =====================================================================
// Export de la télémétrie de visionnage pour le module Analyse d'audience
// (Pôle 3 · Sujet B). Réservé à l'administrateur.
//
// Transforme nos `PlaybackEvent` (bruts, orientés temps réel) en logs
// conformes au CONTRAT défini par l'équipe Data dans
// `video_analytics/data/SCHEMA_LOGS.md` :
//   session_id,user_id,video_id,video_duration_s,event_type,
//   video_time_s,event_time,device,playback_rate
//
// Ainsi leur dashboard Streamlit peut importer nos données réelles sans
// modifier une ligne de leur côté (onglet « Importer des logs »).
//
// Formats : ?format=csv (défaut, téléchargement) | ?format=json
// Filtre optionnel : ?roomId=<id>
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/guard'

export const dynamic = 'force-dynamic'

const COMPLETE_RATIO = 0.98 // au-delà, la session est considérée « terminée »
const MAX_EVENTS = 100_000

// Mapping de nos types internes vers l'enum du contrat Pôle 3.
function mapEventType(type: string, positionSec: number, durationSec: number): string {
  switch (type) {
    case 'JOIN':
    case 'PLAY':
      return 'play'
    case 'PAUSE':
      return 'pause'
    case 'SEEK':
      return 'seek'
    case 'BUFFER':
      return 'buffering'
    case 'ENDED':
      return 'complete'
    case 'LEAVE':
      // Départ après avoir (quasi) tout vu = complétion ; sinon = abandon.
      return durationSec > 0 && positionSec >= durationSec * COMPLETE_RATIO ? 'complete' : 'abandon'
    default:
      return type.toLowerCase()
  }
}

// Échappement CSV minimal (RFC 4180) : on entoure de guillemets si nécessaire.
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const HEADERS = [
  'session_id',
  'user_id',
  'video_id',
  'video_duration_s',
  'event_type',
  'video_time_s',
  'event_time',
  'device',
  'playback_rate',
] as const

interface LogRow {
  session_id: string
  user_id: string
  video_id: string
  video_duration_s: number
  event_type: string
  video_time_s: number
  event_time: string
  device: string
  playback_rate: number
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const roomId = searchParams.get('roomId') || undefined

  // 1) Événements bruts, dans l'ordre chronologique (pour reconstruire les sessions).
  const events = await prisma.playbackEvent.findMany({
    where: roomId ? { roomId } : undefined,
    orderBy: { createdAt: 'asc' },
    take: MAX_EVENTS,
  })

  // 2) Métadonnées des salles concernées : source vidéo + durée totale.
  const roomIds = Array.from(new Set(events.map((e) => e.roomId)))
  const rooms = roomIds.length
    ? await prisma.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, videoSrc: true, durationSec: true },
      })
    : []
  const roomMap = new Map(rooms.map((r) => [r.id, r]))

  // 3) Durée de repli : si la salle n'a pas remonté sa durée, on prend la
  //    position maximale observée sur cette salle (sous-estime un peu, mais
  //    évite une rétention non calculable). Documenté comme repli.
  const fallbackDuration = new Map<string, number>()
  for (const e of events) {
    const cur = fallbackDuration.get(e.roomId) ?? 0
    if (e.positionSec > cur) fallbackDuration.set(e.roomId, e.positionSec)
  }

  // 4) Reconstruction des sessions : 1 session = 1 utilisateur dans 1 salle,
  //    entre un JOIN et le LEAVE correspondant. On incrémente un compteur à
  //    chaque JOIN (gère les reconnexions).
  const seqByUserRoom = new Map<string, number>() // clé "roomId|userId" -> dernier seq

  const rows: LogRow[] = events.map((e) => {
    const room = roomMap.get(e.roomId)
    const duration = room?.durationSec ?? fallbackDuration.get(e.roomId) ?? 0
    const key = `${e.roomId}|${e.userId}`

    if (e.type === 'JOIN' || !seqByUserRoom.has(key)) {
      seqByUserRoom.set(key, (seqByUserRoom.get(key) ?? 0) + 1)
    }
    const seq = seqByUserRoom.get(key) ?? 1

    const pos = Math.max(0, duration > 0 ? Math.min(e.positionSec, duration) : e.positionSec)

    return {
      session_id: `${e.roomId}_${e.userId}_s${seq}`,
      user_id: e.userId,
      video_id: room?.videoSrc ?? e.roomId,
      video_duration_s: Math.round(duration * 10) / 10,
      event_type: mapEventType(e.type, e.positionSec, duration),
      video_time_s: Math.round(pos * 10) / 10,
      event_time: e.createdAt.toISOString(),
      device: e.device ?? '',
      playback_rate: e.playbackRate ?? 1.0,
    }
  })

  if (format === 'json') {
    return NextResponse.json({ count: rows.length, rows })
  }

  // CSV (téléchargement)
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    lines.push(HEADERS.map((h) => csvCell(r[h])).join(','))
  }
  const csv = lines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="neostream_viewing_logs.csv"',
    },
  })
}
