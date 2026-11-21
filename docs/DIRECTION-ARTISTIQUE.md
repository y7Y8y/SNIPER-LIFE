# Direction artistique — SNIPER—LIFE

Ce document est la référence de cohérence visuelle du projet. Règle d'or : **rien d'externe**. Chaque mesh, chaque son, chaque texture est produit par le code du jeu. C'est ce qui garantit une identité unique — pas un assemblage d'assets.

## L'intention

Octobre 1994, une vallée d'Europe de l'Est au lendemain d'une reddition. On regarde le monde à travers du verre : la lunette, la pluie sur une vitre, le viseur. Tout l'art du jeu découle de cette idée — **voir loin, être presque invisible, décider**.

Le style visuel est un réel désaturé, froid, patiné : plus proche d'un film d'espionnage des années 90 que d'un jeu d'action.

## Palette

Les matériaux du monde partagent une palette commune (voir `src/world/buildings.js`, `MAT`) :

| Rôle | Couleurs |
|---|---|
| Olive militaire | `0x4a4f3a`, `0x3f4636` |
| Poussière / terre | `0x8a7a5e`, `0x6e6350` |
| Crème / plâtre (murs) | `0xcfc7ae`, `0xb5ab90` |
| Ambre (synthétique chaud : lampes, feux, UI) | `0xd8a05a` |
| Nuit / pluie | désaturations bleu-vert via le ciel + le fog |

Aucune couleur saturée « arcade ». Les seuls accents vifs autorisés sont fonctionnels : ambre de l'interface, rouge du réticule, blanc de l'alarme.

## Règles de rendu

- **Tone mapping ACES filmic** + exposition maîtrisée : noirs rassurants, hautes lumières douces.
- **Fog exponentiel** toujours présent : même par temps clair, la profondeur existe.
- **Ombres douces** (PCFSoft, une seule lumière directionnelle qui suit le joueur — cohérence temps réel sur mobile).
- **Grain argentique + vignettage** en surcouche CSS : le cadre est une image photographique, pas une fenêtre.
- **Vertex colors** pour les textures du terrain : le sol se lit à grande distance, sans texture répétitive.

## Personnages

Humanoïdes procéduraux aux proportions réalistes (1,72 m debout, hiérarchie articulée bassin/torse/tête/membres). Les animations sont calculées, pas lues :

- marche fonction de la vitesse, accroupi/couché par abaissement des hanches,
- mort dynamique avec rotation contrôlée, flaque de sang discrète ;
- armes portées par la hiérarchie des bras, recul appliqué par un ressort amorti.

## Son

100 % synthétisé (WebAudio, `src/core/audio.js`) : vent et pluie en boucles de bruit filtré, coup de feu en trois couches (craquement/bois/écho de vallée), battement de cœur cadencé au stress, tonnerre aléatoire, pas, cris. Rien n'est un fichier — chaque son répond aux paramètres (météo, vitesse, santé).

## Interface

Ton « dossier à la machine » : typographie à chasse fixe pour les données, papier administratif pour les briefings, texte à la machine à écrire (10 ms/caractère). L'UI ne décore pas : elle renseigne (visée, souffle, alerte, munitions).

## Ce qui est interdit (liste de contrôle avant tout nouveau contenu)

- couleur hors palette sans rôle fonctionnel ;
- asset 3D ou audio importé ;
- effet visuel qui ne sert pas la lecture tactique (pas de lens flare gratuit) ;
- écran d'interface qui ne communique pas une information vitale.
