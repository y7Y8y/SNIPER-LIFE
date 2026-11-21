# SHADOWLINE — Cahier des charges v0.2

Jeu solo de sniper tactique et narratif, 3D, web app installable (PWA) pour iPhone 14 Pro, paysage, hors ligne, budget 0 €, sans Mac.

## 1. Vision

**Promesse en une phrase** : un thriller où chaque tir se prépare comme une enquête, et où la décision la plus forte est souvent de ne pas tirer.

**Fantasme du joueur** : être le professionnel patient et lucide qui observe, comprend un lieu, décide, puis disparaît. Pas un tireur de stand, pas un soldat de shooter.

**Cinq piliers** (tout choix de conception doit les servir) :

1. **Observer avant d'agir.** La lunette est un outil d'enquête : on repère les routines, les gardes, les civils, le vent, les failles.
2. **Un tir est un engagement.** Un seul tir, ses conséquences, son bruit, sa trace. Pas de fusillade héroïque.
3. **Le corps compte.** Respiration, fatigue, stress, blessure influencent réellement le geste.
4. **Le monde se souvient.** Les décisions ont des suites différées, visibles, parfois cruelles.
5. **Petit, dense, vivant.** Des zones de 300 à 600 m de long, travaillées à la main, rejouées sous des conditions différentes.

**Ton** : sobre, tendu, adulte, réaliste. Pays et organisations fictifs (évite les polémiques et les soucis de droits). Classement visé : 17+ sur l'App Store.

**Direction retenue** : campagne cinématique à la manière des missions sniper de Call of Duty (personnage nommé, observateur en radio, séquences scriptées et spectaculaires), avec quelques choix clés aux conséquences durables ; un enquêteur qui remonte la piste des tirs du joueur sert de fil narratif.

## 2. Décisions techniques fondatrices

### 2.1 Pourquoi une web app (PWA)

Le jeu devient une web app installable : on l'ajoute à l'écran d'accueil depuis Safari, elle s'ouvre en plein écran comme une app et fonctionne hors ligne après la première visite (service worker).

- Développement sur n'importe quel PC (Windows, Linux, Chromebook) : ni Xcode, ni compte Apple payant.
- Hébergement gratuit : GitHub Pages ou Cloudflare Pages, HTTPS inclus (obligatoire pour le hors ligne et les capteurs).
- Distribution par simple lien, mises à jour instantanées, aucune validation Apple.
- Test rapide : chaque version publiée s'essaie sur l'iPhone en quelques secondes.
- Contrepartie assumée : plafond graphique plus bas qu'une app native (section 2.3) et limites propres à Safari (section 2.4).

**Plan B** : si le web plafonne trop, un portage natif reste possible plus tard (il demandera un Mac). Pour le permettre, le code de jeu (balistique, IA, narration, sauvegarde) est écrit **séparé du rendu**.

### 2.2 Choix du moteur

| Moteur | Ce qu'il apporte | Limites | Verdict |
| --- | --- | --- | --- |
| **Babylon.js** | Moteur complet et gratuit : physique (Havok), audio spatial, animation de squelettes, glTF, post-traitements, interface, inspecteur, WebGPU | Rendu un cran sous un moteur natif | **Recommandé** |
| Three.js | Très répandu, grande communauté, rendu souple | Simple bibliothèque de rendu : physique, audio, IA et interface sont à assembler | Possible |
| PlayCanvas | Moteur open source, éditeur en ligne | Éditeur gratuit surtout pour projets publics | Prototypage |
| Godot 4 (export web) | Éditeur complet, gratuit | Export WebAssembly lourd, limites sur Safari mobile | Déconseillé sur iPhone |

**Recommandation retenue** : Babylon.js + TypeScript + Vite, assets au format glTF. Rendu WebGL2 comme base (compatible partout), WebGPU en option.

### 2.3 Budgets de performance (iPhone 14 Pro, dans Safari)

