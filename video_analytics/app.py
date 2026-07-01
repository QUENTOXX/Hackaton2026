import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from state import get_logs, get_video_meta, get_sessions, sidebar_data_status, video_label

st.set_page_config(
    page_title="Analyse d'Audience & Prédiction — V-Secure & Collaborate",
    layout="wide",
)

st.title("Analyse d'Audience & Prédiction")
st.caption(
    "Pôle 3 — Intelligence Artificielle & Data · Sujet B · "
    "Hackathon 42c × ESTIAM · V-Secure & Collaborate"
)

logs = get_logs()
meta = get_video_meta()
sessions = get_sessions()

sidebar_data_status()
st.sidebar.markdown(
    "### Navigation\n"
    "Utilisez les pages dans le menu ci-dessus :\n"
    "- Zones d'ennui\n"
    "- Prédiction de rétention\n"
    "- Importer des logs\n\n"
    "Documentation complète : voir `documentation/Pole3-Analyse-Audience.pdf` (racine du projet)."
)

# --- KPIs principaux -------------------------------------------------------
n_sessions = len(sessions)
n_videos = sessions["video_id"].nunique() if n_sessions else 0
avg_retention = sessions["retention_rate"].mean() if n_sessions else 0
completion_rate = sessions["completed"].mean() if n_sessions else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Sessions analysées", f"{n_sessions:,}".replace(",", " "))
col2.metric("Vidéos couvertes", n_videos)
col3.metric("Rétention moyenne", f"{avg_retention*100:.1f} %")
col4.metric("Taux de complétion", f"{completion_rate*100:.1f} %")

st.markdown("---")

# --- Courbe de rétention agrégée -------------------------------------------
st.subheader("Courbe de rétention agrégée (toutes vidéos, temps normalisé)")
st.caption(
    "Pourcentage de spectateurs encore présents à chaque décile de la vidéo, "
    "tous contenus confondus — donne une vue d'ensemble rapide de la santé "
    "d'audience de la plateforme."
)

if n_sessions:
    curve_rows = []
    for pct in range(0, 101, 5):
        still_watching = (sessions["retention_rate"] * 100 >= pct).mean()
        curve_rows.append({"pct_video": pct, "retention": still_watching})
    curve_df = pd.DataFrame(curve_rows)

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=curve_df["pct_video"], y=curve_df["retention"] * 100,
        mode="lines", fill="tozeroy", line=dict(color="#6366f1", width=3),
        name="Rétention",
    ))
    fig.update_layout(
        xaxis_title="% de la vidéo",
        yaxis_title="% de spectateurs encore présents",
        yaxis_range=[0, 100],
        height=380,
        margin=dict(l=10, r=10, t=10, b=10),
    )
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("Aucune session à afficher — importez des logs ou vérifiez la source de données.")

st.markdown("---")

# --- Classement des vidéos par rétention ------------------------------------
st.subheader("Vidéos triées par rétention moyenne")
if n_sessions:
    per_video = sessions.groupby("video_id").agg(
        sessions=("session_id", "count"),
        retention_moyenne=("retention_rate", "mean"),
        taux_completion=("completed", "mean"),
    ).reset_index()
    per_video["Vidéo"] = per_video["video_id"].apply(video_label)
    per_video = per_video.sort_values("retention_moyenne", ascending=True)
    per_video_display = per_video[["Vidéo", "sessions", "retention_moyenne", "taux_completion"]].copy()
    per_video_display["retention_moyenne"] = (per_video_display["retention_moyenne"] * 100).round(1)
    per_video_display["taux_completion"] = (per_video_display["taux_completion"] * 100).round(1)
    per_video_display.columns = ["Vidéo", "Sessions", "Rétention moyenne (%)", "Taux de complétion (%)"]

    fig2 = go.Figure(go.Bar(
        x=per_video["retention_moyenne"] * 100,
        y=per_video["Vidéo"],
        orientation="h",
        marker_color="#22c55e",
    ))
    fig2.update_layout(
        xaxis_title="Rétention moyenne (%)", xaxis_range=[0, 100],
        height=max(300, 35 * len(per_video)),
        margin=dict(l=10, r=10, t=10, b=10),
    )
    st.plotly_chart(fig2, use_container_width=True)

    with st.expander("Voir le détail en table"):
        st.dataframe(per_video_display, use_container_width=True, hide_index=True)

    st.caption(
        "Les vidéos en bas de classement sont les meilleures candidates à "
        "analyser en priorité dans l'onglet **Zones d'ennui**."
    )
