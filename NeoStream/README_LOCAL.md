# Lancer NeoStream en local

Ce dossier est une version nettoyée pour hébergement local.
Les secrets Abacus et le fichier `.env` original ont été retirés.

## Prérequis

- Node.js 20 recommandé
- Docker Desktop
- npm ou yarn

## Démarrage rapide

```bash
cp .env.example .env.local
```

Génère un secret NextAuth et remplace `CHANGE_ME...` dans `.env.local` :

```bash
openssl rand -base64 32
```

Lance PostgreSQL :

```bash
docker compose up -d db
```

Installe les dépendances :

```bash
npm install
```

Crée les tables et ajoute les comptes de démo :

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

Lance l'app :

```bash
npm run dev
```

Puis ouvre :

```text
http://localhost:3000
```

## Comptes de démo créés par le seed

- Admin : `admin@sentinel.fr` / `admin1234`
- Admin historique : `john@doe.com` / `johndoe123`
- Utilisateur : `utilisateur@sentinel.fr` / `user1234`

Pour une vraie démo publique, change ces mots de passe.

## Notes importantes

- L'app utilise `ip-api.com` pour la géolocalisation/réputation IP, donc certaines fonctions nécessitent Internet.
- La détection de capture d'écran côté navigateur n'est pas fiable à 100 %. Elle détecte surtout certains raccourcis clavier et l'impression.
- Le dashboard est accessible uniquement aux comptes avec `role = "admin"`.
