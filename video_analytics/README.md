# Analyse d'Audience & Prédiction — Pôle 3, Sujet B

Hackathon 42c × ESTIAM 2026 — "V-Secure & Collaborate"

## Mission

À partir de logs de visionnage vidéo (play, pause, seek, abandon), ce projet :
1. **Détecte les "zones d'ennui"** dans chaque vidéo (tronçons où l'audience décroche).
2. **Prédit le taux de rétention** d'une session à partir du comportement observé en début de visionnage.

Livrable : un dashboard **Streamlit** interactif (BI) + un modèle prédictif **scikit-learn** documenté.

## Démarrage rapide

```bash
pip install -r requirements.txt
streamlit run app.py
```

Le dashboard s'ouvre sur `http://localhost:8501` avec des données de
démonstration déjà générées (`data/viewing_logs.csv`).

## Intégration avec le reste de l'équipe

- **Pôle 1 (lecteur vidéo)** : le contrat de données est défini dans
  [`data/SCHEMA_LOGS.md`](data/SCHEMA_LOGS.md). Dès que le lecteur émet des
  logs conformes à ce format, ils peuvent être importés directement dans le
  dashboard via l'onglet **Importer des logs** (aucun code à modifier).
- **Pôle 2 (SentinelGuard, anti-fraude)** : projet indépendant (stack
  Next.js/Prisma/PostgreSQL), sans dépendance de données avec ce module.
  L'intégration entre les 3 pôles se fait au niveau du pitch/démo : les
  trois briques illustrent ensemble le cycle de vie complet d'une vidéo sur
  la plateforme (sécurité de l'accès → lecture/collaboration → analyse).
- **Pôle 3, Sujet A (indexation sémantique)** : les chapitres/résumés
  générés par le pipeline Whisper pourraient enrichir la page "Zones
  d'ennui" (ex. afficher le titre du chapitre concerné par une zone
  détectée) — piste d'amélioration si le temps le permet.

## Régénérer les données ou réentraîner le modèle

```bash
python data/generate_logs.py     # régénère un dataset synthétique
python model/train_model.py      # réentraîne le modèle et met à jour metrics_report.md
```

## Documentation complète

Voir [`../documentation/Pole3-Analyse-Audience.pdf`](../documentation/Pole3-Analyse-Audience.pdf) (schéma de logs, méthodologie,
lancement du projet), ou directement :
- [`data/SCHEMA_LOGS.md`](data/SCHEMA_LOGS.md) — schéma de logs
- [`model/metrics_report.md`](model/metrics_report.md) — performance du modèle
