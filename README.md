# Mapping Roybon — Pré Reynaud

Recensement des arbres du parc (4 ha), puis plan 2D et balade 3D.

## 1. App de collecte (racine du dépôt)

PWA à installer sur le téléphone. GPS moyenné + photos + identification Pl@ntNet, stockage local, export ZIP (GeoJSON + CSV + photos).

**Mise en ligne** : GitHub Pages, branche `main`, dossier racine. HTTPS obligatoire pour le GPS.

**Relais Pl@ntNet** (obligatoire : Pl@ntNet refuse les appels directs depuis un navigateur) : Cloudflare Worker gratuit, code dans `proxy/worker.js`.
1. Compte sur https://dash.cloudflare.com → Workers & Pages → Create → Start with Hello World → Deploy.
2. Edit code → remplacer tout par `proxy/worker.js` → Deploy.
3. Settings du Worker → Variables and Secrets → ajouter le secret `PLANTNET_KEY` (clé de https://my.plantnet.org, 500 identifications/jour) et, conseillé, `APP_TOKEN` (mot de passe de ton choix).
4. Copier l'URL du Worker (`https://….workers.dev`).

**Sur le téléphone** : ouvrir l'URL Pages → « Ajouter à l'écran d'accueil » → ⚙ → coller l'URL du Worker et le mot de passe.

**Par arbre** : coller le téléphone au tronc → « Je suis à l'arbre » (15 s immobile) → photos feuille / écorce / silhouette → Identifier → choisir → Enregistrer.

**Onglet Carte** : orthophoto IGN, points déplaçables pour corriger une position GPS imprécise.

**Export** : onglet Liste → Exporter. Envoyer le ZIP pour l'étape 2.

## 2. Plan 2D et 3D (à venir)

Sources : orthophoto + cadastre IGN, LiDAR HD IGN (hauteurs d'arbres, relief), export de l'app.
