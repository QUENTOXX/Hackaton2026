# Hackathon ESTIAM × 42c — 2026

Plateforme vidéo B2B **« V-Secure & Collaborate »**.
Ce dépôt contient **NeoStream**, la plateforme vidéo sécurisée (dossier [`NeoStream/`](NeoStream)), et son module d'analyse d'audience (dossier [`video_analytics/`](video_analytics)). Il réunit les trois pôles :

- **NeoStream · Watch Together** (Pôle 1 · Sujet B) : salons vidéo synchronisés — un présentateur pilote en temps réel les lecteurs de tous les invités (HLS / MP4 / YouTube), avec import de vidéos locales.
- **SentinelGuard** (Pôle 2) : le module sécurité/admin — authentification, détection anti-fraude et dashboard de supervision.
- **Analyse d'audience** (Pôle 3 · Sujet B) : dashboard Streamlit + modèle scikit-learn (zones d'ennui & prédiction de rétention), alimenté par la télémétrie réelle de Watch Together.

Documentation : [documentation/SUJET-HACKATHON.md](documentation/SUJET-HACKATHON.md) · [documentation/WATCH-TOGETHER-PLAN.md](documentation/WATCH-TOGETHER-PLAN.md) · [documentation/](documentation)

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
   - **Vidéo locale** : soit déposer des fichiers dans `public/videos/`, soit cliquer **« Importer une vidéo »** dans le lobby (upload sécurisé : `mp4, mov, mkv, webm, ogg, m4v, avi`, max 512 Mo).
   - **URL directe** : lien vers un fichier `.mp4` ou un flux `.m3u8`.
   - **YouTube** : coller un lien `youtube.com/watch?v=…` ou `youtu.be/…`.
   > Pour la démo, privilégier **mp4** : `mkv`/`avi` ne sont pas lus nativement par tous les navigateurs.
3. **Rejoindre** : un invité entre le code ; son lecteur suit automatiquement le présentateur.
4. **Historique** (`/watch/history`) : sessions terminées, durée et temps de présence des participants.

**Comportements automatiques** : transfert d'hôte après 60 s de déconnexion du présentateur ; fermeture de la salle après 10 min d'inactivité.

---

## Analyse d'audience (Pôle 3)

Le module `video_analytics/` (Streamlit + scikit-learn) analyse les **vraies** données de visionnage de Watch Together : zones d'ennui et prédiction de rétention.

**Depuis l'application (recommandé)** — en tant qu'admin :
1. Ouvrir l'espace **Analytics** (bouton dans le dashboard, ou `/analytics`).
2. Cliquer **« Démarrer le module d'analyse »** → le dashboard Streamlit s'embarque directement dans la page.
3. **Exporter les logs (CSV)** puis, dans Streamlit, onglet **« Importer des logs »**, déposer le fichier pour analyser les données réelles.

> Prérequis (une seule fois) : installer les dépendances Python du module.
> ```powershell
> cd video_analytics
> python -m venv venv          # optionnel mais conseillé
> venv\Scripts\activate        # (WSL/bash : source venv/bin/activate)
> pip install -r requirements.txt
> ```
> Le bouton « Démarrer » lance le module (il n'installe pas les dépendances). Lancement manuel équivalent : `streamlit run app.py` (port 8501).

**Variable d'environnement (optionnelle)** — si le module tourne sur une autre URL que `http://localhost:8501`, la définir dans `NeoStream/.env` :

```env
NEXT_PUBLIC_ANALYTICS_URL="http://localhost:8501"
```

Détail du contrat de données : [`video_analytics/data/SCHEMA_LOGS.md`](video_analytics/data/SCHEMA_LOGS.md).

---

## Dépannage

| Problème | Solution |
|---|---|
| `@prisma/client did not initialize` | Lancer `npx prisma generate` (serveur arrêté) |
| `EPERM` pendant `prisma generate` (Windows/OneDrive) | Arrêter le serveur, suspendre la synchro OneDrive quelques secondes, puis relancer |
| Conflit de dépendances à l'install | Utiliser `npm install --legacy-peer-deps` (au besoin, supprimer d'abord `node_modules` et `package-lock.json`) |
| Vidéo YouTube muette chez l'invité | Politique *autoplay* du navigateur : cliquer « Activer le son » |
| Docker/WSL capricieux | `wsl --shutdown` puis relancer Docker Desktop |
| « Démarrer le module » échoue | Installer d'abord les dépendances : `pip install -r requirements.txt` dans `video_analytics/`, et vérifier que `python` est accessible |
| Dashboard Streamlit non affiché dans l'iframe | Cliquer « Ouvrir dans un onglet » ; vérifier que le module tourne sur le port 8501 |
