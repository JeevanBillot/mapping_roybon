# Mapping Roybon

Recensement des arbres du parc (4 ha), puis plan 2D et balade 3D.

## 1. App de collecte (racine du dépôt)

PWA à installer sur le téléphone. GPS moyenné + photos + identification Pl@ntNet, stockage local, export ZIP (GeoJSON + CSV + photos).

**Mise en ligne** : GitHub Pages, branche `main`, dossier racine. HTTPS obligatoire pour le GPS.

**Relais Pl@ntNet** (obligatoire : Pl@ntNet refuse les appels directs depuis un navigateur) : Cloudflare Worker gratuit, code dans `proxy/worker.js`.
1. Compte sur https://dash.cloudflare.com → Workers & Pages → Create → Start with Hello World → Deploy.
2. Edit code → remplacer tout par `proxy/worker.js` → Deploy.
3. Settings du Worker → Variables and Secrets → ajouter le secret `PLANTNET_KEY` (clé de https://my.plantnet.org, 500 identifications/jour) et, conseillé, `APP_TOKEN` (mot de passe de ton choix).
4. **Stockage cloud** : menu Storage & Databases → KV → Create namespace (nom libre, ex. `arbres`). Puis Settings du Worker → Bindings → Add → KV namespace → Variable name `TREES` → choisir le namespace → Deploy.
5. Copier l'URL du Worker (`https://….workers.dev`).

**Synchronisation** : chaque arbre et ses photos partent vers le KV dès qu'il y a du réseau. Tout appareil configuré avec la même URL et le même mot de passe voit les mêmes arbres. Le ZIP d'export reste la sauvegarde de référence.

**Sur le téléphone** : ouvrir l'URL Pages → « Ajouter à l'écran d'accueil » → ⚙ → coller l'URL du Worker et le mot de passe.

**Par arbre** : téléphone à bout de bras à côté du tronc, écran vers le ciel → « Je suis à l'arbre » (20 s) → glisser le point sur le houppier dans la photo aérienne → photos feuille / écorce / silhouette (identification automatique) → choisir → Enregistrer.

**Précision** : le GPS seul donne 3 à 10 m. La correction sur orthophoto IGN (20 cm/pixel) ramène à moins d'1 m. Les points restent déplaçables dans l'onglet Carte.

**Export** : onglet Liste → Exporter. Envoyer le ZIP pour l'étape 2.

## 2. Plan 2D et balade 3D

Deux pages qui lisent les arbres depuis le cloud (même relais que l'app) ou, à défaut, depuis le téléphone. Accès depuis l'onglet Carte de l'app.

**Plan 2D** (`plan.html`) : photo aérienne ou plan IGN, cadastre et bâtiments en option. Chaque arbre est dessiné à l'échelle de son houppier, coloré par espèce. Liste des espèces avec filtre (clic) et zoom (double-clic), fiche avec photos, impression avec légende.

**Balade 3D** (`3d.html`) : relief IGN RGE ALTI au mètre, photo aérienne plaquée au sol, bâtiments BD TOPO extrudés à leur hauteur réelle, arbres modélisés selon l'espèce (silhouette, hauteur, largeur, teinte). Deux modes : survol, et balade à hauteur d'homme (clavier et souris, joystick sur téléphone). Clic sur un arbre pour sa fiche.

Les hauteurs d'arbres sont des valeurs typiques par espèce. Un champ `height` (en mètres) sur un arbre remplace la valeur typique.
