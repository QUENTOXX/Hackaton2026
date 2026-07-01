# Plan d'architecture — « Watch Together » (Pôle 1 · Sujet B)

> Module de salon vidéo synchronisé **intégré dans SentinelGuard** (`anti_fraud_local_ready`).
> Un présentateur (= hôte/créateur d'une salle) pilote en temps réel les lecteurs HLS de tous les invités.
> Stack : Next.js 14 + Socket.io + hls.js + Prisma/PostgreSQL — 100 % local.

---

## 1. Vision d'intégration (bloc B du barème : « une seule plateforme »)

La vidéo diffusée dans Watch Together **est** le contenu sensible que SentinelGuard protège. On réutilise tel quel :

| Brique SentinelGuard | Réutilisation dans Watch Together |
|---|---|
| Auth NextAuth (JWT, rôle+id) | Même login ; auth aussi pour les sockets |
| Détection capture d'écran | Extraite en hook → active pendant la session vidéo |
| Analyse IP / réputation (`/api/security/session`) | À l'entrée d'une salle, on qualifie l'IP |
| `SecurityLog` + Dashboard admin | Nouveaux événements de salle visibles dans le dashboard |
| UI shadcn/Tailwind, layouts, toasts | Réutilisés pour les écrans Watch Together |

**Récit de démo** : un présentateur lance une diffusion confidentielle → les invités suivent en synchro → un invité tente une capture d'écran → l'événement remonte instantanément au présentateur **et** dans le dashboard de sécurité. Les 3 pôles racontent une seule histoire.

---

## 2. Modèle de données (ajouts Prisma)

État temps réel = **en mémoire serveur** (rapide). On **persiste en base** uniquement le cycle de vie pour l'audit/dashboard.

```prisma
model Room {
  id          String   @id @default(cuid())
  code        String   @unique          // code court partagé (ex. "7F3K")
  name        String
  hostId      String                    // créateur = présentateur
  host        User     @relation("HostRooms", fields: [hostId], references: [id], onDelete: Cascade)
  videoSrc    String                    // chemin HLS (.m3u8)
  isLive      Boolean  @default(true)
  createdAt   DateTime @default(now())
  endedAt     DateTime?
  participants RoomParticipant[]
  @@index([code])
}

model RoomParticipant {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation("JoinedRooms", fields: [userId], references: [id], onDelete: Cascade)
  role      String   @default("guest")  // "host" | "guest"
  joinedAt  DateTime @default(now())
  leftAt    DateTime?
  @@index([roomId])
}
```

+ ajouter les relations inverses `HostRooms` / `JoinedRooms` sur `User`.
+ nouveaux types de `SecurityLog` : `ROOM_CREATED`, `ROOM_JOIN`, `ROOM_LEAVE`, et `SCREENSHOT_ATTEMPT` enrichi du `roomId` dans `metadata`.

**Table de télémétrie de visionnage** (couture Pôle 3 — voir §10) :

```prisma
model PlaybackEvent {
  id         String   @id @default(cuid())
  roomId     String
  userId     String
  type       String                    // PLAY | PAUSE | SEEK | JOIN | LEAVE | BUFFER | ENDED
  positionSec Float                    // position dans la vidéo au moment de l'événement
  createdAt  DateTime @default(now())
  @@index([roomId])
  @@index([type])
}
```

---

## 3. Serveur temps réel (le point dur)

`next dev` ne gère pas les WebSockets persistants → **serveur Node custom** qui héberge Next + Socket.io sur le **même port** (3000).

- **`server.js`** (racine) : démarre `next({ dev })`, crée un `http.Server`, attache `new Server(io)` dessus.
- **Auth socket** : au handshake, on décode le cookie NextAuth avec `getToken({ req })` (`next-auth/jwt`) → on récupère `userId` + `role`. Pas de double login.
- **`package.json`** : `"dev": "node server.js"`, `"start": "NODE_ENV=production node server.js"`.
- État serveur : `Map<roomCode, { hostId, videoSrc, playback: { state, positionSec, updatedAt }, participants: Map<socketId, {userId,name}> }>`.
- La position courante se recalcule à la volée (`positionSec + (now - updatedAt)` si `playing`) → un **join tardif reçoit l'état exact**.

---

## 4. Protocole d'événements Socket.io

**Client → Serveur**

| Événement | Émetteur | Charge utile | Effet |
|---|---|---|---|
| `room:join` | tous | `{ code }` | Rejoint la room, reçoit `room:state` |
| `presenter:play` | hôte | `{ positionSec }` | Diffuse `sync:play` à tous |
| `presenter:pause` | hôte | `{ positionSec }` | Diffuse `sync:pause` |
| `presenter:seek` | hôte | `{ positionSec }` | Diffuse `sync:seek` |
| `presenter:loadVideo` | hôte | `{ videoSrc }` | Change la source pour tous |
| `screenshot:attempt` | tous | `{ method }` | Log + notifie l'hôte en live |
| `room:leave` | tous | — | Quitte, MAJ participants |

**Serveur → Client**

| Événement | Cible | Charge utile |
|---|---|---|
| `room:state` | nouveau venu | `{ videoSrc, playback, participants, isHost }` |
| `sync:play` / `sync:pause` / `sync:seek` | invités | `{ positionSec }` |
| `room:participants` | tous | `[{ userId, name, role }]` |
| `room:screenshotAlert` | hôte | `{ name, method, at }` |
| `room:ended` | tous | — |

**Garde-fous** : seuls les events `presenter:*` venant du `socket.userId === room.hostId` sont acceptés (autorité serveur). Les invités ont un lecteur **verrouillé** (pas de contrôles) qui applique les `sync:*` reçus, avec une tolérance (~0,5 s) pour éviter les micro-saccades.

---

## 5. Arborescence (à créer / modifier)

```
anti_fraud_local_ready/
├── server.js                                  ★ NOUVEAU (Next + Socket.io)
├── package.json                               ✎ scripts dev/start
├── prisma/schema.prisma                       ✎ Room, RoomParticipant, relations
├── public/hls/demo/                           ★ NOUVEAU (index.m3u8 + segments .ts)
├── lib/
│   ├── realtime/room-store.ts                 ★ état en mémoire des salles
│   ├── realtime/socket-events.ts              ★ types partagés client/serveur
│   └── socket-auth.ts                         ★ getToken au handshake
├── hooks/
│   ├── use-socket.ts                          ★ connexion Socket.io côté client
│   └── use-screenshot-guard.ts                ★ EXTRAIT de protected-client.tsx
├── app/
│   ├── watch/page.tsx                         ★ liste / créer / rejoindre une salle
│   ├── watch/[code]/page.tsx                  ★ page salle (serveur : auth + room)
│   └── api/rooms/route.ts                     ★ POST créer · GET lister
├── components/watch/
│   ├── room-client.tsx                        ★ logique salle (socket + sync)
│   ├── hls-player.tsx                         ★ <video> + hls.js, mode hôte/invité
│   ├── participants-list.tsx                  ★ présence live
│   ├── presenter-controls.tsx                 ★ barre de contrôle (hôte)
│   └── join-room-form.tsx                     ★ saisie du code
└── components/protected/protected-client.tsx  ✎ utilise le hook extrait
```

---

## 6. Flux UX

1. **Créer une salle** (`/watch`) → POST `/api/rooms` (nom + source HLS) → génère un `code` → redirige vers `/watch/[code]` en tant qu'hôte.
2. **Rejoindre** → l'invité saisit le code → `/watch/[code]` → `room:join` → reçoit `room:state` et **se cale immédiatement** (position + play/pause).
3. **Présentateur pilote** → ses play/pause/seek émettent `presenter:*` → tous les invités suivent.
4. **Invité** → lecteur verrouillé (overlay « piloté par le présentateur »), voit la liste des participants.
5. **Sécurité active** → `useScreenshotGuard()` tourne dans la salle ; toute tentative = toast local + `screenshot:attempt` → alerte live à l'hôte + `SecurityLog`.
6. **Fin** → l'hôte termine → `room:ended`, `Room.endedAt` renseigné.

---

## 7. Source vidéo HLS locale

- Pré-segmenter une vidéo de démo en HLS avec ffmpeg :
  ```bash
  ffmpeg -i source.mp4 -c:v h264 -c:a aac -hls_time 4 -hls_playlist_type vod \
    -hls_segment_filename "public/hls/demo/seg_%03d.ts" public/hls/demo/index.m3u8
  ```
- Lecture via `hls.js` (et fallback natif Safari). Source servie en statique : `/hls/demo/index.m3u8`.
- Évolution possible (innovation / lien Pôle 2 Sujet A) : chiffrer les segments AES-128 avec clé éphémère — **hors MVP**.

---

## 8. Jalons (2,5 jours)

| Jalon | Contenu | Dé-risque |
|---|---|---|
| **J0 – Socle** | `server.js` + Socket.io + auth socket + un event « ping » | Le point technique dur |
| **J1 – Sync cœur** | Room store, `room:join`, `sync:play/pause/seek`, hls-player hôte/invité | Cœur du sujet |
| **J1 – Multi-salles** | API rooms, code d'accès, `/watch` + `/watch/[code]` | |
| **J2 – Présence + sécurité** | Liste participants live, extraction `useScreenshotGuard`, alertes live + logs | Intégration Pôle 2 |
| **J2 – Polish + démo** | UI shadcn, HLS local, scénario de démo, vérif dashboard | Présentation |

**Répartition possible (équipe)** : (a) serveur temps réel + protocole, (b) lecteur HLS + synchro, (c) UI salles/présence + intégration sécurité.

---

## 9. Décisions validées

1. **Déconnexion du présentateur** : timer de grâce **60 s**. S'il se reconnecte (même `userId`), il reprend la main ; sinon on **promeut le plus ancien invité présent** (`joinedAt` min) comme nouvel hôte, et ainsi de suite. Event serveur `room:hostChanged`. (Alimente le bloc D – Innovation.)
2. **Salles** : état live en mémoire serveur, persistance du seul cycle de vie + télémétrie en base. ✅
3. **Vidéo de démo** : fournie par l'équipe (`.mp4` à segmenter en HLS). ✅
4. **Install** : on conserve `--legacy-peer-deps` pour ajouter `socket.io`, `socket.io-client`, `hls.js`. ✅

---

## 10. Couture d'intégration — Pôle 3 (IA & Data)

Watch Together **produit nativement** les données du Pôle 3 ; on pose la couture dès maintenant (coût quasi nul, les events transitent déjà par le serveur).

**Sujet B Pôle 3 — Analyse d'audience & prédiction de rétention**
- Le serveur temps réel persiste chaque play/pause/seek/join/leave/ended dans `PlaybackEvent` (throttlé pour le seek).
- → dataset directement exploitable : « zones d'ennui » = densité de pauses/seek-arrière/abandons par seconde de vidéo ; « rétention » = courbe des positions au fil du temps.
- Le Pôle 3 lit **la même base PostgreSQL via Prisma** → aucun recâblage.
- Endpoint optionnel `GET /api/analytics/events?roomId=…` (admin) exportant JSON/CSV pour leur dashboard BI / Streamlit / scikit-learn.

**Sujet A Pôle 3 — Pipeline d'indexation sémantique (Whisper, résumés, chapitres)**
- Consomme le **fichier vidéo de la salle** (`videoSrc`). Le pipeline Python tourne hors-ligne et écrit ses métadonnées (transcription, chapitres, mots-clés) dans une table `VideoIndex(roomId/videoSrc, …)` ou un fichier `.json` à côté du `.m3u8`.
- Affichage possible dans la salle : chapitres cliquables sous le lecteur, recherche dans la transcription → boucle Pôle 1 ↔ Pôle 3.

**Ce qu'on fait dans le périmètre actuel** : la table `PlaybackEvent` + son alimentation par le serveur. Le modèle prédictif et le pipeline Whisper restent au Pôle 3 — mais ils se branchent sans rien réécrire de notre côté.
