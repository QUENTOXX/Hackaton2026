"""
Génère un dataset synthétique réaliste de logs de visionnage vidéo.

Principe : pour chaque vidéo, on définit 1 ou 2 "zones d'ennui" cachées
(segments où l'engagement chute). Le simulateur de sessions utilisateur
a une probabilité de pause/abandon/seek plus élevée dans ces zones, ce qui
permet de valider que le module de détection (detect_boring_zones.py)
retrouve bien ces zones à partir des seuls logs, sans les connaître à l'avance.

Usage :
    python generate_logs.py
Produit :
    data/viewing_logs.csv        (logs événementiels bruts, format = SCHEMA_LOGS.md)
    data/videos_metadata.csv     (métadonnées des vidéos, dont les zones d'ennui "vérité terrain")
"""

import csv
import random
from datetime import datetime, timedelta

random.seed(42)

N_VIDEOS = 12
SESSIONS_PER_VIDEO = (120, 260)  # min, max sessions simulées par vidéo
DEVICES = ["desktop", "mobile", "tablet"]
DEVICE_WEIGHTS = [0.55, 0.35, 0.10]
CATEGORIES = ["formation", "onboarding", "webinar", "produit", "communication_interne"]

VIDEO_TITLES = [
    "Onboarding nouveaux collaborateurs", "Formation cybersécurité niveau 1",
    "Webinar résultats Q2", "Présentation produit V-Secure", "Point sécurité mensuel",
    "Formation RGPD", "Démo plateforme collaborative", "Réunion stratégie 2026",
    "Formation management à distance", "Retour d'expérience client",
    "Introduction à l'IA en entreprise", "Communication direction générale",
]


def make_video_catalog():
    """Crée le catalogue de vidéos avec, pour chacune, 1-2 zones d'ennui cachées."""
    videos = []
    for i in range(N_VIDEOS):
        duration = random.choice([180, 240, 300, 420, 600, 900])  # 3 à 15 min
        n_boring_zones = random.choice([1, 1, 2])
        boring_zones = []
        for _ in range(n_boring_zones):
            start_ratio = random.uniform(0.25, 0.75)
            width_ratio = random.uniform(0.08, 0.18)
            start = round(duration * start_ratio)
            end = min(duration - 5, round(duration * (start_ratio + width_ratio)))
            if end > start:
                boring_zones.append((start, end))
        videos.append({
            "video_id": f"v_{i:03d}",
            "title": VIDEO_TITLES[i % len(VIDEO_TITLES)],
            "category": random.choice(CATEGORIES),
            "duration_s": duration,
            "boring_zones": boring_zones,  # vérité terrain, à ne PAS donner au modèle
        })
    return videos


def in_boring_zone(t, boring_zones):
    return any(start <= t <= end for start, end in boring_zones)


