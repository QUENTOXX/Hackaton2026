# Modèle de menace — NeoStream / SentinelGuard

> Plateforme vidéo B2B « V-Secure & Collaborate » — Pôle 2 (Sécurité).
> Ce document décrit **ce qu'on protège**, **contre quoi**, **comment**, et le **risque résiduel** assumé. Il sert de support au critère « modèle de menace » du barème.

---

## 1. Actifs à protéger

| Actif | Pourquoi c'est sensible |
|---|---|
| **Flux vidéo confidentiel** (Watch Together) | Contenu interne diffusé en direct — cible de fuite / captation. |
| **Comptes & sessions** (NextAuth + `UserSession`) | Accès à la plateforme ; un compte admin ouvre tout le centre de sécurité. |
| **Journal de sécurité** (`SecurityLog`) | Preuve forensic ; doit rester fiable et non falsifiable côté produit. |
| **Télémétrie de visionnage** (`PlaybackEvent`) | Données comportementales exploitées par le Pôle 3. |
| **Disponibilité du service** | Un flood / scraping massif dégrade l'expérience temps réel. |

---

## 2. Périmètre & hypothèses

- Déploiement **local** (hackathon) : `node server.js` héberge Next.js + Socket.io sur le port 3000, PostgreSQL en Docker.
- **Hypothèse de confiance** : le poste hôte et le réseau local sont de confiance (loopback / IP privées exemptées). En production, la confiance se déplacerait vers un reverse-proxy.
- **Hors périmètre** (assumé) : sécurité de l'OS hôte, chiffrement du transport (TLS géré par un proxy en prod), DRM matériel, protection contre une caméra filmant l'écran.

---

## 3. Menaces → mitigations → risque résiduel

| # | Menace (STRIDE) | Vecteur | Mitigation implémentée | Risque résiduel |
|---|---|---|---|---|
| T1 | **Accès non autorisé** (Spoofing) | Vol/essai d'identifiants | NextAuth (JWT), mots de passe **bcrypt**, auth obligatoire au **handshake Socket.io** | Vol de session hors périmètre (pas de MFA) |
| T2 | **Brute-force login** (Spoofing) | Essais répétés de mots de passe | **Verrou temporaire** (5 échecs / email+IP → 15 min) + **auto-blocage** réseau de l'IP publique | Attaque distribuée (botnet multi-IP) atténuée mais non éliminée |
| T3 | **Partage de compte / session volée** (Spoofing) | Même compte depuis 2 lieux | Détection **connexions simultanées** (IP distinctes) + **geo-velocity** (voyage impossible) | Deux accès dans la même ville non distingués |
| T4 | **Anonymisation / contournement géo** (Spoofing) | VPN, proxy, Tor, datacenter | **IP Reputation** temps réel (`ip-api.com`) + liste noire (Tor/hébergeurs) | Dépend d'un service tiers (rate-limit, faux négatifs) |
| T5 | **Scraping / DoS applicatif** (DoS) | Flood HTTP ou d'events temps réel | **Pare-feu applicatif** (rate-limit HTTP) + **rate-limit Socket.io** par socket | Attaque volumétrique réseau (hors couche applicative) |
| T6 | **Accès depuis une IP hostile** (Elevation) | IP déjà identifiée malveillante | **Liste noire** appliquée par le pare-feu **avant** Next (403) ; auto-alimentée | Rotation d'IP par l'attaquant |
| T7 | **Exfiltration du contenu vidéo** (Info. disclosure) | Capture d'écran, téléchargement, enregistrement | **Watermark forensic** (email+heure incrustés), détection capture, lecteur `nodownload`/no-PiP/clic-droit bloqué, lecteur invité **verrouillé** | Filmer l'écran reste possible → le **watermark** assure la traçabilité |
| T8 | **Prise de contrôle de la diffusion** (Tampering/Elevation) | Un invité tente de piloter le lecteur | **Autorité serveur** : seuls les events `presenter:*` du `hostId` sont acceptés | — |
| T9 | **Sessions fantômes** (fiabilité détection) | Sessions jamais fermées | **Expiration** automatique après 30 min d'inactivité | Fenêtre d'inactivité avant expiration |
| T10 | **Falsification / confusion du journal** (Repudiation) | Confondre logs de test et réels | **Séparation Démo/Réel** (`metadata.simulated`) + purge **sélective** (réels uniquement) | Un admin malveillant reste hors modèle |
| T11 | **Abus de privilèges admin** (Elevation) | Suppression/rétrogradation dangereuse | **Garde-fous** : pas d'auto-suppression, pas de suppression/rétrogradation du **dernier admin** | Admin de confiance supposé |

---

## 4. Défense en profondeur (couches)

```
Requête ──▶ [Pare-feu applicatif]  liste noire + rate-limit + exemption liste blanche/loopback
        ──▶ [Auth NextAuth / Socket]  JWT + rôle, handshake authentifié
        ──▶ [Détections]  brute-force · simultané · geo-velocity · VPN/proxy · capture
        ──▶ [Réponses]  auto-blocage · verrou de compte · alertes live · journalisation
        ──▶ [Forensic]  watermark incrusté · SecurityLog horodaté (Démo/Réel)
```

---

## 5. Choix assumés & limites

- **Confiance au `X-Forwarded-For` en local** : indispensable pour démontrer blocage/geo sans multi-machines ; en production, ne faire confiance qu'au proxy.
- **Détection capture = navigateur** : par nature partielle (raccourcis clavier, impression). Le **watermark forensic** est la vraie parade contre la captation, en déplaçant la protection de la *prévention* vers la *traçabilité/dissuasion*.
- **Compteurs anti-brute-force en mémoire** : simples, sans persistance ; réinitialisés au redémarrage (acceptable pour la démo).
- **IP Reputation tierce** : `ip-api.com` gratuit (rate-limité) ; en production, service authentifié + cache.

---

## 6. Pistes d'évolution (hors périmètre hackathon)

MFA/2FA · chiffrement HLS AES-128 à clé éphémère (Pôle 2 Sujet A) · flux OSINT (listes Tor/datacenter) · persistance distribuée (Redis) des compteurs et de l'état temps réel · en-têtes de sécurité (CSP) · watermark stéganographique invisible.
