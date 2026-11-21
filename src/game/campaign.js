/* Campagne : épisodes, missions, choix et conséquences. Tout est data : les mêmes
   systèmes rejouent n'importe quelle future mission. */

import { createHumanoid } from '../entities/character.js';
import { Civilian } from '../entities/civilian.js';
import { Guard } from '../entities/guard.js';

export const FACTIONS = {
  state: {
    id: 'state', label: 'La Cellule — État', short: 'État',
    blurb: 'Un service officiel, des mandats légaux et une hiérarchie. La sécurité d’une solde contre le poids des ordres.',
    accent: '#7a94b8'
  },
  freelance: {
    id: 'freelance', label: 'Indépendant — le Marché', short: 'Indépendant',
    blurb: 'Chaque contrat est un choix. Clients douteux, prix libre, et aucune couverture quand tout dérape.',
    accent: '#d99a2b'
  },
  circle: {
    id: 'circle', label: 'Le Cercle — main fantôme', short: 'Cercle',
    blurb: 'Une organisation qui n’existe pas. Les cibles choisies “empêchent des guerres”. On n’en sort pas.',
    accent: '#8a9a6f'
  }
};

/* ---------- Layout partagé de la vallée de Caudres ---------- */
export const CAUDRES_LAYOUT = {
  roads: [
    { a: { x: -100, z: -20 }, b: { x: 100, z: 30 }, width: 5 },
    { a: { x: -10, z: -90 }, b: { x: 5, z: 80 }, width: 4.5 }
  ],
  buildings: [
    { type: 'house', x: -18, z: -8, rot: 0.2, w: 9, d: 7 },
    { type: 'house', x: -2, z: -20, rot: -0.15, w: 8, d: 6, stone: true },
    { type: 'house', x: 14, z: -6, rot: 0.5, w: 7, d: 6 },
    { type: 'house', x: 24, z: 14, rot: 0.1, w: 8, d: 7, material: 'thatch' },
    { type: 'house', x: -14, z: 22, rot: -0.4, w: 7, d: 6 },
    { type: 'barn', x: 6, z: 30, rot: 0.75 },
    { type: 'barn', x: -34, z: 12, rot: 0.1, w: 10, d: 7 },
    { type: 'tower', x: 34, z: -18 },
    { type: 'wall', x: -8, z: 4, rot: 0.2, len: 8 },
    { type: 'wall', x: 28, z: 2, rot: 1.2, len: 7 },
    { type: 'crates', x: 18, z: 24 },
    { type: 'crates', x: -30, z: -30 },
    { type: 'vehicle', x: -46, z: -8, rot: 0.3, military: true }
  ]
};

/* ---------- Épisode 1 ---------- */

function guardSpecs(variant, save) {
  const heat = save.heat;
  const specs = [
    {
      name: 'Sentinelle A',
      route: [{ x: -40, z: -2 }, { x: -22, z: 6 }, { x: -34, z: 18 }],
      wait: 2.5, viewDist: 40
    },
    {
      name: 'Sentinelle B',
      route: [{ x: 18, z: -2 }, { x: 26, z: 10 }, { x: 8, z: 12 }],
      wait: 2.0, viewDist: 38
    },
    {
      name: 'Veilleur (tour)',
      pos: { x: 34, z: -18 },
      idleOnly: true, viewDist: 58, accuracy: 0.5, fov: 360, senseSpeed: 1.2
    }
  ];
  if (variant === 'circle' || heat > 40) {
    specs.push({
      name: 'Escorte',
      route: [{ x: 0, z: 34 }, { x: -12, z: 30 }, { x: 6, z: 24 }],
      wait: 1.5, viewDist: 36
    });
  }
  return specs;
}

function civilianSpecs() {
  return [
    {
      name: 'Elsa Ferber', home: { x: -14, z: 20 }, routine: [
        { x: -14, z: 20 }, { x: -4, z: 12 }, { x: -16, z: 30 }
      ]
    },
    {
      name: 'Tomás Ruy', home: { x: 22, z: 12 }, routine: [
        { x: 22, z: 12 }, { x: 12, z: 20 }, { x: 26, z: 4 }
      ]
    }
  ];
}

