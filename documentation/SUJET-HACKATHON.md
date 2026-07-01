# Hackathon ESTIAM × 42c — 2026

> **Plateforme Vidéo B2B de Nouvelle Génération — « V-Secure & Collaborate »**
> Collaboration · Sécurité · Valoriser la vidéo en entreprise
> 42c × ESTIAM · Juillet 2026

---

## 1. Introduction — « Digital Game Changers »

42c accompagne les entreprises dans leur transformation numérique en plaçant la **responsabilité**, l'**agilité**, la **passion** et l'**expertise** au cœur de chaque projet. Ce sont ces mêmes valeurs qui inspirent le hackathon proposé aux étudiants d'ESTIAM.

**Chiffres clés**

| Indicateur | Valeur |
|---|---|
| Chiffre d'affaires | 7 M€ |
| Consultants en poste depuis plus de 15 ans | 91 % |
| Années de croissance | 20 |

**Les 4 valeurs**

- **Responsabilité** — RSE au cœur de son projet
- **Agilité** — Solutions sur mesure en adaptation continue
- **Passion** — Des Digital Game Changers passionnés de tech
- **Expertise** — Formation continue & excellence technique

---

## 2. Le défi

> **Comment diffuser la vidéo en entreprise avec efficacité, sécurité et intelligence ?**

- **Collaboration** — Travailler ensemble sur du contenu vidéo en temps réel : annoter, commenter, présenter à distance.
- **Sécurité** — Protéger les flux vidéo sensibles contre le piratage, le scraping et les accès non autorisés.
- **Intelligence** — Valoriser les contenus grâce à l'IA : transcription, analyse d'audience et prédiction de rétention.

---

## 3. Structure du hackathon — Trois pôles

**3 pôles pluridisciplinaires · 2 sujets par pôle**

| Pôle | Intitulé | Profils cibles |
|---|---|---|
| 1 | Application & Collaboration | DEV / Web |
| 2 | Infrastructure, Sécurité & Cloud | IT / DevOps / Cyber |
| 3 | Intelligence Artificielle & Data | DATA / IA |

---

## 4. Pôle 1 — Application & Collaboration

**Profils : DEV / Web**
Créer l'expérience utilisateur interactive et collaborative sur le lecteur vidéo.

### Sujet A — Lecteur de Revue Augmenté
- **Mission :** Interface React avec annotations dessinées (flèches, formes) et commentaires horodatés en temps réel via WebSockets.
- **Stack :** React · WebSockets · Canvas API
- **Livrable :** Composant autonome exportant les annotations en JSON

### Sujet B — Espace « Watch Together »
- **Mission :** Salon virtuel synchronisé pour des sessions de présentation vidéo internes. Un présentateur pilote les lecteurs de tous les invités à distance.
- **Stack :** WebSockets · HLS · JavaScript
- **Livrable :** App web — le présentateur pilote tous les lecteurs connectés

---

## 5. Pôle 2 — Infrastructure, Sécurité & Cloud

**Profils : IT / DevOps / Cyber**
Protéger la chaîne de diffusion contre le piratage et garantir la scalabilité de l'infrastructure.

### Sujet A — Architecture « Zero-Trust »
- **Mission :** Pipeline CDN avec flux HLS chiffrés AES-128. Serveur de clés éphémères : seuls les utilisateurs authentifiés (token temporaire) obtiennent la clé. **Aucun accès cloud n'est fourni ni attendu.**
- **Stack :** Terraform / CDK · AWS CloudFront ou Nginx (ou équivalent) · Docker
- **Livrable :** Script IaC de déploiement d'infrastructure streaming sécurisée

### Sujet B — Détection des Menaces & Anti-Scraping
- **Mission :** Système anti-fraude : détection de connexions simultanées anormales, blocage VPN/Proxies, détection navigateur des tentatives de capture d'écran.
- **Stack :** Python · Node.js · Firewall applicatif · IP Reputation API
- **Livrable :** Micro-pare-feu applicatif ou script de détection réseau temps réel

---

## 6. Pôle 3 — Intelligence Artificielle & Data

**Profils : DATA / IA**
Analyser le comportement des utilisateurs et valoriser le contenu vidéo grâce à l'IA.

### Sujet A — Pipeline d'Indexation Sémantique
- **Mission :** Pipeline vidéo : extraction audio, transcription (Whisper), traduction multilingue, génération de résumés, chapitres thématiques et mots-clés.
- **Stack :** Python · Whisper · FastAPI · LLM (GenAI / NLP)
- **Livrable :** Script Python ou API extrayant les métadonnées textuelles d'une vidéo