Dans un navigateur, les vrais ennemis sont la mémoire (Safari recharge la page si elle dépasse) et la chauffe. Chiffres à valider par mesure sur l'appareil dès la phase 0.

| Poste | Budget cible web |
| --- | --- |
| Fréquence d'images | 30 fps verrouillés (mode « Équilibré »), option 60 fps (mode « Fluide », scènes allégées) |
| Résolution interne | 60 à 75 % de la native (mise à l'échelle matérielle) ; HUD en HTML/CSS à la résolution native |
| Triangles visibles | 300 à 500 k max par image |
| Draw calls | 150 à 300 (instances, maillages fusionnés, atlas) |
| Mémoire totale (JS + GPU) | Viser < 1 Go, à mesurer sur l'appareil |
| Personnage joueur / PNJ clés | 15–25 k tris, 3 LOD |
| PNJ de foule | 3–6 k tris ; ~8 PNJ animés « complets » simultanés + foule simplifiée |
| Textures | KTX2 (Basis Universal) compressées, 1K par défaut, 2K pour héros et armes, atlas |
| Modèles | glTF compressé (Draco ou meshopt) |
| Ombres | 1 lumière directionnelle, 1 cascade (1024–2048) + ombres cuites + blob shadows pour les PNJ lointains |
| Éclairage | Lumière cuite dans Blender (lightmaps) + HDRI pré-filtré ; 1 seule lumière dynamique |
| Végétation | Thin instances, cartes alpha limitées, vent par shader |
| Météo | Pluie en particules GPU, brouillard exponentiel, surfaces mouillées par shader, 2–3 états de lumière pré-cuits par zone |
| Poids | Premier lancement < 40 Mo, zones < 80 Mo chacune, total installé < 500 Mo |

**Règle d'adaptation** : Safari n'expose pas la température. Le jeu mesure ses fps glissants : sous 28 fps pendant 5 s, il baisse la qualité (résolution d'abord, puis ombres, puis densité) et la remonte quand ça se calme. Missions de 15 à 25 minutes.

### 2.4 Limites iOS / Safari et parades

| Limite | Parade |
| --- | --- |
| Pas de verrouillage de l'orientation | Message « tourne ton téléphone » en portrait ; paysage uniquement, zones sûres respectées |
| Pas de plein écran dans Safari | Installation sur l'écran d'accueil = plein écran |
| L'audio ne démarre qu'après un toucher | Écran « Toucher pour commencer » |
| Gyroscope soumis à autorisation | Bouton dédié dans les options, activation explicite |
| Pas de vibration (haptique) | Retours sonores et visuels à la place |
| Page rechargée si la mémoire dépasse | Budget mémoire strict, zones chargées à la demande, sauvegarde automatique fréquente |
| Stockage pouvant être purgé par iOS | Installation recommandée, stockage persistant demandé, export/import manuel de la sauvegarde |
| Pas de lecture de la température | Qualité adaptative par fps |
| Écran qui se met en veille | Wake Lock, à tester |
| Gestes système depuis les bords | Boutons et sticks à distance des bords |

## 3. Boucle de jeu

### 3.1 Boucle macro (campagne)

Hub (planque) → choix de contrat → briefing → reconnaissance → plan → exécution → extraction → débrief → conséquences → évolution → hub.

### 3.2 Boucle micro (une mission, 15–25 min)

1. **Briefing** : objectif, contraintes (discrétion, zéro victime civile, délai), informations partielles et parfois fausses.
2. **Infiltration** à pied, en TPS : déplacement tactique, couverts, éviter les routines.
3. **Installation du poste de tir** : choix de l'emplacement (angle, distance, repli, vent, soleil), posture, réglages.
4. **Observation à la lunette (FPS)** : marquer, identifier, mémoriser les patrouilles, lire le vent, repérer les indices narratifs.
5. **Décision** : tirer, attendre, abandonner, tirer autre chose, modifier la cible.
6. **Exécution** : le tir, ses effets sonores et sociaux.
7. **Réaction du monde puis fuite et extraction** : le moment le plus risqué, souvent plus tendu que le tir.
8. **Débrief** : résumé factuel, argent, réputation, relations, suites annoncées.

**Principe « fail-forward »** : rater n'est pas un écran Game Over. Un tir manqué, une cible blessée, un civil touché ouvrent des branches (poursuite, otage, enquête, contrat annulé). Seule la mort du personnage force un retour au checkpoint, avec une conséquence légère (ex. blessure persistante).

## 4. Système de tir et de lunette

Le cœur : crédible et jouable au tactile.

**Balistique (modèle simplifié mais cohérent)** :

- Calibre fictif ou générique (ex. 7,62 mm), pas de marques réelles.
- Vitesse initiale, chute sur trajectoire, temps de vol.
- Vent : vitesse et direction variables par zone et dans le temps, indicateurs visibles (herbe, drapeaux, fumée, poussière, pluie) et un indicateur instrumental débloquable.
- Résolution par **raycast avec sous-étapes** (3 à 5 pas) : stable, peu coûteux, déterministe.
- Table de matériaux : verre, bois, tôle, béton, végétation → pénétration, déviation, perte d'énergie. Ricochets limités.
- Réglages de lunette : mise au point/zéro, clics (MIL), grossissement variable, réticule avec repères de correction.

**Le corps du tireur** :

- Postures : debout, genou, couché, avec appui, bipied.
- Respiration : fenêtre de calme de ~4–5 s, utilisable une fois avant que la vision tremble.
- Rythme cardiaque lié au stress ; tremblement généré par bruit continu dont l'amplitude dépend de posture, fatigue, stress, blessure, froid.
- Feedback sensoriel : vignettage, battement sonore, vision légèrement troublée. Pas de barres de jauge envahissantes.

**Signature du tir (conséquence immédiate)** :

- Bruit : portée selon arme et silencieux, retard du son (≈ 340 m/s) : on voit l'impact avant d'entendre le coup ; l'IA l'exploite pour localiser.
- Reflet de lunette : face au soleil, la lentille peut trahir la position.
- Flash et fumée selon luminosité.

**Niveaux d'assistance** : Simulation (aucune aide), Réaliste (indicateurs vent + point d'impact estimé après quelques secondes), Accessible (réticule corrigé, stabilité accrue). Le choix n'affecte pas l'histoire, seulement l'exigence.

## 5. Caméra FPS / TPS

La caméra est une information de gameplay, pas un choix esthétique.

- **TPS (épaule)** pour l'exploration, l'infiltration, les couverts, la fuite. Collisions de caméra propres.
- **FPS** pour la lunette et l'observation fine.
- Transition fluide et diégétique (le personnage épaule), pas de coupure sèche.
- En TPS, la silhouette du joueur est visible pour les PNJ : symétrie d'information.
- Caméra cinématique réservée aux scènes narratives et aux « kill cams » optionnelles (désactivables).

## 6. État du joueur : blessures, fatigue, stress

Trois systèmes simples, interconnectés, sans interface médicale compliquée.

- **Blessures** : localisées (bras, jambe, torse), effets lisibles (tir moins stable, course ralentie, saignement), soins limités, séquelles persistantes.
- **Fatigue** : monte avec la marche, la charge, l'attente en position froide ; effets sur le tremblement et la vitesse.
- **Stress** : monte avec le danger, les victimes civiles, les dilemmes ; baisse avec le calme. Influence la perception (tunnel) et certains choix de dialogue.

Pour le tactile : tout est visible dans le monde (respiration, mains, vision), pas dans des menus.

## 7. IA des ennemis et des civils

Le joueur doit comprendre pourquoi on l'a repéré.

### 7.1 Perception

- **Vue** : cône, distance, éclairage, mouvement, silhouette, camouflage, reflet de lunette.
- **Ouïe** : coup de feu, cri, objet renversé, pas ; propagation avec occlusion simplifiée.
- **Mémoire** : dernière position connue, indices trouvés (corps, impact, douille).

### 7.2 États (ennemis)

Ignorant → Intrigué → Suspicieux → Alerte → Combat → Recherche → Retour au calme. Chaque transition a un délai visible (animation, radio).

### 7.3 Comportements « vivants »

- Routines horaires : patrouilles, pauses cigarette, relèves, contrôles radio. La routine est le puzzle de la mission.
- Check-in radio : un garde qui ne répond pas déclenche l'alerte.
- Communication entre PNJ : information transmise avec retard, pas par télépathie.
- Civils : fuite, panique, témoin qui appelle les secours, foule qui bloque les voies d'évasion.

### 7.4 Implémentation

Arbres de comportement + règles d'utilité légères. IA « complète » seulement pour les PNJ proches ou observés (LOD d'IA : fréquence de mise à jour 5–10 Hz, perception réduite au loin). Budget ≈ 8 PNJ complets + foule simple.

