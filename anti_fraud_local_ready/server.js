// =====================================================================
// Serveur custom : Next.js + Socket.io sur le MÊME port (3000).
// L'App Router de Next ne gère pas les WebSockets persistants, donc on
// démarre Next à la main et on attache un serveur Socket.io au serveur HTTP.
//
// Authentification : on réutilise le cookie de session NextAuth (JWT).
// Au handshake, getToken() décode ce cookie -> on connaît userId + rôle.
//
// IMPORTANT : on charge les variables d'environnement avec le loader OFFICIEL
// de Next (@next/env) pour garantir EXACTEMENT le même NEXTAUTH_SECRET que
// celui utilisé par l'application (sinon getToken ne peut pas décoder le JWT).
//
// NOTE : les noms d'événements doivent rester alignés avec
//        lib/realtime/socket-events.ts (côté client).
// =====================================================================
const dev = process.env.NODE_ENV !== 'production'

// Charge .env / .env.local exactement comme Next -> parité du secret garantie.
require('@next/env').loadEnvConfig(process.cwd(), dev)

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { getToken } = require('next-auth/jwt')
const { parse: parseCookie } = require('cookie')
const { PrismaClient } = require('@prisma/client')

const store = require('./server/room-store')

const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)
const HOST_GRACE_MS = 60_000 // délai de reconnexion de l'hôte avant transfert
const INACTIVITY_MS = 10 * 60_000 // fermeture auto après 10 min sans activité
const SWEEP_MS = 30_000 // fréquence de vérification de l'inactivité

const prisma = new PrismaClient()
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)

// --- Persistance non bloquante (audit + télémétrie) ---------------------
function logRoomEvent(room, userId, type, message) {
  prisma.securityLog
    .create({
      data: {
        type,
        severity: 'low',
        message,
        userId: userId || null,
        metadata: { roomCode: room.code, roomId: room.roomId },
      },
    })
    .catch((e) => console.error('[log] securityLog', e.message))
}

function recordPlayback(room, userId, type, positionSec) {
  prisma.playbackEvent
    .create({ data: { roomId: room.roomId, userId, type, positionSec: num(positionSec) } })
    .catch((e) => console.error('[log] playbackEvent', e.message))
}

