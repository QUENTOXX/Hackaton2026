// =====================================================================
// Micro-pare-feu applicatif (Pôle 2 · Sujet B).
//
// Filtre CHAQUE requête HTTP entrante AVANT que Next.js ne la traite, au
// point d'entrée du serveur custom (server.js). Deux protections réelles :
//   1) Liste noire d'IP  -> 403 immédiat (BlockedIP en base, mis en cache).
//   2) Limitation de débit (rate-limit) par IP -> 429 (anti-scraping / flood).
//
// MODÈLE DE MENACE / choix assumés :
//  - En local, le client est en loopback (::1 / 127.0.0.1). On NE limite ni
//    ne bloque JAMAIS les IP locales de confiance : le pare-feu ne peut donc
//    pas casser la démo ni verrouiller l'administrateur.
//  - Pour DÉMONTRER le blocage, on fait confiance à l'en-tête X-Forwarded-For
//    (ex. `curl -H "X-Forwarded-For: 185.220.101.1"`). Derrière un vrai proxy
//    en production, il faudrait ne faire confiance qu'à l'IP du proxy.
//  - Les décisions de blocage sont journalisées dans SecurityLog (vraies
//    détections, non simulées), avec throttling pour éviter le flood de logs.
// =====================================================================

const RATE_LIMIT_MAX = 100 // requêtes autorisées par fenêtre et par IP publique
const RATE_LIMIT_WINDOW_MS = 10_000 // fenêtre glissante (10 s)
const BLOCKLIST_TTL_MS = 15_000 // fraîcheur du cache de la liste noire
const LOG_THROTTLE_MS = 30_000 // 1 log max par (type, IP) sur cette période

let blockedSet = new Set()
let allowedSet = new Set() // liste blanche : IP de confiance, exemptées
let blockedLoadedAt = 0
const hits = new Map() // ip -> { count, resetAt }
const lastLoggedAt = new Map() // "type|ip" -> timestamp

// Extrait l'IP client (X-Forwarded-For > X-Real-IP > socket).
function getIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  const xr = req.headers['x-real-ip']
  if (xr) return String(xr).trim()
  const ra = (req.socket && req.socket.remoteAddress) || ''
  return ra.replace(/^::ffff:/, '') // normalise l'IPv4 mappée IPv6
}

// IP locale/privée = de confiance : jamais filtrée.
function isTrustedLocal(ip) {
  if (!ip) return true
  if (ip === '::1' || ip === 'localhost' || ip.startsWith('127.')) return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  if (ip.startsWith('172.')) {
    const s = parseInt(ip.split('.')[1] || '0', 10)
    if (s >= 16 && s <= 31) return true
  }
  return false
}

// On laisse passer sans filtrer : assets Next, WebSocket, statiques.
function shouldSkip(url) {
  return (
    url.startsWith('/_next/') ||
    url.startsWith('/socket.io/') ||
    url.startsWith('/videos/') ||
    url.startsWith('/hls/') ||
    url === '/favicon.ico' ||
    url.startsWith('/favicon')
  )
}

// Rafraîchit les caches liste noire + liste blanche depuis la base (non bloquant).
function refreshLists(prisma) {
  const now = Date.now()
  if (now - blockedLoadedAt < BLOCKLIST_TTL_MS) return
  blockedLoadedAt = now
  prisma.blockedIP
    .findMany({ select: { ipAddress: true } })
    .then((rows) => {
      blockedSet = new Set(rows.map((r) => r.ipAddress))
    })
    .catch(() => {
      /* en cas d'erreur, on conserve l'ancien cache */
    })
  prisma.allowedIP
    .findMany({ select: { ipAddress: true } })
    .then((rows) => {
      allowedSet = new Set(rows.map((r) => r.ipAddress))
    })
    .catch(() => {
      /* idem */
    })
}

// Journalise une décision du pare-feu (throttlé par type+IP).
function logDecision(prisma, ip, type, severity, message, extra) {
  const key = `${type}|${ip}`
  const now = Date.now()
  if (now - (lastLoggedAt.get(key) || 0) < LOG_THROTTLE_MS) return
  lastLoggedAt.set(key, now)
  prisma.securityLog
    .create({
      data: {
        type,
        severity,
        message,
        ipAddress: ip,
        metadata: { firewall: true, ...(extra || {}) },
      },
    })
    .catch(() => {
      /* le journal ne doit jamais faire planter le serveur */
    })
}

// Cœur du pare-feu. Retourne true si la requête a été traitée (bloquée) et
// ne doit PAS être transmise à Next ; false sinon.
function guard(req, res, prisma) {
  const url = req.url || '/'
  if (shouldSkip(url)) return false

  refreshLists(prisma) // async, non bloquant

  const ip = getIp(req)
  if (isTrustedLocal(ip)) return false // IP locale : jamais filtrée
  if (allowedSet.has(ip)) return false // liste blanche : IP de confiance exemptée

  // 1) Liste noire ------------------------------------------------------
  if (blockedSet.has(ip)) {
    logDecision(
      prisma,
      ip,
      'BLOCKED_IP',
      'critical',
      `Requête rejetée par le pare-feu : IP sur liste noire (${ip}) — ${req.method} ${url}`,
      { method: req.method, url },
    )
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Accès refusé : votre adresse IP est bloquée par le pare-feu applicatif.' }))
    return true
  }

  // 2) Limitation de débit ---------------------------------------------
  const now = Date.now()
  let h = hits.get(ip)
  if (!h || now > h.resetAt) {
    h = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    hits.set(ip, h)
  }
  h.count++
  if (h.count > RATE_LIMIT_MAX) {
    const retry = Math.max(1, Math.ceil((h.resetAt - now) / 1000))
    logDecision(
      prisma,
      ip,
      'RATE_LIMIT',
      'high',
      `Limitation de débit déclenchée par le pare-feu : ${h.count} requêtes en < ${RATE_LIMIT_WINDOW_MS / 1000}s depuis ${ip}`,
      { count: h.count, windowMs: RATE_LIMIT_WINDOW_MS },
    )
    res.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(retry),
    })
    res.end(JSON.stringify({ error: 'Trop de requêtes. Merci de réessayer dans quelques instants.' }))
    return true
  }

  return false
}

// Nettoyage périodique des compteurs expirés (évite une fuite mémoire).
setInterval(() => {
  const now = Date.now()
  for (const [ip, h] of hits) {
    if (now > h.resetAt + RATE_LIMIT_WINDOW_MS) hits.delete(ip)
  }
}, 60_000).unref()

module.exports = { guard, getIp, isTrustedLocal }