export function buildActors(mission, scene, ctx) {
  const actors = { guards: [], civilians: [] };

  // cibles narratives specifiques a la mission
  if (mission.id === 'scout') {
    const model = createHumanoid({ uniform: 0x4d4a3a, pants: 0x414030, hat: 0x2f3529, rifle: false });
    actors.guards.push(new Guard({
      name: 'Officier Radec', pos: { x: -6, z: -4 }, idleOnly: true,
      radio: false, viewDist: 30, route: [{ x: -6, z: -4 }, { x: 2, z: 0 }],
      model
    }, scene));
  }
  if (mission.id === 'faction') {
    const model = createHumanoid({ uniform: 0x4d4a3a, pants: 0x414030, hat: 0x4d4a3a });
    actors.civilians.push(new Civilian({
      name: 'Marek Voss', pos: { x: -4, z: -2 },
      home: { x: -4, z: -2 },
      routine: [{ x: -4, z: -2 }, { x: 4, z: 4 }, { x: -10, z: 4 }],
      model
    }, scene));
  }

  for (const spec of guardSpecs(mission.faction || 'prologue', ctx.save)) {
    const model = createHumanoid({
      uniform: 0x49503a, pants: 0x3a4030, vest: 0x2f3529, helmet: true, rifle: true
    });
    spec.model = model;
    actors.guards.push(new Guard(spec, scene));
  }
  for (const spec of civilianSpecs()) {
    const tint = [0x6b5a44, 0x55604e, 0x70604a][actors.civilians.length % 3];
    const model = createHumanoid({ uniform: tint, pants: 0x4a4238, hat: tint });
    spec.model = model;
    actors.civilians.push(new Civilian(spec, scene));
  }
  if (mission.guards) actors.guards = actors.guards.concat(mission.guards);
  return actors;
}

export const EPISODES = [
  {
    id: 'ep1',
    number: 1,
    title: 'Le Poids du Verre',
    tagline: 'Octobre 1994, vallée de Caudres. Une trêve fragile, une lunette, et tout peut basculer.',
    missions: ['scout', 'faction']
  }
];

