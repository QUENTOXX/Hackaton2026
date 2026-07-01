import sys
import os
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "model"))

import streamlit as st
import pandas as pd

from state import get_logs, sidebar_data_status, DEFAULT_LOGS_PATH
from analysis import load_logs, REQUIRED_COLUMNS

st.set_page_config(page_title="Importer des logs", layout="wide")
st.title("Importer des logs de visionnage")
st.caption(
    "Point d'intégration avec le lecteur vidéo (Pôle 1) : importez un export "
    "de logs réels au format défini dans data/SCHEMA_LOGS.md pour remplacer "
    "les données de démonstration."
)

sidebar_data_status()

st.info(
    f"Colonnes obligatoires attendues : `{'`, `'.join(REQUIRED_COLUMNS)}` "
    "(+ `device` et `playback_rate` optionnels). Voir `documentation/Pole3-Analyse-Audience.pdf` "
    "pour le détail complet du schéma."
)

uploaded = st.file_uploader("Déposer un fichier CSV de logs", type=["csv"])

col1, col2 = st.columns(2)
with col1:
    if uploaded is not None:
        try:
            new_logs = load_logs(uploaded)
            st.success(f"Fichier valide — {len(new_logs):,} événements chargés.".replace(",", " "))
            st.dataframe(new_logs.head(20), use_container_width=True)

            if st.button("Utiliser ces logs dans le dashboard", type="primary"):
                st.session_state["logs"] = new_logs
                st.session_state["data_source"] = f"Fichier importé : {uploaded.name}"
                # invalide le cache de sessions dérivées pour forcer un recalcul
                for key in list(st.session_state.keys()):
                    if key.startswith("sessions_cache_"):
                        del st.session_state[key]
                st.success("Logs mis à jour. Naviguez vers les autres pages pour voir l'analyse actualisée.")
        except Exception as e:
            st.error(f"Fichier invalide : {e}")

with col2:
    st.markdown("**Ou repartir des données de démonstration :**")
    if st.button("Réinitialiser sur les données de démo"):
        st.session_state["logs"] = load_logs(DEFAULT_LOGS_PATH)
        st.session_state["data_source"] = "Données de démonstration (synthétiques)"
        for key in list(st.session_state.keys()):
            if key.startswith("sessions_cache_"):
                del st.session_state[key]
        st.success("Retour aux données de démonstration.")

    st.markdown("**Modèle de fichier CSV à télécharger :**")
    template = pd.DataFrame([{
        "session_id": "s_00001", "user_id": "u_001", "video_id": "v_001",
        "video_duration_s": 300, "event_type": "play", "video_time_s": 0,
        "event_time": "2026-07-01T09:00:00Z", "device": "desktop", "playback_rate": 1.0,
    }])
    st.download_button(
        "Télécharger un exemple de CSV",
        data=template.to_csv(index=False),
        file_name="modele_logs_visionnage.csv",
        mime="text/csv",
    )

st.markdown("---")
st.caption(
    "Aperçu des données actuellement actives dans le dashboard :"
)
st.dataframe(get_logs().head(10), use_container_width=True)
