# Mapping Roybon — Pré Reynaud

Recensement des arbres du parc (4 ha), puis plan 2D et balade 3D.

## 1. App de collecte (`app/`)

PWA à installer sur le téléphone. GPS moyenné + photos + identification Pl@ntNet, stockage local, export ZIP (GeoJSON + CSV + photos).

**Mise en ligne** : GitHub Pages sur ce dépôt, dossier `app/` (Settings → Pages → branche `main`, dossier `/app`). HTTPS obligatoire pour le GPS.

**Sur le téléphone** : ouvrir l'URL Pages → « Ajouter à l'écran d'accueil » → ⚙ → coller la clé API Pl@ntNet (gratuite sur https://my.plantnet.org, 500 identifications/jour).

**Par arbre** : coller le téléphone au tronc → « Je suis à l'arbre » (15 s immobile) → photos feuille / écorce / silhouette → Identifier → choisir → Enregistrer.

**Onglet Carte** : orthophoto IGN, points déplaçables pour corriger une position GPS imprécise.

**Export** : onglet Liste → Exporter. Envoyer le ZIP pour l'étape 2.

## 2. Plan 2D et 3D (à venir)

Sources : orthophoto + cadastre IGN, LiDAR HD IGN (hauteurs d'arbres, relief), export de l'app.
