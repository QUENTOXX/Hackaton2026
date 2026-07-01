# Rapport du modèle prédictif de rétention

- Échantillon d'entraînement : 1622 sessions
- Échantillon de test : 406 sessions
- Modèle : RandomForestRegressor (n_estimators=200, max_depth=8, min_samples_leaf=5)

## Métriques sur le jeu de test

| Métrique | Modèle | Baseline (moyenne) |
|---|---|---|
| MAE  | 0.2349 | 0.2735 |
| RMSE | 0.2763 | — |
| R²   | 0.1418 | 0.0000 |

Le MAE (Mean Absolute Error) s'interprète directement : en moyenne, la prédiction du taux de rétention se trompe de 23.5 points de pourcentage.

## Features utilisées (comportement observé sur la première moitié de la vidéo
## uniquement, pour permettre une prédiction anticipée en conditions réelles)

| Feature | Importance |
|---|---|
| time_to_first_disengage | 0.3612 |
| early_pause_rate | 0.1433 |
| early_seek_rate | 0.0978 |
| playback_rate | 0.0834 |
| category_produit | 0.0683 |
| video_duration_s | 0.0672 |
| device_mobile | 0.0613 |
| device_desktop | 0.0303 |
| category_communication_interne | 0.0283 |
| category_formation | 0.0209 |
| category_onboarding | 0.0149 |
| category_webinar | 0.0143 |
| device_tablet | 0.0089 |

## Interprétation
- Le signal le plus informatif est `time_to_first_disengage` (délai avant la
  première pause/seek) : plus il est court, plus la probabilité de décrochage
  ultérieur est élevée. Viennent ensuite les taux de pause/seek précoces.
- Le modèle bat la baseline naïve (toujours prédire la moyenne) de façon
  mesurable mais modeste (~14% de réduction du MAE, R²=0.14), ce qui est
  cohérent pour un signal comportemental précoce sur données synthétiques :
  la variance individuelle des sessions reste importante, comme dans la réalité.
- Limite connue : dataset synthétique pour la démo hackathon. À ré-entraîner
  dès que de vrais logs du lecteur vidéo (Pôle 1) seront disponibles, via
  `python train_model.py` (le pipeline est identique, seule la donnée change).