// Living world (GDD §11): Tension, decision events every few minutes, small map moments and short rebellions.
// Events never pop a modal on their own: a chip appears and the player opens it when ready (GDD §2 pillar).
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { ARGUE_LINES, Choice, GameEventDef, WorldApi, pickEvent } from '../data/events';
import { SHORT } from '../data/tutorial';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';
import type { Buildings } from './Buildings';
import type { Humans } from './Humans';

const EVENT_EVERY = [240000, 420000];   // 4–7 min between decision events
const EXPIRE_MS = 75000;               // unanswered events resolve themselves (badly)
const MICRO_EVERY = [45000, 90000];
const REBELLION_AT = 75;
const NAMES: Record<string, string> = { merchant: 'Mercador de Sangue', inspector: 'Fiscal da Casa Rubra' };

export class LivingWorld {
  private pending?: { def: GameEventDef; left: number };
  private nextMicro = 60000;
  private rebelTalk = 0;
  private api: WorldApi;

  constructor(private humans: Humans, private buildings: Buildings, private panel: BuildPanel, private hud: Hud,
    private gateSpot: { x: number; y: number }) {
    const r = state.resources, w = state.world;
    const clamp = (v: number) => Phaser.Math.Clamp(v, 0, 100);
    this.api = {
      gold: d => { r.gold = Math.max(0, r.gold + d); },
      blood: d => { r.blood = Math.max(0, r.blood + d); },
      food: d => { r.food = Math.max(0, r.food + d); },
      prestige: d => { r.prestige = Math.max(0, r.prestige + d); },
      morale: d => humans.adjustMorale(d),
      tension: d => { w.tension = clamp(w.tension + d); },
      pause: (what, ms) => { w.pause[what] = Math.max(w.pause[what], ms); },
      sellBest: () => humans.sellBest(gateSpot),
      avgMorale: () => humans.avgMorale,
      resources: () => state.resources,
      toast: (m, k = '') => hud.toast(m, k),
    };
    // Tension reacts to what happens on the farm.
    bus.on('BLOOD_COLLECTED', () => this.api.tension(0.4));
    bus.on('HUMAN_ATE', () => this.api.tension(-0.15));
    bus.on('TITHE_FAILED', () => this.api.tension(10));
    bus.on('TITHE_PAID', () => this.api.tension(-5));
    bus.on('HUMAN_TAKEN', () => this.api.tension(3));
    bus.on('CONTRACT_COMPLETED', e => this.api.tension(2 * e.delivered));
    bus.on('HEIR_ARRIVED', () => this.api.tension(-2));
    if (w.rebellion) this.hud.eventChip('Rebelião na praça!', () => this.openRebellion(), true);
  }

  private get active() { return state.tutorial.done || state.night.night >= 2; }

  update(dt: number) {
    const w = state.world, s = dt / 1000;
    for (const k of ['collect', 'food', 'build'] as const) w.pause[k] = Math.max(0, w.pause[k] - dt);
    w.overtime = Math.max(0, (w.overtime ?? 0) - dt);
    for (const k of Object.keys(w.cooldown ?? {})) w.cooldown![k] = Math.max(0, w.cooldown![k] - dt);

    // Slow drift from the farm's condition.
    const pop = this.humans.population, cap = this.buildings.totalCapacity, morale = this.humans.avgMorale;
    let drift = 0.05 * this.humans.hungryCount();
    if (pop > cap) drift += 0.2;
    if (morale > 65) drift -= 0.03;
    if (morale < 35) drift += 0.03;
    this.api.tension(drift * s);
    if (w.tension > 60) this.humans.adjustMorale(-0.05 * s);

    if (w.rebellion) {
      this.rebelTalk -= dt;
      if (this.rebelTalk <= 0) { this.rebelTalk = 7000; this.humans.rebelLine(); }
      return;
    }
    if (!this.active) return;
    if (w.tension >= REBELLION_AT) { this.startRebellion(); return; }

    // Small moments on the map, no UI.
    this.nextMicro -= dt;
    if (this.nextMicro <= 0) {
      this.nextMicro = Phaser.Math.Between(MICRO_EVERY[0], MICRO_EVERY[1]);
      if (w.tension > 25) { if (this.humans.argue(ARGUE_LINES)) this.api.tension(1); }
      else if (morale > 60) this.humans.cheer();
    }

    // Decision events.
    if (this.pending) {
      this.pending.left -= dt;
      if (this.pending.left <= 0) this.expire();
      return;
    }
    w.nextEvent -= dt;
    if (w.nextEvent <= 0) this.raise();
  }

  private raise() {
    const w = state.world;
    const def = pickEvent(state.night.night, w.recent);
    w.recent = [def.id, ...w.recent].slice(0, 4);
    this.pending = { def, left: EXPIRE_MS };
    this.hud.eventChip(def.title, () => this.open());
    bus.emit('EVENT_RAISED', { eventId: def.id });
  }