### Sujet B — Analyse d'Audience & Prédiction
- **Mission :** À partir de logs de visionnage (play, pause, abandons), identifier les zones d'ennui dans une vidéo et prédire le score de rétention.
- **Stack :** Python · Scikit-learn · Streamlit / BI Dashboard
- **Livrable :** Dashboard d'analyse BI + modèle prédictif documenté

---

## 7. Récapitulatif des sujets

| Pôle | Sujet A | Sujet B | Technos clés |
|---|---|---|---|
| **Pôle 1** | Lecteur de Revue Augmenté | Watch Together | React · Video.js · WebSockets |
| **Pôle 2** | Architecture Zero-Trust (CDN+HLS) | Détection Menaces & Anti-Scraping | Terraform · Docker · Python |
| **Pôle 3** | Pipeline Indexation Sémantique | Analyse Audience & Prédiction | Python · Whisper · Streamlit |

---

## 8. Barème d'évaluation (version définitive)

**Notation sur 100 pts → convertie sur 20 (pts ÷ 5) · Note finale = (Total brut ÷ 5) + Bonus autonomie**

| Bloc | Points | Critères |
|---|---|---|
| **Pôle 1 — App & Collaboration** | 15 pts | Fonctionnalité cœur · temps réel & robustesse · intégration lecteur (libre) · livrable structuré |
| **Pôle 2 — Infra, Sécurité & Cloud** | 15 pts | Chaîne diffusion/détection · mécanisme sécurité réel · reproductibilité locale · modèle de menace |
| **Pôle 3 — IA & Data** | 15 pts | Pipeline / modèle opérationnel · pertinence résultats · restitution exploitable · rigueur data |
| **B — Intégration & cohérence** | 10 pts | Les 3 pôles forment-ils une seule plateforme ? Parcours de bout en bout démontré. |
| **C — Démarche d'ingénierie** | 15 pts | Analyse du besoin (5) · Architecture argumentée (5) · Plan de réalisation (5) |
| **D — Innovation & valeur produit** | 10 pts | Idées au-delà du minimum : auto-modération, watermarking forensic, recommandation… |

### Blocs transversaux, jokers & bonus

| Bloc | Points | Critères |
|---|---|---|
| **E — Présentation & soutenance** | 10 pts | Clarté du pitch & démo (5) · Profondeur des réponses aux questions (5) |
| **F — Collaboration & gestion d'équipe** | 10 pts | Organisation & répartition des rôles (5) · Traçabilité Git — commits répartis (5) |
| **G — Jokers / aides journalisées** | 0 pt | Aucun point retiré. Les aides sont tracées (coup de pouce léger ou aide substantielle). Sert uniquement au départage en délibération entre deux groupes à note égale. |
| **H — Bonus autonomie (sur /20)** | 0 à +2 | +2 : aucune aide substantielle · +1 : recours ponctuel · 0 : recours fréquent (sans pénalité). Fondé sur le journal de sollicitations (bloc G). |

### Exemple chiffré

| Élément | Note |
|---|---|
| Pôle 1 | 12 / 15 |
| Pôle 2 | 11 / 15 |
| Pôle 3 | 10 / 15 |
| Intégration | 4 / 10 |
| Démarche | 12 / 15 |
| Innovation | 6 / 10 |
| Soutenance | 7 / 10 |
| Équipe | 7 / 10 |
| **Total brut** | **69 / 100** |
| Sur 20 (÷ 5) | 13,8 / 20 |
| Jokers (G) | 1 journalisé |
| **Note finale** | **13,8 / 20** |

---

## 9. Programme du hackathon

**Mardi 30 juin → Jeudi 2 juillet 2026 · 2 jours et demi**

1. **Mardi 30 juin — matin · Ouverture et lancement**
   Présentation des équipes, des pôles et des sujets · Constitution des groupes · Choix du sujet A ou B (ou les deux) par pôle · Kick-off.

2. **Mardi 30 juin (après-midi) → Mercredi 1ᵉʳ juillet (journée complète) · Phase de développement encadrée**
   Sprint actif sur les 3 pôles · Mentors disponibles pour accompagner et débloquer · Jokers/aides tracés · Conception, code, tests, itérations.

3. **Jeudi 2 juillet — 13h30 · Soutenances & démos live**
   Chaque équipe présente sa solution devant le jury · Démo live des livrables · 10 min de présentation + 5 min de Q&A · Clôture des livrables à 13h00.

4. **Jeudi 2 juillet — après les soutenances · Délibération & remise des prix**
   Le jury délibère et annonce les équipes gagnantes par catégorie · Retours et feedbacks des encadrants.

---

## Contact

Les référents 42c et ESTIAM accompagnent les équipes tout au long du hackathon.

*42c × ESTIAM · Hackathon « V-Secure & Collaborate » · 2026 — Bonne chance à toutes les équipes !*
