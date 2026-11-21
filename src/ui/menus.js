/* Écrans : menu, briefing, choix, debrief, pause, fin de campagne. Le ton est celui
   d'un dossier tapé à la machine — l'identité du jeu se lit aussi ici. */

import { FACTIONS, EPISODES, EPILOGUE, nextMissionId } from '../game/campaign.js';
import { clearSave } from '../core/save.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = game.uiRoot;
  }

  _screen(cls = '') {
    const el = document.createElement('div');
    el.className = `screen ${cls}`;
    this.root.appendChild(el);
    return el;
  }

  _clear() {
    this.root.querySelectorAll('.screen').forEach((s) => s.remove());
  }

  _typewriter(el, text, speed = 14) {
    el.textContent = '';
    let i = 0;
    const step = () => {
      if (i >= text.length) return;
      // par blocs de 2-3 lettres pour rester fluide sur mobile
      i += 2;
      el.textContent = text.slice(0, i);
      this.game.audio.ui('type');
      setTimeout(step, speed);
    };
    step();
  }

  showMainMenu() {
    this._clear();
    const sc = this._screen('menu');
    sc.innerHTML = `
      <div class="title-block">
        <div class="kicker">fondation v0.1 — Episode 1</div>
        <h1 class="wordmark lg">SNIPER<em>—</em>LIFE</h1>
        <div class="subtitle">Respire. Vise. Decide. La vallee se souvient.</div>
      </div>
      <div class="menu-actions">
        <button class="primary" id="m-continue">Reprendre la campagne</button>
        <button id="m-new">Nouvelle campagne</button>
        <button id="m-settings" class="ghost">Reglages</button>
      </div>
      <div class="kicker" style="margin-top:2vh">solo — hors ligne — paysage</div>
    `;
    const hasSave = !!this.game.save && this.game.save.missionIndex !== null;
    const cont = sc.querySelector('#m-continue');
    cont.disabled = !hasSave;
    cont.addEventListener('click', () => {
      this.game.audio.ui('confirm');
      this.game.startCampaign(this.game.save);
    });
    sc.querySelector('#m-new').addEventListener('click', () => {
      this.game.audio.ui('confirm');
      this.game.newCampaign();
    });
    sc.querySelector('#m-settings').addEventListener('click', () => this.showSettings());
  }

  showSettings() {
    const sc = this._screen();
    const v = this.game.save?.settings?.volume ?? 0.8;
    sc.innerHTML = `
      <div class="dossier">
        <h2>Reglages</h2>
        <div class="meta"><span>Audio</span><span>Qualité des ombres</span></div>
        <label style="display:flex;align-items:center;gap:12px">
          <input type="range" id="s-vol" min="0" max="100" value="${Math.round(v * 100)}" /> <span id="s-vol-v" style="font-family:var(--font-mono);font-size:12px">${Math.round(v * 100)}%</span>
        </label>
        <div class="choice-row">
          <button id="s-none" class="ghost">Effacer la sauvegarde</button>
        </div>
        <button id="s-back" class="primary">Retour</button>
      </div>
    `;
    const vol = sc.querySelector('#s-vol');
    vol.addEventListener('input', () => {
      sc.querySelector('#s-vol-v').textContent = `${vol.value}%`;
      this.game.audio.setVolume(vol.value / 100);
      if (this.game.save) {
        this.game.save.settings.volume = vol.value / 100;
      }
    });
    sc.querySelector('#s-none').addEventListener('click', () => {
      clearSave();
      this.game.save = null;
      this.toast('Sauvegarde effacée.');
    });
    sc.querySelector('#s-back').addEventListener('click', () => this.showMainMenu());
  }

  toast(text) {
    const hud = document.getElementById('hud');
    if (!hud) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    hud.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  showBriefing(missionDef, save, onStart) {
    this._clear();
    const sc = this._screen();
    const episode = EPISODES[missionDef.episode - 1] ?? EPISODES[0];
    const faction = missionDef.faction ? FACTIONS[missionDef.faction] : null;
    sc.innerHTML = `
      <div class="dossier">
        <div class="kicker">${episode ? `Episode ${episode.number} — ${episode.title}` : ''}</div>
        <h2 id="b-title"></h2>
        <div class="meta">
          <span id="b-place"></span><span id="b-date"></span>
          ${faction ? `<span style="color:${faction.accent}">${faction.label}</span>` : ''}
          <span id="b-heat"></span>
        </div>
        <hr class="h-line" />
        <div class="brief typewriter" id="b-text"></div>
        <ul class="objectives">${missionDef.objectives.map((o) => `<li>${o.text}</li>`).join('')}</ul>
        <div class="warning">
          ${missionDef.noAlarmLimit ? 'Contrainte : Échec si l’alarme sonne.' : ''}
          Munitions : ${missionDef.ammo} — chaque balle manquée a un prix.
        </div>
        <button id="b-go" class="primary">Engager</button>
      </div>
    `;
    sc.querySelector('#b-title').textContent = missionDef.title;
    sc.querySelector('#b-place').textContent = missionDef.place;
    sc.querySelector('#b-date').textContent = missionDef.date;
    sc.querySelector('#b-heat').textContent = `Chaleur traçable : ${save.heat ?? 0}`;
    this._typewriter(sc.querySelector('#b-text'), missionDef.brief, 10);
    sc.querySelector('#b-go').addEventListener('click', () => {
      this.game.audio.ui('confirm');
      this._clear();
      onStart();
    });
  }

  showFactionChoice(save, onPick) {
    this._clear();
    const sc = this._screen();
    sc.innerHTML = `
      <div class="kicker">Interruption — oct 1994, 23:12</div>
      <h2 class="wordmark" style="font-size:24px">SUIVRE QUELLE MAIN ?</h2>
      <p class="subtitle" style="max-width:640px">Radec respire encore — parce que tu as refusé, ou parce que le carnet est perdu dans la buée. Trois chemins proposent leurs services. Le premier choix colore toute la campagne.</p>
      <div class="choice-row" id="f-choices"></div>
    `;
    const row = sc.querySelector('#f-choices');
    for (const f of Object.values(FACTIONS)) {
      const card = document.createElement('div');
      card.className = 'choice-card';
      card.innerHTML = `<h3 style="color:${f.accent}">${f.label}</h3><p>${f.blurb}</p>`;
      card.addEventListener('click', () => {
        this.game.audio.ui('confirm');
        save.faction = f.id;
        this._clear();
        onPick(f);
      });
      row.appendChild(card);
    }
  }

  showChoice(choice, onResolve) {
    let sc = this.root.querySelector('.screen.choice');
    if (sc) sc.remove();
    sc = this._screen('choice');
    sc.style.background = 'linear-gradient(180deg, rgba(10,12,10,0.85), rgba(10,12,10,0.85))';
    sc.innerHTML = `
      <div class="dossier">
        <div class="kicker">décision</div>
        <h2></h2>
        <div class="brief typewriter"></div>
        <div class="choice-row"></div>
      </div>
    `;
    sc.querySelector('h2').textContent = choice.title;
    this._typewriter(sc.querySelector('.brief'), choice.text, 8);
    const row = sc.querySelector('.choice-row');
    for (const opt of choice.options) {
      const c = document.createElement('button');
      c.textContent = opt.label;
      c.addEventListener('click', () => {
        this.game.audio.ui('confirm');
        sc.remove();
        onResolve(opt.id, opt.result);
      });
      row.appendChild(c);
    }
  }

  showDebrief(mission, success, failReason, onContinue) {
    this._clear();
    document.getElementById('hud')?.classList.add('hidden');
    const sc = this._screen();
    const s = mission.stats;
    const save = mission.save;
    const nextId = nextMissionId(save);
    sc.innerHTML = `
      <div class="dossier">
        <div class="kicker">${success ? 'Debriefing' : 'Rapport d’incident'}</div>
        <h2>${success ? mission.def.title : 'Mission échouée'}</h2>
        ${failReason ? `<div class="warning">${failReason}</div>` : ''}
        <div class="stats-grid">
          <div class="stat"><b>${Math.floor(mission.time / 60)}:${String(Math.floor(mission.time % 60)).padStart(2, '0')}</b><span>Durée</span></div>
          <div class="stat"><b>${s.shots}</b><span>Tirs</span></div>
          <div class="stat"><b>${mission.kills}</b><span>Éliminations</span></div>
          <div class="stat"><b>${mission.civKills}</b><span>Civils touchés</span></div>
          <div class="stat"><b>${save.heat}</b><span>Chaleur</span></div>
        </div>
        <div class="brief" id="d-note"></div>
        <button id="d-go" class="primary">${success ? (nextId ? 'Suite de la campagne' : 'Retour au camp') : 'Reprendre la mission'}</button>
      </div>
    `;
    const note = sc.querySelector('#d-note');
    if (success) {
      const rep = save.reputation;
      note.textContent = `Réputation — État ${rep.state} · Marché ${rep.market} · Cercle ${rep.circle}. ` +
        (mission.civKills > 0 ? 'Les fermiers raconteront la balle perdue.' : 'Aucun civil touché : la vallée entretiendra votre légende.');
    } else {
      note.textContent = 'On ramasse les jumelles. La mission reste intacte — depuis le début.';
    }
    sc.querySelector('#d-go').addEventListener('click', () => {
      this.game.audio.ui('confirm');
      if (success && nextId) onContinue(nextId);
      else {
        this.game.save.stats.failMissions += success ? 0 : 1;
        onContinue(mission.def.id); // rejouer
      }
    });
  }

  showEpilogue(onBack) {
    this._clear();
    const sc = this._screen();
    sc.innerHTML = `
      <div class="dossier">
        <div class="kicker">fondation v0.1</div>
        <h2>${EPILOGUE.title}</h2>
        <div class="brief">${EPILOGUE.text.replace(/\n/g, '<br/>')}</div>
        <button id="e-back" class="primary">Retour au menu</button>
      </div>
    `;
    sc.querySelector('#e-back').addEventListener('click', () => {
      this.game.audio.ui('confirm');
      this.game.save.missionIndex = null;
      onBack();
    });
  }

  showPause(onResume, onAbort) {
    if (this.root.querySelector('.screen.pause')) return;
    const sc = this._screen('pause');
    sc.style.background = 'rgba(8, 10, 8, 0.8)';
    sc.innerHTML = `
      <div class="dossier" style="max-width:420px">
        <h2>Pause</h2>
        <div class="kicker">la vallee attend</div>
        <button id="p-resume" class="primary">Reprendre</button>
        <button id="p-abort" class="ghost">Abandonner la mission</button>
      </div>
    `;
    sc.querySelector('#p-resume').addEventListener('click', () => {
      sc.remove();
      onResume();
    });
    sc.querySelector('#p-abort').addEventListener('click', () => {
      sc.remove();
      onAbort();
    });
  }
}
