# Récapitulatif de session — Watch Together (Pôle 1 · Sujet B)

> Trace concise de ce qui a été décidé, construit et corrigé.
> Module **Watch Together** intégré dans le projet **SentinelGuard** (`anti_fraud_local_ready`).
> Docs liées : [SUJET-HACKATHON.md](../documentation/SUJET-HACKATHON.md) · [WATCH-TOGETHER-PLAN.md](../documentation/WATCH-TOGETHER-PLAN.md)

---

## 1. Contexte

- **Sujet** : Pôle 1 · Sujet B — « Watch Together » : salon vidéo synchronisé, un présentateur pilote les lecteurs de tous les invités.
- **Choix stratégique** : tout construire **dans le repo SentinelGuard existant** (Next.js 14, Prisma/PostgreSQL, NextAuth, shadcn/ui) pour réutiliser auth, dashboard, sécurité et UI → maximise le bloc « une seule plateforme » du barème.

## 2. Décisions d'architecture validées

| Sujet | Décision |
|---|---|
| Emplacement | Dans le repo existant `anti_fraud_local_ready` |
| Temps réel | Serveur **Next.js custom + Socket.io** (même port 3000) |
| Auth socket | Décodage du cookie de session **NextAuth (JWT)** au handshake |
| Présentateur | **Hôte = créateur** de la salle ; transfert au plus ancien invité après 60 s de déconnexion |
| Invités | Lecteur **verrouillé**, suit le présentateur |
| Lecteur | **hls.js** + `<video>` (HLS/MP4) et **API YouTube IFrame** (liens YouTube) |
| Salles | État live **en mémoire** ; **cycle de vie + télémétrie persistés** en base |
| Pôle 3 (IA/Data) | Table `PlaybackEvent` = couture d'intégration (dataset de visionnage prêt à l'emploi) |

## 3. Fonctionnalités livrées

- 🎥 **Salles multi-utilisateurs** avec code d'accès (créer / rejoindre / lister)
- ⏯️ **Synchronisation** play / pause / seek (autorité serveur ; invités verrouillés)
- 👥 **Présence temps réel** + **calage automatique des arrivées tardives**
- 👑 **Transfert d'hôte** après 60 s de déconnexion (promotion du plus ancien invité)
- ⏹️ **Bouton « Terminer »** (présentateur) pour fermer la salle
- ⏱️ **Fermeture auto** après 10 min d'inactivité (salle à l'arrêt)
- 🎬 **Sources vidéo** : fichier local (`public/videos`), URL directe (.mp4/.m3u8), **YouTube**
- 🕓 **Historique des diffusions** : durée + participants (qui, arrivée, temps de présence)
- 🧭 **Navigation** entre Watch Together ↔ Dashboard ↔ Espace protégé
- 🗃️ **Journalisation** des événements de salle dans `SecurityLog` (visible au dashboard)

## 4. Fichiers créés

**Serveur temps réel**
- `server.js` — Next.js + Socket.io + auth socket + salles + transfert d'hôte + inactivité
- `server/room-store.js` — état en mémoire des salles

**Client / hooks / types**
- `hooks/use-socket.ts` — connexion Socket.io
- `lib/realtime/socket-events.ts` — contrat d'événements (client)
- `components/watch/player-types.ts` — interface commune de lecteur + détection YouTube
- `components/watch/hls-player.tsx` — lecteur HLS/MP4
- `components/watch/youtube-player.tsx` — lecteur YouTube (API IFrame)
- `components/watch/room-client.tsx` — logique de salle (socket + synchro)
- `components/watch/watch-lobby.tsx` — lobby (créer/rejoindre + choix source)
- `components/watch/participants-list.tsx` — présence live
- `components/watch/history-client.tsx` — historique des diffusions

**Pages & API**
- `app/watch/page.tsx` — lobby
- `app/watch/[code]/page.tsx` — salle
- `app/watch/history/page.tsx` — historique
- `app/watch-test/page.tsx` — page de diagnostic temps réel *(temporaire)*
- `app/api/rooms/route.ts` — créer / lister les salles
- `app/api/rooms/history/route.ts` — historique
- `app/api/videos/route.ts` — vidéos locales disponibles

**Assets** : `public/videos/video_test.mp4`

## 5. Fichiers modifiés

- `prisma/schema.prisma` — modèles `Room`, `RoomParticipant`, `PlaybackEvent` (+ relations `User`)
- `package.json` — `dev`→`node server.js` ; ajout `socket.io`, `socket.io-client`, `hls.js`
- `components/dashboard/dashboard-client.tsx` — bouton **Watch Together**
- `components/protected/protected-client.tsx` — bouton **Watch Together**

## 6. Modèle de données ajouté

- **`Room`** — salle (code, nom, hôte, source vidéo, isLive, endedAt)
- **`RoomParticipant`** — participation (rôle, joinedAt, leftAt) → historique
- **`PlaybackEvent`** — télémétrie (PLAY/PAUSE/SEEK/JOIN/LEAVE, position) → **couture Pôle 3**

## 7. Points techniques résolus

1. **WebSocket sur Next.js App Router** → serveur custom `node server.js` (Next + Socket.io même port).
2. **Auth socket `UNAUTHENTICATED`** → `getToken` (NextAuth v4) lit `req.cookies` (objet parsé), absent d'une requête socket brute : on **parse le cookie** nous-mêmes et on fournit `{ cookies, headers }`. Env chargé via `@next/env` pour la parité du secret.
3. **Lecture MP4 local** → le lecteur distingue `.m3u8` (hls.js) des fichiers vidéo classiques (natif).
4. **YouTube** → lecteur via **API IFrame** ; commandes reçues avant `onReady` mises en **file d'attente** ; **autoplay** : tentative avec son puis repli en sourdine + bouton « Activer le son ».

## 8. Reste à faire (J2 proposé)

- 🔒 Détection de **capture d'écran** intégrée à la salle (réutilise le Pôle 2 → dashboard)
- 🏷️ **Labels** lisibles des logs `ROOM_*` dans le dashboard
- 🎬 Vidéo **locale par défaut** (remplacer le flux de test)
- ✨ Polish démo (alerte live capture d'écran au présentateur)
- 🧹 Retrait de la page de diagnostic `app/watch-test`
