// Living world (GDD §11): Tension, decision events every few minutes, small map moments and short rebellions.
// Events never pop a modal on their own: a chip appears and the player opens it when ready (GDD §2 pillar).
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { ARGUE_LINES, Choice, GameEventDef, WorldApi, pickEvent } from '../data/events';
import { SHORT } from '../data/tutorial';
import { addSoul, flag, setFlag, meta } from '../core/meta';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';
import type { Buildings } from './Buildings';
import type { Humans } from './Humans';
import { L } from '../core/i18n';

const EVENT_EVERY = [240000, 420000];   // 4–7 min between decision events
const EXPIRE_MS = 75000;               // unanswered events resolve themselves (badly)
const MICRO_EVERY = [45000, 90000];
const REBELLION_AT = 75;
const NAMES: Record<string, string> = { merchant: L('Mercador de Sangue', 'Blood Merchant'), inspector: L('Fiscal da Casa Rubra', 'Inspector of House Rubra') };

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
      soul: d => addSoul(d),
      flag: k => setFlag(k),
      release: () => humans.release(gateSpot),
      pause: (what, ms) => { w.pause[what] = Math.max(w.pause[what], ms); },
      sellBest: () => humans.sellBest(gateSpot),
      avgMorale: () => humans.avgMorale,
      resources: () => state.resources,
      toast: (m, k = '') => hud.toast(m, k),
    };
    // Tension reacts to what happens on the farm.
    bus.on('BLOOD_COLLECTED', () => { this.api.tension(0.4 * this.share); this.collects.push(performance.now()); });
    bus.on('HUMAN_ATE', () => this.api.tension(-0.15 * this.share));
    bus.on('TITHE_FAILED', () => this.api.tension(10));
    bus.on('TITHE_PAID', () => this.api.tension(-5));
    bus.on('HUMAN_TAKEN', () => this.api.tension(3));
    bus.on('CONTRACT_COMPLETED', e => this.api.tension(2 * e.delivered));
    bus.on('HEIR_ARRIVED', () => this.api.tension(-2));
    if (w.rebellion) this.hud.eventChip(L('Rebelião na praça!', 'Rebellion in the square!'), () => this.openRebellion(), true);
  }

  private get active() { return state.tutorial.done || state.night.night >= 2; }
  // Tension is about the SHARE of the farm that's unhappy: up to 12 humans each one weighs fully, beyond that each weighs
  // less (otherwise a big farm always has a few hungry stragglers and lives in permanent rebellion).
  private get share() { return Math.min(1, 12 / Math.max(12, this.humans.population)); }

  update(dt: number) {
    const w = state.world, s = dt / 1000;
    for (const k of ['collect', 'food', 'build'] as const) w.pause[k] = Math.max(0, w.pause[k] - dt);
    w.overtime = Math.max(0, (w.overtime ?? 0) - dt);
    for (const k of Object.keys(w.cooldown ?? {})) w.cooldown![k] = Math.max(0, w.cooldown![k] - dt);

    // Slow drift from the farm's condition.
    const pop = this.humans.population, cap = this.buildings.totalCapacity, morale = this.humans.avgMorale;
    let drift = 0.05 * this.humans.hungryCount() * this.share;
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
        this.hud.toast(L(`Bóris: Os rebeldes quebraram a despensa e o cofre. −${food} Comida · −${gold} Ouro. Resolva a rebelião!`,
          `Boris: The rebels broke into the pantry and the safe. −${food} Food · −${gold} Gold. Deal with the rebellion!`), 'bad', 7000);
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
    const def = pickEvent(state.night.night, w.recent, state.tutorial.done, id => !!flag(`seen:${id}`), meta.soul ?? 0);
    w.recent = [def.id, ...w.recent].slice(0, 4);
    if (def.once) setFlag(`seen:${def.id}`);
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
    this.hud.toast(L(`"${d.title}" se resolveu sozinho. Raramente para melhor.`, `"${d.title}" resolved itself. Rarely for the better.`), 'bad');
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
        label: (w.overtime ?? 0) > 0 ? `${L('Hora extra ativa', 'Overtime on')} · ${Math.ceil(w.overtime! / 1000)} s` : left ? `${L('Hora extra', 'Overtime')} · ${L(`disponível em ${left} s`, `ready in ${left} s`)}` : L('Hora extra', 'Overtime'),
        cost: L('Coleta 2× mais rápida e mais gente na fila por 60 s · −8 moral de todos · +6 tensão · Presa', 'Collection 2× faster and more people in line for 60 s · −8 morale for all · +6 tension · Fang'),
        disabled: left > 0 || (w.overtime ?? 0) > 0 || w.rebellion,
        run: () => {
          w.overtime = 60000; setCd('overtime', 180000);
          this.api.morale(-8); this.api.tension(6); this.api.soul(-1);
          this.hud.toast(L('Bóris: Hora extra decretada. Os humanos chamaram de "hora eterna".', 'Boris: Overtime declared. The humans called it "overtime forever".'), 'bad');
        },
      }];
    }
    if (kind === 'food') {
      const left = cd('banquet');
      return [{
        label: left ? `${L('Banquete', 'Feast')} · ${L(`disponível em ${left} s`, `ready in ${left} s`)}` : L('Banquete', 'Feast'),
        cost: L('−20 Comida · +10 moral de todos · −8 tensão · Coração', '−20 Food · +10 morale for all · −8 tension · Heart'),
        disabled: left > 0 || r.food < 20,
        run: () => {
          this.api.food(-20); this.api.morale(10); this.api.tension(-8); this.api.soul(1); setCd('banquet', 180000);
          this.humans.cheer();
          this.hud.toast(L('Lia: Banquete! Ninguém perguntou o motivo. Ninguém quis estragar.', 'Lia: A feast! Nobody asked why. Nobody wanted to spoil it.'), 'good');
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
    if (hungry) f.push({ label: L(`${hungry} humano${hungry > 1 ? 's' : ''} com fome`, `${hungry} hungry human${hungry > 1 ? 's' : ''}`), perMin: 3 * hungry * this.share });
    if (pop > cap) f.push({ label: L(`Superlotação (${pop}/${cap} camas)`, `Overcrowding (${pop}/${cap} beds)`), perMin: 12 });
    if (morale < 35) f.push({ label: L(`Moral baixa (${Math.round(morale)})`, `Low morale (${Math.round(morale)})`), perMin: 1.8 });
    if (morale > 65) f.push({ label: L(`Moral alta (${Math.round(morale)})`, `High morale (${Math.round(morale)})`), perMin: -1.8 });
    if (this.collects.length) f.push({ label: L(`${this.collects.length} coletas no último minuto`, `${this.collects.length} collections in the last minute`), perMin: 0.4 * this.collects.length * this.share });
    if ((w.resentment ?? 0) > 0) f.push({ label: L(`Ressentimento (rebelião reprimida · ${Math.ceil(w.resentment! / 60000)} min)`, `Resentment (repressed rebellion · ${Math.ceil(w.resentment! / 60000)} min)`), perMin: 2.4 });
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
      `<div class="muted" style="display:flex;justify-content:space-between;font-size:11px"><span>${L('0 calma', '0 calm')}</span><span>${L('25 discussões', '25 arguments')}</span><span>${L('60 moral cai', '60 morale drops')}</span><span>${L('75 REBELIÃO', '75 REBELLION')}</span></div>`;
    const rows = f.length ? f.map(x => `<div class="row" style="justify-content:space-between"><span>${x.label}</span><b style="color:${x.perMin > 0 ? '#ff8a8a' : '#9fd86b'}">${x.perMin > 0 ? '+' : ''}${x.perMin.toFixed(1)}/min</b></div>`).join('')
      : `<div class="muted">${L('Nada pressionando a tensão agora.', 'Nothing is pushing tension right now.')}</div>`;
    const acts: { label: string; cost: string; ok: boolean; run: () => void }[] = [
      { label: cd('banquet') ? `${L('Banquete', 'Feast')} · ${cd('banquet')} s` : L('Banquete', 'Feast'), cost: L('−20 Comida · +10 moral · −8 tensão', '−20 Food · +10 morale · −8 tension'), ok: !cd('banquet') && r.food >= 20,
        run: () => { this.api.food(-20); this.api.morale(10); this.api.tension(-8); this.api.soul(1); setCd('banquet', 180000); this.humans.cheer(); } },
      { label: cd('rest') ? `${L('Folga', 'Day off')} · ${cd('rest')} s` : L('Folga geral', 'Day off for all'), cost: L('coleta parada 90 s · −15 tensão · +5 moral', 'collection stopped 90 s · −15 tension · +5 morale'), ok: !cd('rest'),
        run: () => { this.api.pause('collect', 90000); this.api.tension(-15); this.api.morale(5); this.api.soul(1); setCd('rest', 240000); } },
      { label: cd('speech') ? `${L('Discurso de Vesper', 'Vesper\'s Speech')} · ${cd('speech')} s` : L('Discurso de Vesper', 'Vesper\'s Speech'), cost: L('−8 Prestígio · −12 tensão', '−8 Prestige · −12 tension'), ok: !cd('speech') && r.prestige >= 8,
        run: () => { this.api.prestige(-8); this.api.tension(-12); setCd('speech', 300000); this.hud.toast(L('Vesper: Vocês são o sangue desta casa. Literalmente. Obrigado.', 'Vesper: You are the lifeblood of this house. Literally. Thank you.'), ''); } },
      { label: L('Presentes (Ouro)', 'Gifts (Gold)'), cost: L('−60 Ouro · −8 tensão · +4 moral', '−60 Gold · −8 tension · +4 morale'), ok: r.gold >= 60,
        run: () => { this.api.gold(-60); this.api.tension(-8); this.api.morale(4); this.api.soul(1); } },
    ];
    this.panel.open({
      title: `${L('Tensão', 'Tension')}: ${t}`,
      subtitle: net > 0.2 ? L(`Subindo ~${net.toFixed(1)} por minuto`, `Rising ~${net.toFixed(1)} per minute`) : net < -0.2 ? L(`Caindo ~${(-net).toFixed(1)} por minuto`, `Falling ~${(-net).toFixed(1)} per minute`) : L('Estável', 'Stable'),
      desc: '',
      stats: [],
      html: bar + `<h4 style="margin:10px 0 4px;color:#f6d9a0">${L('O que mexe na tensão agora', 'What moves tension right now')}</h4>${rows}` +
        `<h4 style="margin:10px 0 4px;color:#f6d9a0">${L('Ações', 'Actions')}</h4>` +
        acts.map((a, i) => `<div class="card"><button class="go" data-t="${i}"${a.ok ? '' : ' disabled'}>${a.label}</button><div class="muted" style="margin-top:4px">${a.cost}</div></div>`).join('') +
        `<p class="muted" style="font-size:12px">${L('A longo prazo: comida sobrando (horta e Cozinha), camas para todos (Habitação e Camas Macias), moral alta (Colchões, Música Ambiente), menos Hora Extra. Pagar a Sangria em dia acalma; falhar, vender e perder gente em ataques irrita.',
          'Long term: spare food (gardens and Kitchen), beds for everyone (Housing and Soft Beds), high morale (Mattresses, Mood Music), less Overtime. Paying the Bloodletting on time calms things; missing it, selling and losing people in attacks angers them.')}</p>`,
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
    this.hud.eventChip(L('Rebelião na praça!', 'Rebellion in the square!'), () => this.openRebellion(), true);
    this.hud.toast(L('Davi: Temos exigências. E uma placa. Toque no alerta vermelho para negociar.', 'Davi: We have demands. And a sign. Tap the red alert to negotiate.'), 'bad', 8000);
    bus.emit('REBELLION_STARTED', {});
  }

  private openRebellion() {
    const r = state.resources, w = state.world;
    const cap = this.buildings.totalCapacity, pop = this.humans.population;
    const D: Record<string, { label: (c: number) => string; can: (c: number) => boolean; run: (c: number) => void; reply: string }> = {
      food: { label: c => L(`Comida de verdade (−${c} Comida)`, `Real food (−${c} Food)`), can: c => r.food >= c, run: c => { this.api.food(-c); this.api.morale(8); this.api.soul(3); }, reply: L('Comida quente. Quase esquecemos o gosto.', 'Hot food. We almost forgot the taste.') },
      gold: { label: c => L(`Pagamento (−${c} Ouro)`, `Payment (−${c} Gold)`), can: c => r.gold >= c, run: c => { this.api.gold(-c); this.api.morale(10); this.api.soul(3); }, reply: L('Colchões novos. Viu? Civilização.', 'New mattresses. See? Civilization.') },
      rest: { label: c => L(`Folga de ${c / 60} min (coleta parada)`, `${c / 60} min off (collection stopped)`), can: () => true, run: c => { this.api.pause('collect', c * 1000); this.api.morale(6); this.api.soul(3); }, reply: L('Um descanso. Anotem a data: vai virar feriado.', 'A rest. Write down the date: it\'ll become a holiday.') },
      free: { label: () => L('Libertar o porta-voz (um humano deixa a fazenda)', 'Free the spokesman (a human leaves the farm)'), can: () => true,
        run: () => { const who = this.humans.releaseRebel(this.gateSpot); if (who) this.hud.toast(L(`${who} foi embora pela trilha, com um aceno.`, `${who} left down the trail, with a wave.`)); this.api.morale(12); this.api.soul(5); }, reply: L('Ele está livre. Nós ficamos. Por enquanto.', 'He\'s free. We stay. For now.') },
      beds: { label: () => L(`Camas para todos (${pop}/${cap})`, `Beds for everyone (${pop}/${cap})`), can: () => cap >= pop + 1, run: () => { this.api.morale(6); this.api.soul(3); }, reply: L('Uma cama por pessoa. Revolucionário.', 'One bed per person. Revolutionary.') },
    };
    if (!w.demands?.length) w.demands = [{ kind: 'food', cost: 30 }, { kind: 'gold', cost: 120 }, { kind: 'rest', cost: 150 }]; // older saves
    const demands = w.demands;
    const opts = demands.map(d => ({ d, def: D[d.kind] }));
    this.panel.open({
      title: L('Rebelião na praça', 'Rebellion in the square'),
      subtitle: L('A coleta está parada · a cada minuto os rebeldes quebram algo', 'Collection has stopped · every minute the rebels break something'),
      desc: '',
      stats: [],
      html: `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px"><img src="assets/portrait_davi.webp" alt="" ` +
        `style="width:64px;height:64px;border-radius:6px;border:1px solid #a07818;flex:none"><p class="desc" style="margin:0">` +
        L('Temos três exigências. Atenda <b>uma</b> e voltamos ao trabalho. Ou chame os ghouls, e veremos quem esquece primeiro.', 'We have three demands. Meet <b>one</b> and we go back to work. Or call the ghouls, and we\'ll see who forgets first.') + '</p></div>' +
        opts.map((o, i) => `<div class="card"><button class="go" data-d="${i}"${o.def.can(o.d.cost) ? '' : ' disabled'}>${o.def.label(o.d.cost)}</button>` +
          `<div class="muted" style="margin-top:4px">${L('Fim da rebelião · −40 tensão · Coração', 'Rebellion ends · −40 tension · Heart')}${o.d.kind === 'beds' && !o.def.can(o.d.cost) ? L(' · construa ou melhore uma Habitação primeiro', ' · build or upgrade Housing first') : ''}</div></div>`).join('') +
        `<div class="card"><button class="go" data-repress style="background:#3a0a10">${L('Ghouls dispersam a multidão', 'Ghouls disperse the crowd')}</button>` +
        `<div class="muted" style="margin-top:4px">${L('Fim imediato · −15 moral · −5 Prestígio · Presa · ressentimento: a tensão sobe sozinha por 3 noites', 'Ends at once · −15 morale · −5 Prestige · Fang · resentment: tension creeps up for 3 nights')}</div></div>`,
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
          this.api.morale(-15); this.api.prestige(-5); this.api.tension(-45); this.api.soul(-6);
          state.world.resentment = 3 * 5 * 60000;
          setFlag('repressed');
          this.hud.toast(L('Bóris: Dispersados. Com educação. Quase toda. Eles não vão esquecer tão cedo.', 'Boris: Dispersed. Politely. Mostly. They won\'t forget it soon.'), 'bad', 6000);
          // Consequence (GDD_ADENDO A10): the first time is a warning; the second time, Davi leaves the farm for good.
          if (flag('repressed') === 1) this.hud.toast(L('Davi: Uma vez eu entendo. Duas, não. Pense bem.', 'Davi: Once, I understand. Twice, I won\'t. Think carefully.'), 'bad', 8000);
          else if (!flag('daviGone') && this.humans.releaseNamed('Davi', this.gateSpot)) {
            setFlag('daviGone');
            this.hud.toast(L('Davi: Eu avisei. A Leonor não teria feito isso. Adeus, administrador.', 'Davi: I warned you. Leonor wouldn\'t have done this. Goodbye, administrator.'), 'bad', 9000);
          }
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
