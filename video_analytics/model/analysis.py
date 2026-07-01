"""
Module central d'analyse des logs de visionnage.

Deux responsabilités :
1. Reconstruire, à partir des logs événementiels bruts, une table "sessions"
   (1 ligne = 1 visionnage complet, avec son taux de rétention final).
2. Détecter les "zones d'ennui" par vidéo : découpage en tronçons de temps
   (buckets) et calcul, pour chaque tronçon, d'un score d'ennui basé sur :
     - le taux de décrochage (abandon) dans ce tronçon
     - la densité de pauses dans ce tronçon
     - la densité de "seek forward" (avance rapide) dans ce tronçon
     - le taux de spectateurs encore présents (courbe de rétention)

Ce module est utilisé à la fois par le dashboard Streamlit et par le script
d'entraînement du modèle (model/train_model.py).
"""

import pandas as pd
import numpy as np

REQUIRED_COLUMNS = [
    "session_id", "user_id", "video_id", "video_duration_s",
    "event_type", "video_time_s", "event_time",
]


def load_logs(path_or_buffer) -> pd.DataFrame:
    """Charge et valide un fichier de logs au format défini dans SCHEMA_LOGS.md."""
    df = pd.read_csv(path_or_buffer)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"Colonnes manquantes dans le fichier de logs : {missing}. "
            f"Voir data/SCHEMA_LOGS.md pour le format attendu."
        )
    df["event_time"] = pd.to_datetime(df["event_time"], errors="coerce")
    df["video_time_s"] = pd.to_numeric(df["video_time_s"], errors="coerce")
    if "device" not in df.columns:
        df["device"] = "inconnu"
    if "playback_rate" not in df.columns:
        df["playback_rate"] = 1.0
    df = df.dropna(subset=["video_time_s", "session_id", "video_id"])
    return df


def build_sessions_table(logs: pd.DataFrame) -> pd.DataFrame:
    """Reconstruit une ligne par session avec ses caractéristiques et son taux de rétention final."""
    rows = []
    for session_id, g in logs.groupby("session_id"):
        g = g.sort_values("video_time_s")
        duration = g["video_duration_s"].iloc[0]
        video_id = g["video_id"].iloc[0]
        user_id = g["user_id"].iloc[0]
        device = g["device"].mode().iloc[0] if not g["device"].isna().all() else "inconnu"
        playback_rate = g["playback_rate"].mean()

        max_time_reached = g["video_time_s"].max()
        n_pause = (g["event_type"] == "pause").sum()
        n_seek = (g["event_type"] == "seek").sum()
        n_buffering = (g["event_type"] == "buffering").sum()
        ended_type = g["event_type"].iloc[-1]
        completed = 1 if (ended_type == "complete" or max_time_reached >= duration * 0.98) else 0

        # comportement "précoce" (35 premières % de la vidéo) : utile pour prédire tôt.
        # On utilise des taux (par minute) plutôt que des comptages bruts pour rester
        # comparable entre vidéos courtes et longues, + le délai avant le premier
        # signal de décrochage (pause ou seek), qui est un signal fort d'ennui précoce.
        early_cutoff = duration * 0.5
        early = g[g["video_time_s"] <= early_cutoff]
        early_minutes = max(early_cutoff / 60, 0.1)
        early_pause_rate = (early["event_type"] == "pause").sum() / early_minutes
        early_seek_rate = (early["event_type"] == "seek").sum() / early_minutes

        early_disengage_events = early[early["event_type"].isin(["pause", "seek"])]
        if not early_disengage_events.empty:
            time_to_first_disengage = early_disengage_events["video_time_s"].min() / duration
        else:
            time_to_first_disengage = 1.0  # aucun signal précoce = valeur "neutre" maximale

        retention_rate = min(1.0, max_time_reached / duration) if duration else np.nan

        rows.append({
            "session_id": session_id,
            "user_id": user_id,
            "video_id": video_id,
            "video_duration_s": duration,
            "device": device,
            "playback_rate": playback_rate,
            "n_pause": n_pause,
            "n_seek": n_seek,
            "n_buffering": n_buffering,
            "early_pause_rate": early_pause_rate,
            "early_seek_rate": early_seek_rate,
            "time_to_first_disengage": time_to_first_disengage,
            "max_time_reached_s": max_time_reached,
            "retention_rate": retention_rate,
            "completed": completed,
        })
    return pd.DataFrame(rows)


def detect_boring_zones(logs: pd.DataFrame, video_id: str, n_buckets: int = 20) -> pd.DataFrame:
    """
    Calcule, pour une vidéo donnée, un score d'ennui par tronçon de temps.

    Le score d'ennui combine (normalisés 0-1 puis moyennés) :
      - le taux d'abandon dans le tronçon (nb abandons / nb sessions actives à ce moment)
      - la densité de pauses dans le tronçon
      - la densité de seek-forward dans le tronçon
      - la chute de rétention (dérivée négative de la courbe de rétention)
    """
    g = logs[logs["video_id"] == video_id].copy()
    if g.empty:
        return pd.DataFrame()
    duration = g["video_duration_s"].iloc[0]
    bucket_size = duration / n_buckets
    g["bucket"] = np.minimum((g["video_time_s"] // bucket_size).astype(int), n_buckets - 1)

    n_sessions = g["session_id"].nunique()

    buckets = []
    for b in range(n_buckets):
        bg = g[g["bucket"] == b]
        t_start, t_end = b * bucket_size, (b + 1) * bucket_size

        n_pause = (bg["event_type"] == "pause").sum()
        n_seek = (bg["event_type"] == "seek").sum()
        n_abandon = (bg["event_type"] == "abandon").sum()

        # spectateurs encore présents à ce tronçon = sessions ayant atteint ce temps
        still_present = (g["video_time_s"] >= t_start).groupby(g["session_id"]).any().sum()
        retention_pct = still_present / n_sessions if n_sessions else 0

        buckets.append({
            "video_id": video_id,
            "bucket": b,
            "t_start_s": round(t_start, 1),
            "t_end_s": round(t_end, 1),
            "pause_count": n_pause,
            "seek_count": n_seek,
            "abandon_count": n_abandon,
            "retention_pct": retention_pct,
        })

    bdf = pd.DataFrame(buckets)
    bdf["retention_drop"] = (-bdf["retention_pct"].diff()).clip(lower=0).fillna(0)

    def norm(s):
        rng = s.max() - s.min()
        return (s - s.min()) / rng if rng > 0 else s * 0

    bdf["boredom_score"] = (
        norm(bdf["pause_count"]) * 0.30
        + norm(bdf["seek_count"]) * 0.20
        + norm(bdf["abandon_count"]) * 0.25
        + norm(bdf["retention_drop"]) * 0.25
    )
    return bdf


def flag_boring_zones(bucket_df: pd.DataFrame, threshold: float = 0.55) -> pd.DataFrame:
    """Retourne les tronçons considérés comme des zones d'ennui (score au-dessus du seuil)."""
    return bucket_df[bucket_df["boredom_score"] >= threshold].copy()