## 8. Narration, choix et conséquences

### 8.1 Trois voies de carrière

| Voie | Avantages | Contraintes | Risque |
| --- | --- | --- | --- |
| Gouvernement | Matériel, couverture légale, soutien logistique | Ordres, secret, zones grises | Être sacrifié, trahi |
| Indépendant | Liberté de choix des contrats | Matériel limité, réseau à bâtir | Isolement, dettes, cible de tous |
| Organisation secrète | Ressources occultes, informations rares | Loyauté exigée, motifs flous | Découvrir qui l'on sert vraiment |

Le premier acte est commun et présente les trois portes. Le choix de voie se fait par une série d'événements, pas par un menu.

### 8.2 Réputation à plusieurs axes (pas une jauge unique)

- **Fiabilité** (aux yeux des commanditaires).
- **Notoriété / chaleur** (visibilité aux yeux des autorités et rivaux).
- **Conscience** (mesure interne : victimes évitées, mensonges, dilemmes tranchés).
- **Relations individuelles** (chaque PNJ clé a sa propre confiance/méfiance : officier traitant, observateur, informateur, rival, proche).

### 8.3 Moteur de conséquences

- **Journal d'événements** (« event ledger ») : chaque acte significatif y est consigné (qui, où, comment, témoins, trace laissée).
- **Drapeaux et qualités** : variables lues par le moteur narratif (modèle « storylets » : petits morceaux de narration conditionnés par l'état du monde).
- **Délais** : une décision de la mission 3 peut ne frapper qu'en mission 6.
- **Trois niveaux de décision** : tactique (dans la mission), stratégique (quel contrat), moral (après coup). Seul un sous-ensemble est irréversible.
- **Ne pas tirer est une vraie option** : récompensée par des informations, des relations ou des fins différentes, pas pénalisée.

### 8.4 Outils d'écriture

Ink (open source d'inkle) et sa version JavaScript (inkjs) : dialogues, états et branches ; fichiers texte versionnables, donc traductibles et testables. Alternative : Yarn Spinner.

## 9. Structure de campagne

Format épisodique : chaque épisode est jouable et satisfaisant seul.

| Bloc | Contenu | Zones |
| --- | --- | --- |
| Prologue | Tutoriel narratif : un tir, une décision, une conséquence | Zone 1 |
| Acte I (4 missions) | Mise en place, rencontre des trois puissances | Zones 1 à 3 |
| Acte II (4 missions) | Voie choisie, premières trahisons, enjeux personnels | Zones 2 à 5 |
| Acte III (4 missions) | Dénouement, plusieurs fins selon réputation et relations | Zones 3 à 6 |

**Astuce clé du petit budget** : 6 zones très travaillées, chacune réutilisée 2 à 3 fois avec des conditions différentes (heure, météo, état politique, nouveaux obstacles, autre objectif).

**Zones suggérées** (fictives, variées en lumière et en portée) : village portuaire, station de montagne, toit-terrasse urbain, vallée boisée, chantier industriel, zone frontalière.

## 10. Direction artistique

- Réalisme sobre, pas photoréalisme absolu. Palette contrôlée par zone, lumière cinématographique (heure dorée, brume, pluie, nuit), grain léger et profondeur de champ à la lunette.
- Personnages : proportions réalistes ; base humanoïde commune (Blender / MakeHuman, licence CC0) personnalisée par vêtements, visages et textures ; animations Quaternius (Universal Animation Library) (CC0) plus les animations Rocketbox (MIT) pour les civils, complétées à la main dans Blender pour les gestes sniper.
- **Cohérence avant détail** : mieux vaut 90 % de qualité uniforme que 20 % d'éléments superbes noyés dans du vide.
- **Lisibilité** : silhouettes claires des PNJ, contraste cible/arrière-plan, repères visuels du vent.
- Cible visuelle : réalisme très soigné, avec les limites assumées du web. La qualité vient de la direction artistique et de la lumière, pas du nombre de polygones.

### 10.1 Les détails qui rendent le monde crédible

| Détail | Comment on le fait dans le navigateur |
| --- | --- |
| Herbe | Touffes instanciées (lames courbes), densité qui diminue avec la distance et fondu vers la texture du sol, transparence tramée. Herbe haute cache le joueur, la basse non. Jamais de mur opaque |
| Vent | Une seule source (direction, force, rafales) qui pilote l'herbe, les arbres, les drapeaux, la fumée, la poussière, la pluie et la balistique. Mouvement dans le shader de sommets |
| Reflet du soleil sur la lunette | Test direction lunette/soleil : éclat à l'écran (flare + bloom) et signal envoyé à l'IA |
| Matériaux non « carton » | Textures PBR, occlusion ambiante cuite dans les coins, arêtes biseautées, décalques, variation de teinte |
| Lumière cinématographique | Lightmaps + soleil dynamique, brume, rayons légers, étalonnage, vignettage |
| Image de la lunette | Profondeur de champ, léger bord déformé, aberration chromatique, buée ou gouttes sous la pluie, respiration visible |
| Surfaces et météo | Surfaces mouillées par shader, flaques, pluie inclinée par le vent, brouillard qui masque la distance |
| Mouvement des personnages | Transitions d'animation fondues, pieds posés au sol, balancement à la respiration, inertie de caméra |
| Vie autour de la scène | Oiseaux qui s'envolent après un tir, poussière à l'impact, douilles, fumée, animaux et civils d'ambiance |
| Fluidité | 30 fps verrouillés, résolution adaptative, aucune allocation mémoire pendant le jeu, chargement progressif |
| Cohérence | Palette par zone, échelle humaine respectée, même niveau de détail partout |

### 10.2 Identité visuelle : une signature, pas un assemblage

Signature proposée : **« noir tactique »**. Palette désaturée par zone avec une seule couleur d'accent (ambre des lampes, rouge du réticule), silhouettes très lisibles, brume atmosphérique, grain fin, contraste marqué. L'image de la lunette, la plus vue du jeu, est la plus travaillée.

Règles de cohérence :

- Bible artistique avant toute production : une page par zone (palette, matériaux, lumière, références photo).
- Un seul jeu de matériaux : même densité de texture, mêmes réglages de rugosité, textures teintées vers la palette de la zone.
- Un étalonnage final unique (couleurs, grain, vignettage) appliqué à toute l'image.
- Personnages : une seule famille, une base humanoïde unique déclinée ; jamais de mélange de styles.
- Liste fermée de sources (3 au maximum), chaque asset retouché et inscrit au registre.
- Test de cohérence : captures de chaque zone côte à côte ; tout élément qui « sort du cadre » est refait ou retiré.
- On fabrique soi-même ce qui définit l'identité : le sniper, l'arme et la lunette, l'interface (HUD), le logo, les éléments de décor emblématiques.

## 11. Audio

- Ambiance par couches : vent, végétation, circulation lointaine, vie du lieu, réverbération extérieure.
- Tir : détonation avec retard du son, écho selon le relief, rappel.
- Corps : respiration, battement de cœur, bourdonnement quand le stress monte.
- Musique adaptive, discrète : tension par couches, silences assumés.
- Voix : budget 0 € → sous-titres + voix rares, éventuellement des voix de travail générées localement (Piper, hors ligne) pour tester le rythme.
- Sources libres : Freesound (vérifier la licence de chaque son : CC0 ou CC-BY), enregistrements maison, Audacity.

**Moteur audio** : Web Audio (audio spatial, filtres, réverbération), sons compressés (Opus/AAC), musique en streaming, démarrage après le premier toucher (règle iOS).

## 12. Contrôles tactiles (point de risque majeur)

- Gauche : stick de déplacement flottant. Droite : visée par glisser.
- Visée de précision : pendant la lunette, la sensibilité chute et le gyroscope affine le cadrage (réglable, désactivable).
- Bouton d'apnée (maintenir), bouton de tir détachable.
- Manette Bluetooth supportée (Gamepad API) : expérience de référence pour les joueurs exigeants.
- Interfaces personnalisables (taille, position, opacité), retours sonores et visuels ciblés à la place de l'haptique.
- Aucun contenu critique caché derrière un geste complexe.

Spécificités web : Pointer Events multipoints avec blocage du zoom et du défilement, Gamepad API, gyroscope via DeviceOrientation avec autorisation explicite, HUD HTML/CSS superposé au rendu, marges de sécurité via `env(safe-area-inset-*)`.

## 13. Données, sauvegarde, hors ligne

- Hors ligne via service worker (cache versionné) : après la première visite, aucune connexion requise ; pas de compte, pas d'analytique.
- Sauvegarde JSON versionnée dans IndexedDB (état du monde, journal d'événements, inventaire, état du corps), sauvegarde automatique aux points de contrôle.
- **Migration entre versions prévue dès le départ** (sinon chaque mise à jour casse les sauvegardes).
- Stockage persistant demandé au navigateur, plus export/import manuel de la sauvegarde (fichier).
- Poids : < 40 Mo au premier lancement, zones téléchargées à la demande, < 500 Mo installé.

## 14. Pipeline d'assets gratuits et licences

| Besoin | Source | Licence / remarque |
| --- | --- | --- |
| Modélisation, rigging | Blender | Gratuit, open source ; export glTF |
| Animations humaines | Quaternius (Universal Animation Library), Rocketbox | CC0 et MIT ; sans compte, téléchargement en bloc |
| Matériaux, HDRI, modèles | Poly Haven, ambientCG | CC0 |
| Modèles low-poly | Quaternius, Kenney | CC0 |
| Compression des assets | glTF-Transform, gltfpack (meshopt), outils KTX2 | Open source, ligne de commande |
| Code | TypeScript, Vite, Babylon.js, inkjs | Gratuit, open source |
| Sons | Freesound | Vérifier la licence de chaque fichier (CC0 ou CC-BY) |
| Musique | Compositions maison ou libres de droits | Créditer si requis |
| Hébergement | GitHub Pages ou Cloudflare Pages | Gratuits, HTTPS inclus |

**Règles de sécurité juridique** : tenir un registre des assets (source, auteur, licence, date) dès le premier fichier ; ne pas utiliser de marques d'armes ou d'organisations réelles ; ne pas copier de personnages ou d'univers existants ; attention aux modèles « gratuits » de provenance incertaine.

## 15. Feuille de route

Développement solo à temps partiel (≈ 10–15 h/semaine). Chaque phase finit par un critère de passage : on n'avance pas tant qu'il n'est pas atteint.

| Phase | Objectif | Durée | Critère de passage |
| --- | --- | --- | --- |
| 0. Test de beauté et de tir | Test de beauté (herbe, vent, reflet de lunette, un personnage animé), puis tir, lunette, vent et contrôles tactiles ; PWA testée sur iPhone | 1–2 mois | Tirer sur iPhone est agréable et précis ; installation et hors ligne OK ; 30 fps tenus avec herbe, vent et personnage animé ; rendu jugé crédible |
| 1. Tranche verticale | Une mission complète (zone 1), qualité finale sur ~10 minutes | 3–5 mois | 30 fps tenus 20 min sans rechargement ; test avec 3 personnes extérieures |
| 2. Systèmes | IA complète, état du corps, moteur narratif, sauvegarde | 3–4 mois | Deux missions jouables avec conséquences croisées |
| 3. Épisode 1 | Prologue + Acte I | 4–6 mois | Épisode jouable de bout en bout, rejouable différemment |
| 4. Épisodes 2 et 3 | Actes II et III, voies de carrière | 8–12 mois | Campagne complète, plusieurs fins testées |
| 5. Finition | Équilibrage, accessibilité, performances, optimisation | 2–3 mois | Aucun bug bloquant, sauvegarde robuste |

**Total réaliste : 2 à 3 ans pour la campagne complète.** L'Épisode 1 doit donc être un jeu à part entière, livrable et plaisant à lui seul.

## 16. Risques et parades

| Risque | Gravité | Parade |
| --- | --- | --- |
| Plafond graphique du navigateur | Élevée | Budgets web stricts (2.3), tranche verticale d'abord, WebGPU en option |
| Page rechargée par Safari faute de mémoire | Élevée | Mémoire < 1 Go, zones à la demande, sauvegarde automatique, profilage sur iPhone |
| Chauffe et chute de fps | Élevée | Qualité adaptative par fps, missions courtes |
| Contrôles tactiles imprécis | Élevée | Gyro, assistance, manette, tests réguliers |
| Épuisement du projet | Élevée | Jalons courts et jouables, épisodes livrables |
| Stockage purgé par iOS | Moyenne | PWA, stockage persistant, export manuel |
| Changements de Safari / iOS | Moyenne | WebGL2 comme base, test à chaque mise à jour iOS |
| IA illisible ou injuste | Moyenne | États visibles, délais, retours sonores, tests |
| Explosion des branches narratives | Moyenne | Storylets + drapeaux, fins limitées, conséquences différées |
| Licences d'assets | Moyenne | Registre dès le jour 1 |

## 17. Questions à trancher avant de commencer

1. Quel PC utilises-tu pour développer (Windows, Linux, Chromebook) et quelle version d'iOS sur ton iPhone ?
2. Partage : jeu privé ou lien partagé à des testeurs ?
3. Réalisme du tir : simulation pure, ou jeu accessible avec options ?
4. Violence et civils : les civils peuvent-ils mourir (conséquences lourdes) ou la mission échoue-t-elle automatiquement ?
5. Langues : français seul au départ, anglais ensuite ?
6. Fréquence cible : 30 fps stable, ou 60 fps sur certaines scènes ?
7. Temps hebdomadaire réaliste ?
8. Qui écrit l'histoire ? (bible narrative : personnages, factions, trois fins)

## 18. Prochaines étapes concrètes

1. Répondre aux questions de la section 17.
2. Rédiger la bible narrative v0.1 : pays fictif, trois factions, 6 personnages clés, trame des trois actes, 3 fins.
3. Spécifier la mission du prologue en détail (zone 1, routines des PNJ, vent, objectifs, dilemmes).
4. Lancer la phase 0 : projet TypeScript + Babylon.js, PWA installable, test de beauté (herbe, vent, reflet, personnage animé), puis tir et lunette, mesure des fps et de la mémoire sur iPhone.
