// =====================================================================
// Contrat d'événements Socket.io (côté client) — Watch Together.
// Les noms ci-dessous DOIVENT rester alignés avec server.js / server/*.
// =====================================================================

/** Utilisateur authentifié rattaché à un socket (issu du JWT NextAuth). */
export interface SocketUser {
  id: string
  email: string
  name: string | null
  role: string
}

/** État de lecture partagé. */
export interface PlaybackState {
  state: 'playing' | 'paused'
  positionSec: number
}

/** Un participant présent dans la salle. */
export interface Participant {
  userId: string
  name: string
  role: 'host' | 'guest'
}

/** État complet renvoyé à l'entrée d'une salle. */
export interface RoomState {
  code: string
  name: string
  videoSrc: string
  hostId: string
  isHost: boolean
  playback: PlaybackState
  participants: Participant[]
}

/** Réponse de l'ACK `room:join`. */
export type JoinAck =
  | { ok: true; state: RoomState }
  | { ok: false; error: 'ROOM_NOT_FOUND' | 'SERVER_ERROR' }

/** Noms d'événements. */
export const EV = {
  // --- diagnostic (J0) ---
  PING: 'ping:test',
  PONG: 'pong:test',
  // --- client -> serveur ---
  ROOM_JOIN: 'room:join',
  PRESENTER_PLAY: 'presenter:play',
  PRESENTER_PAUSE: 'presenter:pause',
  PRESENTER_SEEK: 'presenter:seek',
  PRESENTER_LOAD: 'presenter:loadVideo',
  PRESENTER_END: 'presenter:endRoom',
  // --- serveur -> client ---
  SYNC_PLAY: 'sync:play',
  SYNC_PAUSE: 'sync:pause',
  SYNC_SEEK: 'sync:seek',
  ROOM_PARTICIPANTS: 'room:participants',
  ROOM_HOST_DISCONNECTED: 'room:hostDisconnected',
  ROOM_HOST_RECONNECTED: 'room:hostReconnected',
  ROOM_HOST_CHANGED: 'room:hostChanged',
  ROOM_VIDEO_CHANGED: 'room:videoChanged',
  ROOM_ENDED: 'room:ended',
} as const

/** Réponse au ping de diagnostic. */
export interface PongPayload {
  pong: true
  at: number
  user: SocketUser
  echo: unknown
}
