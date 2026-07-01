# Schéma des logs de visionnage — Contrat d'intégration

Ce document définit le format attendu par le module IA & Data (Pôle 3 – Sujet B)
pour analyser l'audience et prédire la rétention. Il sert de **contrat** entre
le lecteur vidéo (Pôle 1) et le dashboard d'analyse (ce projet).

## Format : CSV ou JSON Lines, un événement par ligne

| Champ           | Type       | Obligatoire | Description                                                              |
|-----------------|-----------|:-----------:|----------------------------------------------------------------------------|
| `session_id`    | string     | Oui | Identifiant unique de la session de visionnage (1 session = 1 visionnage d'une vidéo par un utilisateur) |
| `user_id`       | string     | Oui | Identifiant de l'utilisateur (peut être anonymisé/pseudonymisé)          |
| `video_id`      | string     | Oui | Identifiant de la vidéo regardée                                          |
| `video_duration_s` | float  | Oui | Durée totale de la vidéo en secondes                                     |
| `event_type`    | enum       | Oui | Un de : `play`, `pause`, `resume`, `seek`, `buffering`, `abandon`, `complete` |
| `video_time_s`  | float      | Oui | Position de lecture dans la vidéo (en secondes) au moment de l'événement |
| `event_time`    | datetime (ISO 8601) | Oui | Horodatage réel de l'événement (ex : `2026-07-01T14:32:05Z`)     |
| `device`        | string     | Non | `desktop`, `mobile`, `tablet`                                             |
| `playback_rate` | float      | Non | Vitesse de lecture (1.0 = normale)                                        |

### Sémantique des `event_type`

- **play** : démarrage initial de la lecture
- **pause** : mise en pause (signal fort d'un potentiel décrochage d'attention si elle survient souvent au même endroit)
- **resume** : reprise après pause
- **seek** : déplacement dans la timeline (avance rapide = ennui probable ; retour arrière = intérêt/incompréhension)
- **buffering** : coupure technique (à exclure de l'analyse d'ennui, c'est un problème réseau, pas un comportement utilisateur)
- **abandon** : fin de session sans avoir terminé la vidéo (fermeture d'onglet, timeout d'inactivité)
- **complete** : vidéo regardée jusqu'au bout

### Règle de reconstruction d'une session

Une session est complète dès qu'on trouve un événement `abandon` ou `complete`.
Le **taux de rétention de la session** = `video_time_s` du dernier événement / `video_duration_s`.

## Exemple (CSV)

```csv
session_id,user_id,video_id,video_duration_s,event_type,video_time_s,event_time,device,playback_rate
s_00042,u_128,v_007,300,play,0,2026-06-30T09:12:00Z,desktop,1.0
s_00042,u_128,v_007,300,pause,145,2026-06-30T09:14:35Z,desktop,1.0
s_00042,u_128,v_007,300,resume,145,2026-06-30T09:14:52Z,desktop,1.0
s_00042,u_128,v_007,300,abandon,168,2026-06-30T09:15:20Z,desktop,1.0
```

## Comment le Pôle 1 doit envoyer les données (2 options)

1. **Fichier batch (le plus simple pour la démo)** : exporter les logs en CSV
   toutes les X minutes et les déposer dans un dossier partagé / uploader
   dans le dashboard via l'onglet "Importer des logs".
2. **API (pour aller plus loin après le hackathon)** : `POST /events` avec un
   JSON respectant les mêmes champs, un événement par requête ou par batch.
   Le module Data pourra alors les stocker et rafraîchir le dashboard en quasi
   temps réel.

Pour le hackathon, l'intégration se fait via **upload manuel de CSV** dans le
dashboard (option 1) — l'API n'est pas requise mais le schéma est prêt pour ça.