  private open() {
    const p = this.pending;
    if (!p) return;
    const d = p.def;
    this.panel.open({
      title: d.title,
      subtitle: SHORT[d.who as keyof typeof SHORT] ?? NAMES[d.who] ?? '',
      desc: '',
      stats: [],
      html: `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px"><img src="assets/portrait_${d.who}.webp" alt="" ` +
        `style="width:64px;height:64px;border-radius:6px;border:1px solid #a07818;flex:none"><p class="desc" style="margin:0">${d.text}</p></div>` +
        d.choices.map((c, i) => this.choiceHtml(c, i)).join(''),
      bind: root => root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b =>
        b.addEventListener('click', () => this.choose(d.choices[Number(b.dataset.choice)]))),
    });
  }

  private choiceHtml(c: Choice, i: number) {
    const ok = !c.can || c.can(this.api);
    return `<div class="card"><button class="go" data-choice="${i}"${ok ? '' : ' disabled'}>${c.label}</button>` +
      (c.cost ? `<div class="muted" style="margin-top:4px">${c.cost}</div>` : '') + '</div>';
  }

  private choose(c: Choice) {
    const d = this.pending?.def;
    if (!d) return;
    c.apply(this.api);
    this.close(d.id);
    if (c.reply) this.hud.toast(`${SHORT[c.reply.who]}: ${c.reply.text}`, '', 6000);
  }

  private expire() {
    const d = this.pending!.def;
    d.ignore(this.api);
    this.hud.toast(`"${d.title}" se resolveu sozinho. Raramente para melhor.`, 'bad');
    this.close(d.id);
  }

  private close(id: string) {
    this.pending = undefined;
    state.world.nextEvent = Phaser.Math.Between(EVENT_EVERY[0], EVENT_EVERY[1]);
    this.hud.eventChip(null);
    this.panel.close();
    bus.emit('EVENT_RESOLVED', { eventId: id });
  }

  // ---------- one-tap building actions ----------
  extras(kind: string) {
    const w = state.world, r = state.resources;
    const cd = (k: string) => Math.ceil((w.cooldown?.[k] ?? 0) / 1000);
    const setCd = (k: string, ms: number) => { (w.cooldown ??= {})[k] = ms; };
    if (kind === 'collect') {
      const left = cd('overtime');
      return [{
        label: (w.overtime ?? 0) > 0 ? `Hora extra ativa · ${Math.ceil(w.overtime! / 1000)} s` : left ? `Hora extra · disponível em ${left} s` : 'Hora extra',
        cost: 'Coleta 2× mais rápida e mais gente na fila por 60 s · −8 moral de todos · +6 tensão',
        disabled: left > 0 || (w.overtime ?? 0) > 0 || w.rebellion,
        run: () => {
          w.overtime = 60000; setCd('overtime', 180000);
          this.api.morale(-8); this.api.tension(6);
          this.hud.toast('Bóris: Hora extra decretada. Os humanos chamaram de "hora eterna".', 'bad');
        },
      }];
    }
    if (kind === 'food') {
      const left = cd('banquet');
      return [{
        label: left ? `Banquete · disponível em ${left} s` : 'Banquete',
        cost: '−20 Comida · +10 moral de todos · −8 tensão',
        disabled: left > 0 || r.food < 20,
        run: () => {
          this.api.food(-20); this.api.morale(10); this.api.tension(-8); setCd('banquet', 180000);
          this.humans.cheer();
          this.hud.toast('Lia: Banquete! Ninguém perguntou o motivo. Ninguém quis estragar.', 'good');
        },
      }];
    }
    return [];
  }

  // ---------- rebellion (GDD §11.3) ----------
  private startRebellion() {
    state.world.rebellion = true;
    this.humans.startRebellion();
    this.hud.eventChip('Rebelião na praça!', () => this.openRebellion(), true);
    this.hud.toast('Davi: Temos exigências. E uma placa.', 'bad', 7000);
    bus.emit('REBELLION_STARTED', {});
  }

  private openRebellion() {
    const r = state.resources;
    const opts: Choice[] = [
      { label: 'Conceder comida melhor', cost: '−30 Comida · −30 tensão', can: () => r.food >= 30,
        apply: w => { w.food(-30); w.tension(-30); w.morale(8); }, reply: { who: 'davi', text: 'Duas de quatro. Mais negociação do que esperávamos.' } },
      { label: 'Reduzir a coleta', cost: 'sem coleta por 3 min · −25 tensão',
        apply: w => { w.pause('collect', 180000); w.tension(-25); w.morale(5); }, reply: { who: 'davi', text: 'Um descanso. Anotem a data: vai virar feriado.' } },
      { label: 'Negociar com o líder', cost: '−150 Ouro · −35 tensão', can: () => r.gold >= 150,
        apply: w => { w.gold(-150); w.tension(-35); w.morale(10); }, reply: { who: 'davi', text: 'Colchões novos. Viu? Civilização.' } },
      { label: 'Ghouls dispersam a multidão', cost: '−15 moral · −40 tensão · −5 Prestígio',
        apply: w => { w.morale(-15); w.tension(-40); w.prestige(-5); }, reply: { who: 'boris', text: 'Dispersados. Com educação. Quase toda.' } },
    ];
    this.panel.open({
      title: 'Rebelião na praça',
      subtitle: 'A coleta está parada enquanto isso durar',
      desc: '',
      stats: [],
      html: `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px"><img src="assets/portrait_davi.webp" alt="" ` +
        `style="width:64px;height:64px;border-radius:6px;border:1px solid #a07818;flex:none"><p class="desc" style="margin:0">` +
        'Temos exigências: comida melhor, menos coleta e o fim daquela música no refeitório. Nós esperamos. Sentados. Na praça.</p></div>' +
        opts.map((c, i) => this.choiceHtml(c, i)).join(''),
      bind: root => root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b => b.addEventListener('click', () => {
        const c = opts[Number(b.dataset.choice)];
        c.apply(this.api);
        if (c.reply) this.hud.toast(`${SHORT[c.reply.who]}: ${c.reply.text}`, 'good', 6000);
        if (state.world.tension < 50) this.endRebellion(); else this.openRebellion();
      })),
    });
  }

  private endRebellion() {
    state.world.rebellion = false;
    this.humans.endRebellion();
    this.hud.eventChip(null);
    this.panel.close();
    bus.emit('REBELLION_ENDED', {});
  }
}

