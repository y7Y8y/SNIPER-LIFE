# SNIPER—LIFE

Jeu de sniper tactique et narratif en 3D, jouable dans le navigateur — conçu pour l'iPhone 14 Pro en paysage, jouable aussi au clavier/souris sur desktop.

> *Octobre 1994, vallée de Caudres. Une trêve fragile, une lunette, et tout peut basculer.*

## Le jeu

Vous incarnez un sniper solitaire dont la carrière se construit épisode après épisode :

- **Campagne en missions** — prologue, épisodes, objectifs intermédiaires (observation, identification à la lunette, décisions, élimination, extraction).
- **Trois carrières** — travailler pour l'État, exercer en indépendant, ou rejoindre le Cercle. Chaque voie change le brief, la météo, les contraintes et le budget de munitions.
- **Décisions à conséquences** — tirer ou refuser, épargner ou exécuter : réputation (État / Marché / Cercle), heat, drapeaux narratifs persistés en local.
- **IA crédible** — patrouilles avec vision/ouïe, montée de méfiance, enquête, alerte propagée, découverte de corps ; les civils vaquent, fuient, s'abritent.
- **Tir réaliste** — balistique (vitesse, gravité), tremblement lié au souffle/stress/posture, apnée limitée, recul, occultation par les bâtiments.
- **Vivre avant de tirer** — la lunette sert d'abord à observer. Certaines missions se terminent sans qu'aucun projectile ne parte… et certaines le récompensent.

## Technique — pourquoi une PWA à 0 €

Une app native iOS exige un Mac et le compte développeur Apple (99 €/an). Pour tenir le budget de 0 €, SNIPER—LIFE est une **application web progressive** :

- **Three.js** (3D temps réel) + **Vite** (build), aucun asset externe : terrain, village, végétation, personnages, animations, ciel, météo, textures procédurales par vertex-colors, et **tout le son est synthétisé** (WebAudio). Identité visuelle unique, cohérente, maison — palette olive/poussière/crème, grain argentique, vignettage, ACES.
- **Hors ligne** : service worker avec cache-first — une fois installée, l'app fonctionne sans réseau.
- **Paysage verrouillé** via le manifest PWA + surcouche de rotation si l'appareil est en portrait.
- **Performance iPhone 14 Pro** : résolution dynamique (cible ≥ 45 fps), géométrie instanciée, colliders AABB analytiques (aucun raycast), petite zone très détaillée.

## Jouer sur iPhone

1. Servez l'app en **HTTPS** (GitHub Pages, ou un tunnel/local pour tester).
2. Ouvrez l'URL dans Safari → **Partager** → **Sur l'écran d'accueil**.
3. Lancez depuis l'icône : plein écran, paysage, hors ligne.

Sur desktop : `npm run dev` puis ouvrez `http://localhost:5173`.

## Contrôles

**Tactile** (paysage) :

| Zone / bouton | Action |
|---|---|
| Pouce gauche (bas gauche) | joystick de déplacement |
| Glisser à droite | orienter la vue |
| ⦿ TIR (bas droite) | tirer / déclencher |
| LUNETTE | enclencher la lunette (zoom 4×–8×) |
| POSTURE | debout → accroupi → couché |
| APNÉE (maintenir) | retenir le souffle |
| CAM | basculer FPS / TPS |
| ‖ | pause |

**Clavier / souris** :

| Touche | Action |
|---|---|
| ZQSD / WASD / flèches | se déplacer |
| Souris (clic verrouillé) | viser |
| Clic droit / R | lunette |
| Molette | zoom 4×–8× |
| Clic gauche / Espace | tir |
| Maj | apnée |
| Ctrl | sprint léger |
| C | posture |
| V | caméra FPS/TPS |
| Échap | pause |

## Développement

```bash
npm install        # three + vite (les seules dépendances)
npm run dev        # serveur de dev
npm run build      # build de production -> dist/
npm test           # tests unitaires + smoke monde + flux de mission
npm run icons      # régénérer les icônes PWA
```

## Architecture

```
src/
  core/    math, bus d'événements, audio synthétisé, entrées, sauvegarde localStorage
  world/   terrain analytique, météo/ciel, village (colliders + occulteurs), végétation instanciée
  entities/ humanoïde procédural + animations, gardes (IA), civils, joueur, balles
  ui/      HUD + lunette 2D, menus/briefing/débrief/choix
  game/    données de campagne (épisodes, missions, choix), orchestrateur de mission
```

## Feuille de route

- **Épisode 2 « Les Chiens de verre »** — nuit, chiens de garde ; avantages narratifs des trois voies qui divergent.
- Progression de carrière : concours de tir, réseau de contacts, missions contingentes à la réputation.
- Cycle jour/nuit complet, ombres douces d'ambiance, thermique (surcouche lunette).
- Améliorations visuelles : vent par shader de vertex déplacé, brouillard volumétrique, faune d'animaux.
- Paramètre « Qualité des ombres » câblé au rig de lumière réel.

## Licence

Projet original. Code et contenu sous droit d'auteur de l'auteur du dépôt.
