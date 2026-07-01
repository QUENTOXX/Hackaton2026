import sys
import os
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "model"))

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from state import get_logs, get_video_meta, sidebar_data_status, video_label
from analysis import detect_boring_zones, flag_boring_zones

st.set_page_config(page_title="Zones d'ennui", layout="wide")
st.title("Détection des zones d'ennui")
st.caption(
    "Identifie les tronçons de chaque vidéo où l'audience décroche le plus "
    "(pics de pause, d'avance rapide et d'abandon), à partir des seuls logs "
    "de visionnage — aucune annotation manuelle requise."
)

logs = get_logs()
meta = get_video_meta()
sidebar_data_status()

video_ids = sorted(logs["video_id"].unique())
if not video_ids:
    st.warning("Aucune vidéo dans les logs actuels.")
    st.stop()

labels = {vid: video_label(vid) for vid in video_ids}
selected_label = st.selectbox("Choisir une vidéo", options=[labels[v] for v in video_ids])
selected_video = [v for v in video_ids if labels[v] == selected_label][0]

col_a, col_b = st.columns([3, 1])
with col_b:
    n_buckets = st.slider("Nombre de tronçons (granularité)", min_value=8, max_value=40, value=20, step=2)
    threshold = st.slider("Seuil de détection (score d'ennui)", min_value=0.2, max_value=0.9, value=0.55, step=0.05)

bdf = detect_boring_zones(logs, selected_video, n_buckets=n_buckets)
flagged = flag_boring_zones(bdf, threshold=threshold)

if bdf.empty:
    st.warning("Pas assez de données pour cette vidéo.")
    st.stop()

with col_a:
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(
        x=bdf["t_start_s"], y=bdf["boredom_score"],
        name="Score d'ennui", marker_color=[
            "#ef4444" if s >= threshold else "#cbd5e1" for s in bdf["boredom_score"]
        ],
        width=(bdf["t_end_s"] - bdf["t_start_s"]) * 0.9,
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=bdf["t_start_s"], y=bdf["retention_pct"] * 100,
        name="Rétention (%)", mode="lines+markers", line=dict(color="#6366f1", width=3),
    ), secondary_y=True)
    fig.update_layout(
        height=460,
        title=f"Score d'ennui par tronçon — {selected_label}",
        xaxis_title="Temps dans la vidéo (s)",
        margin=dict(l=10, r=10, t=40, b=60),
        legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5),
    )
    fig.update_yaxes(title_text="Score d'ennui (0-1)", range=[0, 1], secondary_y=False)
    fig.update_yaxes(title_text="% spectateurs présents", range=[0, 100], secondary_y=True)
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

if flagged.empty:
    st.success("Aucune zone d'ennui marquée avec ce seuil : l'engagement reste homogène sur toute la vidéo.")
else:
    st.subheader(f"{len(flagged)} tronçon(s) identifié(s) comme zone d'ennui")
    display = flagged[["t_start_s", "t_end_s", "boredom_score", "pause_count", "seek_count", "abandon_count", "retention_pct"]].copy()
    display["boredom_score"] = display["boredom_score"].round(2)
    display["retention_pct"] = (display["retention_pct"] * 100).round(1)
    display.columns = ["Début (s)", "Fin (s)", "Score d'ennui", "Pauses", "Seeks", "Abandons", "Rétention (%)"]
    st.dataframe(display, use_container_width=True, hide_index=True)

    st.markdown(
        "**Pistes d'action pour l'équipe éditoriale :** raccourcir ou "
        "restructurer ces passages, ajouter un chapitrage/résumé à cet endroit "
        "(cf. Pôle 3 – Sujet A, indexation sémantique), ou insérer un moment "
        "interactif pour relancer l'attention."
    )

with st.expander("Comment le score d'ennui est-il calculé ?"):
    st.markdown(
        "Pour chaque tronçon de la vidéo, on combine 4 signaux normalisés "
        "(0 à 1) puis pondérés :\n\n"
        "- **30%** densité de pauses\n"
        "- **20%** densité d'avances rapides (seek)\n"
        "- **25%** nombre d'abandons\n"
        "- **25%** chute de la courbe de rétention (dérivée négative)\n\n"
        "Un tronçon est marqué comme *zone d'ennui* si son score dépasse le "
        "seuil choisi ci-dessus. Cette approche est volontairement basée sur "
        "des règles statistiques simples et interprétables (pas de boîte "
        "noire), pour rester explicable devant le jury."
    )
