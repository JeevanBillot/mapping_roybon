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

**Par arbre** : le GPS est allumé dès l'ouverture de l'app et sa précision s'affiche en direct. « Je suis à l'arbre » prend la position immédiatement si elle atteint la précision visée (5 m par défaut), sinon attend au plus 10 s (réglables). Puis repositionnement sur une mini-carte au choix : photo aérienne, plan IGN, ou arbres LiDAR (sommets de couronnes mesurés par l'IGN, à toucher pour y placer le point). Les arbres déjà relevés y sont affichés. Ensuite photos feuille / écorce / silhouette (identification automatique), choix, enregistrement.

**Export** : onglet Liste → Exporter. Envoyer le ZIP pour l'étape 2.

## 2. Plan 2D et balade 3D

Deux pages qui lisent les arbres depuis le cloud (même relais que l'app) ou, à défaut, depuis le téléphone. Accès depuis l'onglet Carte de l'app.

**Données LiDAR HD (IGN)** : `lidar.js` télécharge le modèle de terrain (MNT) et le modèle de surface (MNS) au demi-mètre. Leur différence donne la hauteur de la végétation, d'où :
- la hauteur mesurée et le contour réel de la couronne de chaque arbre relevé ;
- la détection des arbres non recensés (sommets de végétation hors bâtiments) ;
- le relief ombré et la carte de hauteur de végétation du plan 2D.

Si le LiDAR HD n'est pas publié sur la zone, repli sur le relief RGE ALTI et des hauteurs typiques par espèce.

**Plan 2D** (`plan.html`) : fonds photo aérienne, plan clair ou plan IGN. Calques relief, hauteur de végétation, autres arbres, bâtiments, cadastre, numéros. Couronnes à leur forme réelle, colorées par espèce. Fiche par arbre. Outil « Placer le court de tennis » (4 coins touchés sur la photo aérienne, enregistrés dans le cloud avec les arbres, repris par la 3D) pour les courts absents de la BD TOPO. Impression A4 paysage avec cartouche, légende et index numéroté.

**Balade 3D** (`3d.html`) : relief LiDAR, photo aérienne haute définition au sol et sur les toits, paysage environnant, bâtiments BD TOPO avec toits reconstruits d'après la surface LiDAR (pentes, faîtages, croupes, végétation écartée ; à défaut, toit à deux pentes d'après les altitudes de toit BD TOPO) et murs montant jusqu'au toit, eau de la BD TOPO (étangs avec reflets réels des arbres et du ciel, rives fondues ; cours d'eau comme le Galaveyson : lit creusé et sinueux, eau naturelle qui s'écoule ; aucun arbre détecté dans l'eau ; noms affichés), maison principale (repérée automatiquement ou désignée sur le plan 2D) : façade d'après photos (`house.js` : enduit, soubassement, fenêtres cintrées, volets gris-lavande, porte vitrée), avant-toits avec gouttière, terrasse surélevée à balustres et escalier sur la façade sud ; courts de tennis (BD TOPO ou placés à la main : terre battue, sol nivelé, lignes réglementaires, filet, grillage de 3 m), arbres recensés modélisés par espèce (`trees3d.js` : silhouette propre au genre — cèdre en plateaux, épicéa conique à branches tombantes, ginkgo aéré, noisetier en cépée… —, feuilles découpées selon l'espèce, écorce propre au genre ; teinte du feuillage et écorce tirées des photos prises, à la hauteur et largeur mesurées), autres arbres détectés, vent, ciel, étiquettes. Modes survol et balade à hauteur d'homme.
