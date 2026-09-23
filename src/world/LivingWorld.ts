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
  private collects: number[] = [];

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
    bus.on('BLOOD_COLLECTED', () => { this.api.tension(0.4); this.collects.push(performance.now()); });
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
    if ((w.resentment ?? 0) > 0) { w.resentment! -= dt; drift += 0.04; } // a repressed rebellion leaves resentment behind
    this.api.tension(drift * s);
    if (w.tension > 60) this.humans.adjustMorale(-0.05 * s);

    if (w.rebellion) {
      this.rebelTalk -= dt;
      if (this.rebelTalk <= 0) { this.rebelTalk = 7000; this.humans.rebelLine(); }
      // Ignored rebellions escalate: every minute something gets broken.
      w.unrest = (w.unrest ?? 60000) - dt;
      if (w.unrest <= 0) {
        w.unrest = 60000;
        const food = Math.min(state.resources.food, 15), gold = Math.min(state.resources.gold, 40);
        this.api.food(-food); this.api.gold(-gold);
        this.hud.toast(`Bóris: Os rebeldes quebraram a despensa e o cofre. −${food} Comida · −${gold} Ouro. Resolva a rebelião!`, 'bad', 7000);
      }
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

  // ---------- tension panel: what's pushing it right now, and what can be done ----------
  factors() {
    const w = state.world, pop = this.humans.population, cap = this.buildings.totalCapacity, morale = this.humans.avgMorale;
    const now = performance.now();
    this.collects = this.collects.filter(t => now - t < 60000);
    const f: { label: string; perMin: number }[] = [];
    const hungry = this.humans.hungryCount();
    if (hungry) f.push({ label: `${hungry} humano${hungry > 1 ? 's' : ''} com fome`, perMin: 3 * hungry });
    if (pop > cap) f.push({ label: `Superlotação (${pop}/${cap} camas)`, perMin: 12 });
    if (morale < 35) f.push({ label: `Moral baixa (${Math.round(morale)})`, perMin: 1.8 });
    if (morale > 65) f.push({ label: `Moral alta (${Math.round(morale)})`, perMin: -1.8 });
    if (this.collects.length) f.push({ label: `${this.collects.length} coletas no último minuto`, perMin: 0.4 * this.collects.length });
    if ((w.resentment ?? 0) > 0) f.push({ label: `Ressentimento (rebelião reprimida · ${Math.ceil(w.resentment! / 60000)} min)`, perMin: 2.4 });
    return f;
  }

  openTension() {
    const w = state.world, t = Math.round(w.tension), r = state.resources;
    const cd = (k: string) => Math.ceil((w.cooldown?.[k] ?? 0) / 1000);
    const setCd = (k: string, ms: number) => { (w.cooldown ??= {})[k] = ms; };
    const f = this.factors();
    const net = f.reduce((a, x) => a + x.perMin, 0);
    const bar = `<div style="position:relative;height:12px;border-radius:6px;background:linear-gradient(90deg,#2a5a2a 0%,#8a8a2a 25%,#8a5a1a 60%,#8a1424 75%,#d8122a 100%);margin:6px 0 2px">` +
      `<i style="position:absolute;left:${t}%;top:-4px;width:4px;height:20px;background:#fff;border-radius:2px;transform:translateX(-50%)"></i></div>` +
      `<div class="muted" style="display:flex;justify-content:space-between;font-size:11px"><span>0 calma</span><span>25 discussões</span><span>60 moral cai</span><span>75 REBELIÃO</span></div>`;
    const rows = f.length ? f.map(x => `<div class="row" style="justify-content:space-between"><span>${x.label}</span><b style="color:${x.perMin > 0 ? '#ff8a8a' : '#9fd86b'}">${x.perMin > 0 ? '+' : ''}${x.perMin.toFixed(1)}/min</b></div>`).join('')
      : '<div class="muted">Nada pressionando a tensão agora.</div>';
    const acts: { label: string; cost: string; ok: boolean; run: () => void }[] = [
      { label: cd('banquet') ? `Banquete · ${cd('banquet')} s` : 'Banquete', cost: '−20 Comida · +10 moral · −8 tensão', ok: !cd('banquet') && r.food >= 20,
        run: () => { this.api.food(-20); this.api.morale(10); this.api.tension(-8); setCd('banquet', 180000); this.humans.cheer(); } },
      { label: cd('rest') ? `Folga · ${cd('rest')} s` : 'Folga geral', cost: 'coleta parada 90 s · −15 tensão · +5 moral', ok: !cd('rest'),
        run: () => { this.api.pause('collect', 90000); this.api.tension(-15); this.api.morale(5); setCd('rest', 240000); } },
      { label: cd('speech') ? `Discurso de Vesper · ${cd('speech')} s` : 'Discurso de Vesper', cost: '−8 Prestígio · −12 tensão', ok: !cd('speech') && r.prestige >= 8,
        run: () => { this.api.prestige(-8); this.api.tension(-12); setCd('speech', 300000); this.hud.toast('Vesper: Vocês são o sangue desta casa. Literalmente. Obrigado.', ''); } },
      { label: 'Presentes (Ouro)', cost: '−60 Ouro · −8 tensão · +4 moral', ok: r.gold >= 60,
        run: () => { this.api.gold(-60); this.api.tension(-8); this.api.morale(4); } },
    ];
    this.panel.open({
      title: `Tensão: ${t}`,
      subtitle: net > 0.2 ? `Subindo ~${net.toFixed(1)} por minuto` : net < -0.2 ? `Caindo ~${(-net).toFixed(1)} por minuto` : 'Estável',
      desc: '',
      stats: [],
      html: bar + `<h4 style="margin:10px 0 4px;color:#f6d9a0">O que mexe na tensão agora</h4>${rows}` +
        `<h4 style="margin:10px 0 4px;color:#f6d9a0">Ações</h4>` +
        acts.map((a, i) => `<div class="card"><button class="go" data-t="${i}"${a.ok ? '' : ' disabled'}>${a.label}</button><div class="muted" style="margin-top:4px">${a.cost}</div></div>`).join('') +
        `<p class="muted" style="font-size:12px">A longo prazo: comida sobrando (horta e Cozinha), camas para todos (Habitação e Camas Macias), moral alta (Colchões, Música Ambiente), ` +
        `menos Hora Extra. Pagar a Sangria em dia acalma; falhar, vender e perder gente em ataques irrita.</p>`,
      bind: root => root.querySelectorAll<HTMLButtonElement>('[data-t]').forEach(b => b.addEventListener('click', () => { acts[Number(b.dataset.t)].run(); this.openTension(); })),
    });
  }

  // ---------- rebellion (GDD §11.3): the humans present concrete demands ----------
  private startRebellion() {
    const w = state.world, n = state.night.night;
    w.rebellion = true;
    w.unrest = 60000;
    // Three demands out of five, each a different price. Meeting any one ends the rebellion.
    const pool = [{ kind: 'food', cost: 25 + n * 5 }, { kind: 'gold', cost: 100 + n * 20 }, { kind: 'rest', cost: 150 }, { kind: 'free', cost: 1 }, { kind: 'beds', cost: 1 }];
    w.demands = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
    this.humans.startRebellion();
    this.hud.eventChip('Rebelião na praça!', () => this.openRebellion(), true);
    this.hud.toast('Davi: Temos exigências. E uma placa. Toque no alerta vermelho para negociar.', 'bad', 8000);
    bus.emit('REBELLION_STARTED', {});
  }

  private openRebellion() {
    const r = state.resources, w = state.world;
    const cap = this.buildings.totalCapacity, pop = this.humans.population;
    const D: Record<string, { label: (c: number) => string; can: (c: number) => boolean; run: (c: number) => void; reply: string }> = {
      food: { label: c => `Comida de verdade (−${c} Comida)`, can: c => r.food >= c, run: c => { this.api.food(-c); this.api.morale(8); }, reply: 'Comida quente. Quase esquecemos o gosto.' },
      gold: { label: c => `Pagamento (−${c} Ouro)`, can: c => r.gold >= c, run: c => { this.api.gold(-c); this.api.morale(10); }, reply: 'Colchões novos. Viu? Civilização.' },
      rest: { label: c => `Folga de ${c / 60} min (coleta parada)`, can: () => true, run: c => { this.api.pause('collect', c * 1000); this.api.morale(6); }, reply: 'Um descanso. Anotem a data: vai virar feriado.' },
      free: { label: () => 'Libertar o porta-voz (um humano deixa a fazenda)', can: () => true,
        run: () => { const who = this.humans.releaseRebel(this.gateSpot); if (who) this.hud.toast(`${who} foi embora pela trilha, com um aceno.`); this.api.morale(12); }, reply: 'Ele está livre. Nós ficamos. Por enquanto.' },
      beds: { label: () => `Camas para todos (${pop}/${cap})`, can: () => cap >= pop + 1, run: () => { this.api.morale(6); }, reply: 'Uma cama por pessoa. Revolucionário.' },
    };
    if (!w.demands?.length) w.demands = [{ kind: 'food', cost: 30 }, { kind: 'gold', cost: 120 }, { kind: 'rest', cost: 150 }]; // older saves
    const demands = w.demands;
    const opts = demands.map(d => ({ d, def: D[d.kind] }));
    this.panel.open({
      title: 'Rebelião na praça',
      subtitle: 'A coleta está parada · a cada minuto os rebeldes quebram algo',
      desc: '',
      stats: [],
      html: `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px"><img src="assets/portrait_davi.webp" alt="" ` +
        `style="width:64px;height:64px;border-radius:6px;border:1px solid #a07818;flex:none"><p class="desc" style="margin:0">` +
        'Temos três exigências. Atenda <b>uma</b> e voltamos ao trabalho. Ou chame os ghouls, e veremos quem esquece primeiro.</p></div>' +
        opts.map((o, i) => `<div class="card"><button class="go" data-d="${i}"${o.def.can(o.d.cost) ? '' : ' disabled'}>${o.def.label(o.d.cost)}</button>` +
          `<div class="muted" style="margin-top:4px">Fim da rebelião · −40 tensão${o.d.kind === 'beds' && !o.def.can(o.d.cost) ? ' · construa ou melhore uma Habitação primeiro' : ''}</div></div>`).join('') +
        `<div class="card"><button class="go" data-repress style="background:#3a0a10">Ghouls dispersam a multidão</button>` +
        `<div class="muted" style="margin-top:4px">Fim imediato · −15 moral · −5 Prestígio · ressentimento: a tensão sobe sozinha por 3 noites</div></div>`,
      bind: root => {
        root.querySelectorAll<HTMLButtonElement>('[data-d]').forEach(b => b.addEventListener('click', () => {
          const o = opts[Number(b.dataset.d)];
          if (!o.def.can(o.d.cost)) return;
          o.def.run(o.d.cost);
          this.api.tension(-40);
          this.hud.toast(`Davi: ${o.def.reply}`, 'good', 6000);
          this.endRebellion();
        }));
        root.querySelector<HTMLButtonElement>('[data-repress]')!.addEventListener('click', () => {
          this.api.morale(-15); this.api.prestige(-5); this.api.tension(-45);
          state.world.resentment = 3 * 5 * 60000;
          this.hud.toast('Bóris: Dispersados. Com educação. Quase toda. Eles não vão esquecer tão cedo.', 'bad', 6000);
          this.endRebellion();
        });
      },
    });
  }

  private endRebellion() {
    state.world.rebellion = false;
    state.world.demands = undefined;
    this.humans.endRebellion();
    this.hud.eventChip(null);
    this.panel.close();
    bus.emit('REBELLION_ENDED', {});
  }
}
