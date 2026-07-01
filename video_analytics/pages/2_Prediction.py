import sys
import os
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "model"))

import streamlit as st
import pandas as pd
import joblib
import plotly.graph_objects as go

from state import get_video_meta, sidebar_data_status

st.set_page_config(page_title="Prédiction de rétention", layout="wide")
st.title("Prédiction du taux de rétention")
st.caption(
    "Estime, à partir du comportement observé sur la première moitié du "
    "visionnage, le taux de rétention final d'une session — utile pour "
    "déclencher une alerte ou une action de relance avant la fin de la vidéo."
)

sidebar_data_status()
meta = get_video_meta()

MODEL_PATH = os.path.join(ROOT_DIR, "model", "retention_model.joblib")
REPORT_PATH = os.path.join(ROOT_DIR, "model", "metrics_report.md")

if not os.path.exists(MODEL_PATH):
    st.error(
        "Modèle introuvable. Lancez `python model/train_model.py` pour "
        "entraîner et sauvegarder le modèle avant d'utiliser cette page."
    )
    st.stop()

bundle = joblib.load(MODEL_PATH)
pipeline = bundle["pipeline"]
numeric_features = bundle["numeric_features"]
categorical_features = bundle["categorical_features"]

categories = sorted(meta["category"].dropna().unique()) if not meta.empty and "category" in meta.columns else \
    ["formation", "onboarding", "webinar", "produit", "communication_interne"]

st.subheader("Simuler une session")
col1, col2, col3 = st.columns(3)
with col1:
    video_duration_s = st.number_input("Durée de la vidéo (s)", min_value=30, max_value=3600, value=300, step=30)
    device = st.selectbox("Appareil", ["desktop", "mobile", "tablet"])
with col2:
    playback_rate = st.select_slider("Vitesse de lecture", options=[1.0, 1.25, 1.5], value=1.0)
    category = st.selectbox("Catégorie de contenu", categories)
with col3:
    time_to_first_disengage = st.slider(
        "Délai avant 1er signal de décrochage (fraction de la vidéo)",
        min_value=0.0, max_value=1.0, value=0.6, step=0.05,
        help="0 = pause/seek dès le début (signal d'alerte fort). 1 = aucun signal détecté sur la première moitié.",
    )
    early_pause_rate = st.slider("Pauses / minute (1ère moitié)", 0.0, 5.0, 0.5, 0.1)
    early_seek_rate = st.slider("Seeks / minute (1ère moitié)", 0.0, 5.0, 0.3, 0.1)

input_df = pd.DataFrame([{
    "video_duration_s": video_duration_s,
    "playback_rate": playback_rate,
    "early_pause_rate": early_pause_rate,
    "early_seek_rate": early_seek_rate,
    "time_to_first_disengage": time_to_first_disengage,
    "device": device,
    "category": category,
}])

if st.button("Prédire la rétention", type="primary"):
    pred = float(pipeline.predict(input_df)[0])
    pred = max(0.0, min(1.0, pred))

    c1, c2 = st.columns([1, 2])
    with c1:
        st.metric("Rétention prédite", f"{pred*100:.1f} %")
        if pred < 0.5:
            st.error("Risque élevé de décrochage")
        elif pred < 0.8:
            st.warning("Risque modéré")
        else:
            st.success("Session probablement complétée")

    with c2:
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=pred * 100,
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": "#6366f1"},
                "steps": [
                    {"range": [0, 50], "color": "#fecaca"},
                    {"range": [50, 80], "color": "#fed7aa"},
                    {"range": [80, 100], "color": "#bbf7d0"},
                ],
            },
            number={"suffix": " %"},
        ))
        fig.update_layout(height=250, margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig, use_container_width=True)

st.markdown("---")
st.subheader("Performance et documentation du modèle")
if os.path.exists(REPORT_PATH):
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        st.markdown(f.read())
else:
    st.info("Rapport de métriques non trouvé.")