function endRoom(io, room, reason = 'host') {
  if (room.hostGraceTimer) {
    clearTimeout(room.hostGraceTimer)
    room.hostGraceTimer = null
  }
  prisma.room
    .update({ where: { id: room.roomId }, data: { isLive: false, endedAt: new Date() } })
    .catch((e) => console.error('[room] end', e.message))
  // Clôture les participations encore ouvertes (pour un temps de présence exact).
  prisma.roomParticipant
    .updateMany({ where: { roomId: room.roomId, leftAt: null }, data: { leftAt: new Date() } })
    .catch((e) => console.error('[room] end participants', e.message))
  io.to(room.code).emit('room:ended', { reason })
  store.rooms.delete(room.code)
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const io = new Server(server, { cors: { origin: true, credentials: true } })

  // --- Auth handshake : session NextAuth obligatoire ---
  io.use(async (socket, nextFn) => {
    try {
      // getToken (NextAuth v4) lit req.cookies (objet déjà parsé), absent d'une
      // requête socket brute -> on le fournit à partir de l'en-tête Cookie.
      const cookieHeader = socket.request.headers.cookie || ''
      const cookies = parseCookie(cookieHeader)
      const token = await getToken({
        req: { cookies, headers: socket.request.headers },
        secret: process.env.NEXTAUTH_SECRET,
      })
      if (!token) {
        const names = Object.keys(cookies).join(',') || 'aucun'
        console.log(
          `[socket] AUTH FAIL — secretPresent=${!!process.env.NEXTAUTH_SECRET} cookiePresent=${!!cookieHeader} cookies=[${names}]`,
        )
        return nextFn(new Error('UNAUTHENTICATED'))
      }
      socket.data.user = {
        id: token.id,
        email: token.email,
        name: token.name ?? null,
        role: token.role ?? 'user',
      }
      nextFn()
    } catch (err) {
      console.error('[socket] erreur auth handshake:', err)
      nextFn(new Error('AUTH_ERROR'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    const displayName = user.name || user.email
    console.log(`[socket] + ${user.email} (${user.role}) — ${socket.id}`)

    const isHost = (room) => room && room.hostId === user.id

    // --- Diagnostic (J0) : ping authentifié -> pong ---
    socket.on('ping:test', (payload, ack) => {
      const reply = { pong: true, at: Date.now(), user, echo: payload ?? null }
      if (typeof ack === 'function') ack(reply)
      socket.emit('pong:test', reply)
    })

    // --- Rejoindre une salle ---
    socket.on('room:join', async ({ code } = {}, ack) => {
      try {
        code = String(code || '').toUpperCase().trim()
        let room = store.getRoom(code)
        if (!room) {
          const dbRoom = await prisma.room.findUnique({ where: { code } })
          if (!dbRoom || !dbRoom.isLive) return ack && ack({ ok: false, error: 'ROOM_NOT_FOUND' })
          room = store.createRoomInMemory({
            code,
            roomId: dbRoom.id,
            name: dbRoom.name,
            hostId: dbRoom.hostId,
            videoSrc: dbRoom.videoSrc,
          })
        }

        socket.join(code)
        socket.data.roomCode = code
        room.lastActivityAt = Date.now()
        room.participants.set(socket.id, { userId: user.id, name: displayName, joinedAt: Date.now() })

        if (isHost(room)) {
          room.hostSocketId = socket.id
          if (room.hostGraceTimer) {
            clearTimeout(room.hostGraceTimer)
            room.hostGraceTimer = null
            io.to(code).emit('room:hostReconnected', { hostId: room.hostId })
          }
        }

        // Trace de participation (historique : qui / quand / combien de temps).
        try {
          const part = await prisma.roomParticipant.create({
            data: { roomId: room.roomId, userId: user.id, role: isHost(room) ? 'host' : 'guest' },
          })
          socket.data.participantRowId = part.id
        } catch (e) {
          console.error('[room] participant create', e.message)
        }

        const state = {
          code: room.code,
          name: room.name,
          videoSrc: room.videoSrc,
          hostId: room.hostId,
          isHost: isHost(room),
          playback: { state: room.playback.state, positionSec: store.currentPosition(room) },
          participants: store.participantList(room),
        }
        if (ack) ack({ ok: true, state })
        io.to(code).emit('room:participants', store.participantList(room))

        logRoomEvent(room, user.id, 'ROOM_JOIN', `${displayName} a rejoint la salle ${code}`)
        recordPlayback(room, user.id, 'JOIN', store.currentPosition(room))
      } catch (e) {
        console.error('[socket] room:join', e)
        if (ack) ack({ ok: false, error: 'SERVER_ERROR' })
      }
    })

    // --- Commandes du présentateur (autorité serveur) ---
    socket.on('presenter:play', ({ positionSec } = {}) => {
      const room = store.getRoom(socket.data.roomCode)
      if (!isHost(room)) return
      room.lastActivityAt = Date.now()
      room.playback = { state: 'playing', positionSec: num(positionSec), updatedAt: Date.now() }
      socket.to(room.code).emit('sync:play', { positionSec: room.playback.positionSec })
      recordPlayback(room, user.id, 'PLAY', room.playback.positionSec)
    })

    socket.on('presenter:pause', ({ positionSec } = {}) => {
      const room = store.getRoom(socket.data.roomCode)
      if (!isHost(room)) return
      room.lastActivityAt = Date.now()
      room.playback = { state: 'paused', positionSec: num(positionSec), updatedAt: Date.now() }
      socket.to(room.code).emit('sync:pause', { positionSec: room.playback.positionSec })
      recordPlayback(room, user.id, 'PAUSE', room.playback.positionSec)
    })

    socket.on('presenter:seek', ({ positionSec } = {}) => {
      const room = store.getRoom(socket.data.roomCode)
      if (!isHost(room)) return
      room.lastActivityAt = Date.now()
      room.playback = { state: room.playback.state, positionSec: num(positionSec), updatedAt: Date.now() }
      socket.to(room.code).emit('sync:seek', { positionSec: room.playback.positionSec })
      recordPlayback(room, user.id, 'SEEK', room.playback.positionSec)
    })

    socket.on('presenter:loadVideo', ({ videoSrc } = {}) => {
      const room = store.getRoom(socket.data.roomCode)
      if (!isHost(room) || !videoSrc) return
      room.videoSrc = String(videoSrc)
      room.playback = { state: 'paused', positionSec: 0, updatedAt: Date.now() }
      io.to(room.code).emit('room:videoChanged', { videoSrc: room.videoSrc })
    })

    // --- Le présentateur ferme la salle ---
    socket.on('presenter:endRoom', () => {
      const room = store.getRoom(socket.data.roomCode)
      if (!isHost(room)) return
      if (room.hostGraceTimer) {
        clearTimeout(room.hostGraceTimer)
        room.hostGraceTimer = null
      }
      logRoomEvent(room, user.id, 'ROOM_ENDED', `Salle ${room.code} terminée par le présentateur`)
      endRoom(io, room, 'host')
    })

    // --- Déconnexion : clôture de participation + transfert d'hôte ---
    socket.on('disconnect', (reason) => {
      console.log(`[socket] - ${user.email} (${reason})`)

      // Clôture la ligne d'historique de cette participation.
      if (socket.data.participantRowId) {
        prisma.roomParticipant
          .update({ where: { id: socket.data.participantRowId }, data: { leftAt: new Date() } })
          .catch((e) => console.error('[room] participant leave', e.message))
      }

      const code = socket.data.roomCode
      const room = code && store.getRoom(code)
      if (!room) return

      room.participants.delete(socket.id)
      io.to(code).emit('room:participants', store.participantList(room))
      logRoomEvent(room, user.id, 'ROOM_LEAVE', `${displayName} a quitté la salle ${code}`)
      recordPlayback(room, user.id, 'LEAVE', store.currentPosition(room))

      const hostGone = room.hostId === user.id && !store.userStillConnected(room, room.hostId)
      if (hostGone) {
        io.to(code).emit('room:hostDisconnected', { graceMs: HOST_GRACE_MS })
        room.hostGraceTimer = setTimeout(() => {
          room.hostGraceTimer = null
          const nextHost = store.oldestGuest(room, room.hostId)
          if (nextHost) {
            room.hostId = nextHost.userId
            io.to(code).emit('room:hostChanged', { hostId: nextHost.userId, hostName: nextHost.name })
            io.to(code).emit('room:participants', store.participantList(room))
            logRoomEvent(room, nextHost.userId, 'ROOM_HOST_CHANGED', `${nextHost.name} devient présentateur de ${code}`)
          } else {
            endRoom(io, room, 'empty')
          }
        }, HOST_GRACE_MS)
      }

      if (room.participants.size === 0 && !room.hostGraceTimer) {
        store.rooms.delete(code)
      }
    })
  })

  global.__io = io

  // --- Fermeture automatique des salles inactives (> 10 min) ---
  // Une salle en lecture est considérée active ; on ne ferme que les salles
  // à l'arrêt sans aucune action depuis INACTIVITY_MS.
  setInterval(() => {
    const now = Date.now()
    for (const room of Array.from(store.rooms.values())) {
      const idle = room.playback.state !== 'playing' && now - room.lastActivityAt > INACTIVITY_MS
      if (idle) {
        console.log(`[room] fermeture auto (inactivité) — ${room.code}`)
        logRoomEvent(room, null, 'ROOM_ENDED', `Salle ${room.code} fermée après 10 min d'inactivité`)
        endRoom(io, room, 'inactivity')
      }
    }
  }, SWEEP_MS)

  server.listen(port, () => {
    console.log(`> Prêt sur http://${hostname}:${port}  —  Next.js + Socket.io`)
  })
})
