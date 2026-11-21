# SNIPER-LIFE

**SHADOWLINE** — jeu solo de sniper tactique et narratif, 3D, PWA installable (iPhone 14 Pro, paysage, hors ligne, budget 0 €, sans Mac).

- Cahier des charges : [`docs/CAHIER-DES-CHARGES-v0.2.md`](docs/CAHIER-DES-CHARGES-v0.2.md)
- Registre des assets (règle du jour 1) : [`docs/ASSET-REGISTRY.md`](docs/ASSET-REGISTRY.md)

## État actuel — Phase 0 : test de beauté et de tir

- Projet TypeScript + Vite + Babylon.js (rendu WebGL2).
- **PWA** : manifest, service worker (workbox), plein écran paysage, hors ligne après la première visite.
- **Noyau de jeu découplé du rendu** (`src/core`, zéro dépendance moteur) : balistique par sous-étapes avec table de matériaux, source de vent unique (pilote herbe, drapeaux et balistique), modèle du corps du tireur (postures, respiration/apnée, tremblement déterministe), gouverneur de qualité par fps glissants, sauvegarde JSON versionnée dans IndexedDB (migration + export/import).
- **Scène de test** : terrain procédural, herbe instanciée animée dans le shader de sommets par le vent, drapeaux indicateurs, mannequin respirant, cible à 300 m, brume atmosphérique, ombres sur une seule lumière directionnelle.
- **Contrôles tactiles** : stick flottant gauche, visée au glisser droite, apnée, lunette, tir ; HUD HTML/CSS avec zones sûres (`env(safe-area-inset-*)`), message portrait, écran « Toucher pour commencer ».
- **Validation locale possible** sans iPhone : tests unitaires du noyau (`npm test`) et build VM/browser desktop.

## Démarrer

```bash
npm install
npm run dev       # http://localhost:5173/SNIPER-LIFE/
npm test          # node --test sur le noyau (aucune dépendance de test)
npm run build     # tsc + bundle vite + PWA
```

## Installation sur iPhone

1. Ouvrir l'URL du site en **Safari** (HTTPS requis — GitHub Pages le fournit).
2. Bouton **Partager → Sur l'écran d'accueil**.
3. L'app démarre en plein écran paysage, fonctionne **hors ligne** après la première visite.

## Contrôles (phase 0)

Tactile : stick gauche = marche, glisser à droite = viser, boutons `LUNETTE` / `APNÉE` / `TIR`.
Clavier (desktop, pour le développement) : `WASD` marcher, souris viser (clic maintenu angle droit non requis en fenêtre de test), `Z` lunette, `Maj` apnée, clic/e `Espace` tir, `C/V` postures.

## Architecture

```
src/
  core/    # moteur-agnostique : wind, ballistics, shooter, perf, save (testé par node:test)
  render/  # Babylon.js : monde, herbe, mannequin, indicateurs, lunette
  ui/      # HUD HTML/CSS, contrôles tactiles
```

La règle §2.1 du cahier des charges impose un code de jeu séparé du rendu pour permettre un portage natif futur : tout ce qui est logique (balistique, IA, narration, sauvegarde) vit dans `src/core` et ne doit **jamais** importer `@babylonjs/core`.

## Hébergement

GitHub Pages via `.github/workflows/deploy-pages.yml` (build Vite + déploiement artifact). Base URL : `/SNIPER-LIFE/` (renommer si le repo change de nom).