/* Définitions de missions par id — construites à la demande pour lire la sauvegarde. */
export function getMissionDef(id, save) {
  if (id === 'scout') {
    return {
      id: 'scout',
      faction: null,
      episode: 1,
      title: 'OP HAUTFER — Le premier verre',
      place: 'Vallée de Caudres, front',
      date: '14 octobre 1994 — 07:40',
      weather: 'overcast',
      ammo: 5,
      spawn: { x: -92, z: 62, yaw: Math.PI * 0.25 },
      extraction: { x: -92, z: 62, r: 6 },
      brief: `Nous tenons la crête ; Caudres est tombé cette nuit sans un coup de feu.\n\nUn officier ennemi s’agitte sous la halle — drapeau blanc ou pas, mes ordres sont formels : « ce village ne doit compter aucun témoin utile ».\n\nInstalle-toi sur la butte ouest, observe, et attends ma confirmation avant le tir.\n\n— Capitaine Vairel`,
      tutorial: true,
      objectives: [
        { id: 'o1', type: 'goto', text: 'Rejoindre la butte d’observation (ouest)', pos: { x: -62, z: 34 }, radius: 7 },
        { id: 'o2', type: 'mark', text: 'Observer l’officier ennemi à la lunette', targetName: 'Officier Radec', duration: 3 },
        { id: 'o3', type: 'decide', text: 'Attendre la confirmation…', pos: { x: -62, z: 34 }, radius: 7, choice: 'prologue_shot' },
        { id: 'o4', type: 'eliminate', text: 'Neutraliser l’officier Radec sur ordre', targetName: 'Officier Radec' },
        { id: 'o5', type: 'extract', text: 'Reprendre la ligne de crête (extraction)', pos: { x: -92, z: 62 }, radius: 7 }
      ]
    };
  }

  if (id === 'faction') {
    const f = save.faction ?? 'state';
    const defs = {
      state: {
        title: 'OP CERISE — Le convoyeur',
        place: 'Vallée de Caudres, zone verte',
        date: '2 novembre 1994 — 09:15',
        weather: 'clear',
        ammo: 5,
        spawn: { x: -100, z: -60, yaw: Math.PI * 0.75 },
        extraction: { x: 100, z: 70, r: 8 },
        brief: `Sans titre ni décoration : la Cellule te prête à un mandat propret.\n\nMarek Voss, courtier en armes, passe marché avec la milice locale à 09 h 40 sous la halle de Caudres.\n\nMandat : élimination nette. Les fermiers du banc ne sont pas des cibles — si un civil tombe, la Cellule te lâche.\n\n— Directive 7b, Vairel`,
        objectives: [
          { id: 'o1', type: 'goto', text: 'Prendre position au nord de la vallée', pos: { x: -48, z: -34 }, radius: 8 },
          { id: 'o2', type: 'mark', text: 'Identifier Marek Voss à la lunette', targetName: 'Marek Voss', duration: 3 },
          { id: 'o3', type: 'decide', text: 'Recouper votre lecture du terrain', pos: { x: -48, z: -34 }, radius: 10, choice: 'voss_choice' },
          { id: 'o4', type: 'eliminate', text: 'Éliminer Marek Voss avant la remise des armes', targetName: 'Marek Voss' },
          { id: 'o5', type: 'extract', text: 'Sortir par l’est', pos: { x: 100, z: 70 }, radius: 8 }
        ]
      },
      freelance: {
        title: 'CONTRAT BRUME — Le convoyeur',
        place: 'Vallée de Caudres, zone verte',
        date: '2 novembre 1994 — 09:15',
        weather: 'rain',
        ammo: 5,
        spawn: { x: -100, z: -60, yaw: Math.PI * 0.75 },
        extraction: { x: 100, z: 70, r: 8 },
        brief: `Le client paie double s’il ne tombe personne d’autre que Voss, et triple si l’alarme ne sonne pas.\n\nQui est le client ? Un nom, un virement, une caisse en série. Tu voies la qualité du mandant à la limpide comptabilité.\n\nVoss n’est pas un ogre : il rembourse des dettes en scellant un marché. La pluie couvrira ton tir.\n\n— Note d’honoraires glissée dans une boîte aux lettres plein sud`,
        objectives: [
          { id: 'o1', type: 'goto', text: 'Approcher sans être repéré (nord)', pos: { x: -48, z: -34 }, radius: 8 },
          { id: 'o2', type: 'mark', text: 'Confirmer Marek Voss à la lunette', targetName: 'Marek Voss', duration: 3 },
          { id: 'o3', type: 'decide', text: 'Le contrat admet une seconde lecture…', pos: { x: -48, z: -34 }, radius: 10, choice: 'voss_choice' },
          { id: 'o4', type: 'eliminate', text: 'Exécuter le contrat (Voss)', targetName: 'Marek Voss' },
          { id: 'o5', type: 'extract', text: 'Disparaître à l’est', pos: { x: 100, z: 70 }, radius: 8 }
        ]
      },
      circle: {
        title: 'LEÇON SILENCIEUSE — Le convoyeur',
        place: 'Vallée de Caudres, zone verte',
        date: '2 novembre 1994 — 09:15',
        weather: 'storm',
        ammo: 3,
        spawn: { x: -100, z: -60, yaw: Math.PI * 0.75 },
        extraction: { x: 100, z: 70, r: 8 },
        brief: `Le Cercle ne signe pas de contrats. Il t’observe.\n\nUn duel qui s’installe sous l’orage : Marek Voss, leurs routes d’armes, et, en face, la paix que personne ne verra que personne ne verra.\n\nL’épreuve : un tir. Aucun témoin. Si l’alarme sonne, la leçon est ratée — et ton nom disparaît du registre.\n\n— La voix n’a pas de signature`,
        noAlarmLimit: true,
        objectives: [
          { id: 'o1', type: 'goto', text: 'Occuper la place que le Cercle t’a laissée (nord)', pos: { x: -48, z: -34 }, radius: 8 },
          { id: 'o2', type: 'mark', text: 'Fixer Voss dans la lunette, sans jamais trembler', targetName: 'Marek Voss', duration: 3 },
          { id: 'o3', type: 'decide', text: 'Le Cercle attend ton geste', pos: { x: -48, z: -34 }, radius: 10, choice: 'voss_choice' },
          { id: 'o4', type: 'eliminate', text: 'Le seul tir (Voss)', targetName: 'Marek Voss' },
          { id: 'o5', type: 'extract', text: 'Sortir. Sans que rien ne l’ait su.', pos: { x: 100, z: 70 }, radius: 8 }
        ]
      }
    };
    const d = defs[f] ?? defs.state;
    return { ...d, id: 'faction', faction: f };
  }

  return null;
}

