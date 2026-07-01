// =====================================================================
// État EN MÉMOIRE des salles Watch Together (CommonJS, requis par server.js).
// La base de données ne sert qu'à l'audit / la télémétrie ; l'état temps réel
// (position de lecture, participants connectés) vit ici pour la réactivité.
// =====================================================================

/**
 * @typedef {Object} Participant
 * @property {string} userId
 * @property {string} name
 * @property {number} joinedAt   // timestamp d'arrivée (pour désigner le prochain hôte)
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {string} roomId
 * @property {string} name
 * @property {string} hostId              // hôte courant (peut changer après transfert)
 * @property {string} videoSrc
 * @property {{state:'playing'|'paused', positionSec:number, updatedAt:number}} playback
 * @property {Map<string, Participant>} participants   // clé = socket.id
 * @property {string|null} hostSocketId
 * @property {NodeJS.Timeout|null} hostGraceTimer
 */

/** @type {Map<string, Room>} */
const rooms = new Map()

function getRoom(code) {
  return rooms.get(code) || null
}

function createRoomInMemory({ code, roomId, name, hostId, videoSrc }) {
  /** @type {Room} */
  const room = {
    code,
    roomId,
    name,
    hostId,
    videoSrc,
    playback: { state: 'paused', positionSec: 0, updatedAt: Date.now() },
    participants: new Map(),
    hostSocketId: null,
    hostGraceTimer: null,
    lastActivityAt: Date.now(), // pour la fermeture auto sur inactivité
  }
  rooms.set(code, room)
  return room
}

/** Position de lecture réelle à l'instant présent (extrapolée si en lecture). */
function currentPosition(room) {
  const { state, positionSec, updatedAt } = room.playback
  if (state === 'playing') {
    return positionSec + (Date.now() - updatedAt) / 1000
  }
  return positionSec
}

/** Liste des participants dédupliquée par utilisateur, avec le rôle courant. */
function participantList(room) {
  const byUser = new Map()
  for (const p of room.participants.values()) {
    const existing = byUser.get(p.userId)
    if (!existing || p.joinedAt < existing.joinedAt) byUser.set(p.userId, p)
  }
  return Array.from(byUser.values()).map((p) => ({
    userId: p.userId,
    name: p.name,
    role: p.userId === room.hostId ? 'host' : 'guest',
  }))
}

/** Le plus ancien participant qui n'est pas l'utilisateur exclu (futur hôte). */
function oldestGuest(room, excludeUserId) {
  const byUser = new Map()
  for (const p of room.participants.values()) {
    if (p.userId === excludeUserId) continue
    const existing = byUser.get(p.userId)
    if (!existing || p.joinedAt < existing.joinedAt) byUser.set(p.userId, p)
  }
  const sorted = Array.from(byUser.values()).sort((a, b) => a.joinedAt - b.joinedAt)
  return sorted[0] || null
}

/** Un utilisateur donné a-t-il encore au moins un socket connecté dans la salle ? */
function userStillConnected(room, userId) {
  for (const p of room.participants.values()) {
    if (p.userId === userId) return true
  }
  return false
}

module.exports = {
  rooms,
  getRoom,
  createRoomInMemory,
  currentPosition,
  participantList,
  oldestGuest,
  userStillConnected,
}