def simulate_session(video, session_idx, base_time):
    """Simule les événements d'une session de visionnage pour une vidéo donnée."""
    duration = video["duration_s"]
    boring_zones = video["boring_zones"]
    session_id = f"s_{video['video_id']}_{session_idx:04d}"
    user_id = f"u_{random.randint(1, 900):04d}"
    device = random.choices(DEVICES, weights=DEVICE_WEIGHTS)[0]
    playback_rate = random.choice([1.0, 1.0, 1.0, 1.25, 1.5])

    events = []
    t = 0.0
    event_time = base_time + timedelta(seconds=random.randint(0, 2_000_000))

    events.append((session_id, user_id, video["video_id"], duration, "play", 0, event_time, device, playback_rate))

    # profil d'engagement global de l'utilisateur (certains décrochent plus vite que d'autres).
    # Distribution volontairement bimodale (utilisateurs "engagés" vs "désengagés") pour
    # refléter des comportements contrastés réalistes et donner un signal exploitable
    # dès le début de la session, plutôt qu'un continuum trop lisse et peu prédictible.
    if random.random() < 0.6:
        engagement = random.uniform(0.7, 0.95)   # profil engagé
    else:
        engagement = random.uniform(0.15, 0.45)  # profil désengagé
    device_penalty = {"mobile": 1.35, "tablet": 1.1, "desktop": 1.0}[device]

    # signal comportemental précoce et marqué : un utilisateur désengagé montre souvent
    # une "fébrilité" dès les premières secondes (petite pause exploratoire, avance rapide
    # pour voir où ça va). C'est un pattern réaliste (on le voit dans les vraies plateformes
    # de e-learning) qu'on modélise explicitement ici pour donner au modèle un vrai signal
    # précoce à apprendre, plutôt que de tout laisser au hasard pas-à-pas.
    if engagement < 0.5 and random.random() < 0.65:
        early_fidget_t = random.uniform(duration * 0.03, duration * 0.15)
        events.append((session_id, user_id, video["video_id"], duration, "pause", round(early_fidget_t, 1), event_time, device, playback_rate))
        event_time += timedelta(seconds=random.uniform(2, 8))
        events.append((session_id, user_id, video["video_id"], duration, "resume", round(early_fidget_t, 1), event_time, device, playback_rate))
        t = early_fidget_t

    step = max(3, duration // 40)
    while t < duration:
        t += step
        if t >= duration:
            break

        boring = in_boring_zone(t, boring_zones)
        engagement_factor = (1.7 - engagement) * device_penalty  # faible engagement -> beaucoup plus de pauses/seeks/abandons, partout
        p_pause = (0.02 if not boring else 0.11) * engagement_factor
        p_seek_forward = (0.01 if not boring else 0.05) * engagement_factor
        p_abandon = (0.006 if not boring else 0.045) * (engagement_factor ** 1.6)

        roll = random.random()
        event_time += timedelta(seconds=step * random.uniform(0.8, 1.3) / playback_rate)

        if roll < p_abandon:
            events.append((session_id, user_id, video["video_id"], duration, "abandon", round(t, 1), event_time, device, playback_rate))
            return events
        elif roll < p_abandon + p_pause:
            events.append((session_id, user_id, video["video_id"], duration, "pause", round(t, 1), event_time, device, playback_rate))
            pause_len = random.uniform(3, 25)
            event_time += timedelta(seconds=pause_len)
            events.append((session_id, user_id, video["video_id"], duration, "resume", round(t, 1), event_time, device, playback_rate))
        elif roll < p_abandon + p_pause + p_seek_forward:
            jump = random.uniform(6, 15)
            t += jump
            t = min(t, duration - 1)
            events.append((session_id, user_id, video["video_id"], duration, "seek", round(t, 1), event_time, device, playback_rate))

    events.append((session_id, user_id, video["video_id"], duration, "complete", duration, event_time, device, playback_rate))
    return events


def main():
    videos = make_video_catalog()
    base_time = datetime(2026, 6, 20, 8, 0, 0)

    all_events = []
    for video in videos:
        n_sessions = random.randint(*SESSIONS_PER_VIDEO)
        for i in range(n_sessions):
            all_events.extend(simulate_session(video, i, base_time))

    all_events.sort(key=lambda r: r[5])  # tri par event_time

    with open("viewing_logs.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "session_id", "user_id", "video_id", "video_duration_s",
            "event_type", "video_time_s", "event_time", "device", "playback_rate",
        ])
        for row in all_events:
            row = list(row)
            row[6] = row[6].strftime("%Y-%m-%dT%H:%M:%SZ")
            writer.writerow(row)

    with open("videos_metadata.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["video_id", "title", "category", "duration_s", "boring_zones_ground_truth"])
        for v in videos:
            zones_str = ";".join(f"{s}-{e}" for s, e in v["boring_zones"])
            writer.writerow([v["video_id"], v["title"], v["category"], v["duration_s"], zones_str])

    print(f"{len(all_events)} événements générés sur {len(videos)} vidéos.")
    print("Fichiers créés : viewing_logs.csv, videos_metadata.csv")


if __name__ == "__main__":
    main()
