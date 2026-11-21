# Registre des assets

Règle du jour 1 (cahier des charges §14) : **aucun asset n'entre dans le jeu sans passer par ce registre** (source, auteur, licence, date). Sources fermées : 3 au maximum.

| Fichier / chemin | Source | Auteur | Licence | Date d'ajout | Retouches |
| --- | --- | --- | --- | --- | --- |
| *(vide — aucun asset externe pour l'instant)* | | | | | |

## Notes

- Tout ce qui existe aujourd'hui (grass, sky, textures, sons) est **généré procéduralement par le code** : rien à déclarer.
- Le moment où ce registre s'ouvrira : première chaîne d'assets (blender → glTF → meshopt/KTX2) de la phase 0bis (personnage animé, arme, lunette 3D).
- Pipeline prévu : Blender (CC0 sources : Poly Haven, Quaternius) → export glTF → compression meshopt/KTX2 → inscription ici avant commit.
