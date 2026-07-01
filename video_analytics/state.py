"""
Utilitaires partagés entre les pages du dashboard Streamlit.

Centralise le chargement des logs (données de démo par défaut, ou fichier
importé par l'utilisateur via la page "Importer des logs") dans
`st.session_state`, pour que toutes les pages travaillent sur la même donnée.
"""

import os
import sys
import streamlit as st
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "model"))
from analysis import load_logs, build_sessions_table  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEFAULT_LOGS_PATH = os.path.join(DATA_DIR, "viewing_logs.csv")
DEFAULT_META_PATH = os.path.join(DATA_DIR, "videos_metadata.csv")


def init_state():
    """Initialise les logs de démo au premier lancement de l'app."""
    if "logs" not in st.session_state:
        st.session_state["logs"] = load_logs(DEFAULT_LOGS_PATH)
        st.session_state["data_source"] = "Données de démonstration (synthétiques)"
    if "video_meta" not in st.session_state:
        if os.path.exists(DEFAULT_META_PATH):
            st.session_state["video_meta"] = pd.read_csv(DEFAULT_META_PATH)
        else:
            st.session_state["video_meta"] = pd.DataFrame(columns=["video_id", "title", "category", "duration_s"])


def get_logs() -> pd.DataFrame:
    init_state()
    return st.session_state["logs"]


def get_video_meta() -> pd.DataFrame:
    init_state()
    return st.session_state["video_meta"]


def get_sessions() -> pd.DataFrame:
    """Table de sessions dérivée des logs courants, mise en cache tant que les logs ne changent pas."""
    logs = get_logs()
    cache_key = f"sessions_cache_{id(logs)}"
    if cache_key not in st.session_state:
        st.session_state[cache_key] = build_sessions_table(logs)
    return st.session_state[cache_key]


def video_label(video_id: str) -> str:
    """Retourne un libellé lisible 'titre (video_id)' si les métadonnées sont disponibles."""
    meta = get_video_meta()
    match = meta[meta["video_id"] == video_id]
    if not match.empty and pd.notna(match.iloc[0].get("title")):
        return f"{match.iloc[0]['title']} ({video_id})"
    return video_id


def sidebar_data_status():
    """Affiche dans la sidebar la source de données active (utile pour la démo/soutenance)."""
    init_state()
    st.sidebar.markdown("---")
    st.sidebar.caption(f"Source active : **{st.session_state['data_source']}**")
    st.sidebar.caption(f"{len(get_logs()):,} événements chargés".replace(",", " "))