/* ---------- Choix narratifs ---------- */

export const CHOICES = {
  prologue_shot: {
    title: 'Le capitaine Vairel confirme',
    text: '« Témoin utile. Tu as entendu. Tirez. »\n\nL’officier brandit un linge blanc. Dans sa main libre : un carnet entr’ouvert — des listes de noms, des familles.\n\nVairel répète l’ordre. La lunette ne laisse aucun doute : le tir est demandé.',
    options: [
      {
        id: 'obey',
        label: 'Obéir — tirer',
        result: {
          flags: { obeyedVairel: true, sparedRadec: false },
          reputation: { state: 6, market: 0, circle: 4 },
          heat: 0,
          note: 'Radec tombe. Le carnet brûlera avec le village.'
        }
      },
      {
        id: 'refuse',
        label: 'Refuser — baisser l’arme',
        result: {
          flags: { obeyedVairel: false, sparedRadec: true },
          reputation: { state: -4, market: 3, circle: 6 },
          heat: 10,
          note: 'Radec recule sous la halle. Quelqu’un a vu ton hésitation.'
        }
      }
    ]
  },
  voss_choice: {
    title: 'Lecture du terrain',
    text: 'À la lunette, la scène se précise : Voss n’arme personne aujourd’hui.\n\nIl compte des liasses devant les fermiers — dettes de guerre, pensions de veuves. La remise d’armes n’aura jamais lieu ; c’est Vairel (ou ton client…) qui mentait.\n\nLa fenêtre de tir reste ouverte.',
    options: [
      {
        id: 'shoot',
        label: 'Exécuter quand même',
        result: {
          flags: { vossKilled: true, vossSpared: false },
          reputation: { state: 8, market: 8, circle: 6 },
          heat: 4,
          note: 'La vérité est réglée comme une facture.'
        }
      },
      {
        id: 'spare',
        label: 'Ne pas tirer — laisser Voss partir',
        result: {
          flags: { vossKilled: false, vossSpared: true },
          reputation: { state: -6, market: -6, circle: 4 },
          heat: 8,
          note: 'La liasse quitte la place. Tu restes le seul témoin de ce mensonge.'
        }
      }
    ]
  }
};

/* Progression : mission suivante / fin de campagne pour cette fondation */
export function nextMissionId(save) {
  if (save.missionIndex === 0) return 'scout';
  if (save.missionIndex === 1 && save.faction) return 'faction';
  return null;
}

export const EPILOGUE = {
  title: 'Fin de la fondation — Episode 1',
  text: `La vallée de Caudres garde ta trace : trous d’impact, éclats de souvenirs, rumeurs au marché.\n\nCe que tu as fait y restera — et l’Épisode 2 « Les Chiens de verre » ouvrira sur ces conséquences : ta faction, ta chaleur traçable, les noms vivants ou enterrés.\n\nMerci d’avoir posé les premières pierres avec nous.`
};
