# Hackathon ESTIAM × 42c — 2026

Plateforme vidéo B2B **« V-Secure & Collaborate »**.
Ce dépôt contient **NeoStream**, la plateforme vidéo sécurisée, dans le dossier [`NeoStream/`](NeoStream). Elle réunit deux volets :

- **NeoStream · Watch Together** (Pôle 1 · Sujet B) : salons vidéo synchronisés — un présentateur pilote en temps réel les lecteurs de tous les invités (HLS / MP4 / YouTube).
- **SentinelGuard** (Pôle 2) : le module sécurité/admin — authentification, détection anti-fraude et dashboard de supervision.

Documentation : [SUJET-HACKATHON.md](SUJET-HACKATHON.md) · [WATCH-TOGETHER-PLAN.md](WATCH-TOGETHER-PLAN.md) · [.Help/RECAP-SESSION.md](.Help/RECAP-SESSION.md)

---

## Stack technique

Next.js 14 (App Router) · React 18 · TypeScript · **Socket.io** · **hls.js** · Prisma · PostgreSQL (Docker) · NextAuth · Tailwind / shadcn-ui

---

## Prérequis

- **Node.js 20**
- **Docker Desktop** (pour la base PostgreSQL)
- **npm**

> Fonctionne sous **Windows (PowerShell)** ou **Ubuntu WSL2**. Les commandes ci-dessous sont pour PowerShell ; l'équivalent bash (WSL) est indiqué quand il diffère.

---

## Démarrage de A à Z

Toutes les commandes se lancent **depuis le dossier de l'application** :

```powershell
cd NeoStream
```

### 1. Fichier d'environnement

Copier le modèle :

```powershell
Copy-Item .env.example .env
```
```bash
# WSL / bash
cp .env.example .env
```

Ouvrir `.env` et y placer un **secret NextAuth** (chaîne aléatoire) dans `NEXTAUTH_SECRET`.
Génération du secret :

```powershell
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```
```bash
# WSL / bash
openssl rand -base64 32
```

Le fichier `.env` doit contenir :

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anti_fraud_local?schema=public"
NEXTAUTH_SECRET="votre_secret_genere"
NEXTAUTH_URL="http://localhost:3000"
```

### 2. Base de données PostgreSQL (Docker)

Démarrer uniquement le service `db` :

```powershell
docker compose up -d db
```

Vérifier que le conteneur tourne :

```powershell
docker ps
```

### 3. Dépendances

```powershell
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` contourne un conflit de dépendances du projet généré.

### 4. Initialisation de Prisma (client + tables + données de démo)

```powershell
npx prisma generate
npx prisma db push
npx prisma db seed
```

> Le *seed* crée les comptes de démonstration (voir [Comptes de test](#comptes-de-test)).

### 5. Lancement de l'application

```powershell
npm run dev
```

`npm run dev` démarre le **serveur custom** (`server.js`) qui héberge Next.js **et** Socket.io sur le même port. L'application est disponible sur :

```
http://localhost:3000
```

---

## Enchaînement minimal (relance rapide)

```powershell
cd NeoStream
docker compose up -d db
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@sentinel.fr` | `admin1234` |
| Utilisateur | `utilisateur@sentinel.fr` | `user1234` |

---

## Utilisation — Watch Together

1. Se connecter, puis ouvrir **Watch Together** (`/watch`).
2. **Créer une salle** : choisir une source vidéo, puis partager le **code** généré.
   - **Vidéo locale** : déposer des fichiers dans `public/videos/` (ils apparaissent dans le sélecteur).
   - **URL directe** : lien vers un fichier `.mp4` ou un flux `.m3u8`.
   - **YouTube** : coller un lien `youtube.com/watch?v=…` ou `youtu.be/…`.
3. **Rejoindre** : un invité entre le code ; son lecteur suit automatiquement le présentateur.
4. **Historique** (`/watch/history`) : sessions terminées, durée et temps de présence des participants.

**Comportements automatiques** : transfert d'hôte après 60 s de déconnexion du présentateur ; fermeture de la salle après 10 min d'inactivité.

---

## Dépannage

| Problème | Solution |
|---|---|
| `@prisma/client did not initialize` | Lancer `npx prisma generate` (serveur arrêté) |
| `EPERM` pendant `prisma generate` (Windows/OneDrive) | Arrêter le serveur, suspendre la synchro OneDrive quelques secondes, puis relancer |
| Conflit de dépendances à l'install | Utiliser `npm install --legacy-peer-deps` (au besoin, supprimer d'abord `node_modules` et `package-lock.json`) |
| Vidéo YouTube muette chez l'invité | Politique *autoplay* du navigateur : cliquer « Activer le son » |
| Docker/WSL capricieux | `wsl --shutdown` puis relancer Docker Desktop |
