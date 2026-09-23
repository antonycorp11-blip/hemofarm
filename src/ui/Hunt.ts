// Caçada (GDD_ADENDO A7): a long roguelite run of battles. A map of 12 floors (battle, elite, event, merchant, rest, boss),
// a deck that grows by drafting after each win, hunt relics and volunteers as lives. Rewards feed the farm: hunt marks,
// Essência, and every card drafted becomes available in the farm's own defenses.
import Phaser from 'phaser';
import { state } from '../core/state';
import { meta, saveMeta } from '../core/meta';
import { sfx } from '../core/sfx';
import { ARENAS, ArenaId, UNITS, UnitId, WEATHER, WeatherId, huntRaid, rollWeather } from '../data/battle';
import type { BattleData, BattleResult } from '../scenes/BattleScene';
import { Modal, icon } from './Modal';

type NodeType = 'battle' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';
interface HNode { type: NodeType; arena: ArenaId; weather: WeatherId }
interface Offer { kind: 'card' | 'up'; id: UnitId }
interface Run { floor: number; lives: number; deck: UnitId[]; cardLv: Record<string, number>; relics: string[]; bones: number; map: HNode[][]; path: number[]; drafted: UnitId[] }

const FLOORS = 12;
const START_DECK: UnitId[] = ['chalice', 'sentinel', 'wall', 'maid'];
const MAX_LIVES = 8;
const KEY = 'hemo.hunt';

const NODE: Record<NodeType, { name: string; icon: string; frame: number }> = {
  battle: { name: 'Batalha', icon: '⚔', frame: 0 }, elite: { name: 'Elite', icon: '☠', frame: 1 }, event: { name: 'Evento', icon: '?', frame: 2 },
  shop: { name: 'Mercador', icon: '⚖', frame: 3 }, rest: { name: 'Fogueira', icon: '🔥', frame: 4 }, boss: { name: 'Mãe da Matilha', icon: '☾', frame: 5 },
};

// Battle-only relics of the hunt.
const HRELICS: Record<string, { name: string; desc: string; icon: string; boost?: { dmg?: number; hp?: number; gen?: number; cost?: number }; bank?: number }> = {
  presas: { name: 'Presas de Lua', desc: 'Defensores +20% de dano.', icon: 'icon_defense', boost: { dmg: 0.2 } },
  escudo: { name: 'Brasão da Casa', desc: 'Defensores +25% de vida.', icon: 'icon_defense', boost: { hp: 0.25 } },
  calice: { name: 'Cálice de Prata', desc: 'Geradores +40% de Sangue.', icon: 'icon_blood', boost: { gen: 0.4 } },
  bolsa: { name: 'Bolsa do Tesoureiro', desc: 'Cartas 10% mais baratas.', icon: 'icon_gold', boost: { cost: 0.1 } },
  reserva: { name: 'Reserva de Sangue', desc: '+60 de Sangue no início de cada luta.', icon: 'icon_blood', bank: 60 },
  foice: { name: 'Foice Afiada', desc: 'Defensores +10% de dano e +10% de vida.', icon: 'icon_defense', boost: { dmg: 0.1, hp: 0.1 } },
};

const EVENTS = [
  { title: 'Aldeões assustados', text: 'Uma família foge dos lobos pela trilha e pede abrigo atrás das suas linhas.', a: 'Acolher (+1 voluntário)', b: 'Pedir pagamento (+25 ossos)',
    run: (r: Run, a: boolean) => { if (a) r.lives = Math.min(MAX_LIVES, r.lives + 1); else r.bones += 25; } },
  { title: 'Altar de Sangue', text: 'Uma pedra antiga pede um tributo. Em troca, oferece poder.', a: 'Oferecer um voluntário (relíquia)', b: 'Seguir em frente',
    run: (r: Run, a: boolean, h: Hunt) => { if (a && r.lives > 1) { r.lives--; h.giveRelic(); } } },
  { title: 'Ferreiro Ghoul', text: 'Um ghoul de avental afia armas por um punhado de ossos.', a: 'Pagar 20 ossos (melhora uma carta)', b: 'Recusar',
    run: (r: Run, a: boolean, h: Hunt) => { if (a && r.bones >= 20) { r.bones -= 20; h.upgradeRandom(); } } },
  { title: 'Cova Aberta', text: 'Uma cova recém-aberta, cheia de ossos... e de lobos dormindo em volta.', a: 'Saquear (+40 ossos, −1 voluntário)', b: 'Deixar quieto',
    run: (r: Run, a: boolean) => { if (a && r.lives > 1) { r.bones += 40; r.lives--; } } },
  { title: 'Vampiro Errante', text: 'Um vampiro sem casa oferece seus serviços por uma noite de abrigo.', a: 'Recrutar (carta nova)', b: 'Pedir ossos (+15)',
    run: (r: Run, a: boolean, h: Hunt) => { if (a) h.giveCard(); else r.bones += 15; } },
];

export interface HuntHost {
  battle(data: Omit<BattleData, 'onEnd' | 'collectLevel' | 'looks'>, done: (r: BattleResult) => void): void;
  pause(p: boolean): void;
  toast(msg: string, kind?: 'good' | 'bad'): void;
  hasArt(key: string): boolean;
}

export class Hunt {
  private run?: Run;

  constructor(private modal: Modal, private host: HuntHost) {
    try { const raw = localStorage.getItem(KEY); if (raw) this.run = JSON.parse(raw); } catch { /* no run */ }
  }

  private save() { try { if (this.run) localStorage.setItem(KEY, JSON.stringify(this.run)); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }

  // ---------- entry ----------
  open() {
    this.host.pause(true);
    if (this.run) { this.map(); return; }
    const box = this.modal.show(`<h2>Caçada</h2><div class="sub">Uma campanha longa contra a matilha, longe da fazenda</div>
      <div class="row"><div class="t"><b>Como funciona</b><br><small>12 etapas: batalhas, elites, eventos, mercador, fogueira e a Mãe da Matilha no fim.
      Você começa com 4 cartas e 5 voluntários (vidas). Após cada vitória escolhe uma carta nova ou uma melhoria.</small></div></div>
      <div class="row"><div class="t"><b>Recompensas</b><br><small>Marcas de caça (Arsenal), Essência para a fazenda, e toda carta conquistada passa a defender a fazenda também.</small></div></div>
      <div class="row"><div class="t"><small>Melhor etapa: ${meta.huntBest ?? 0}/${FLOORS} · Caçadas: ${meta.hunts ?? 0} · Cartas liberadas na fazenda: ${meta.cards?.length ?? 0}</small></div></div>
      <button class="go" data-go>Começar a Caçada</button>`, { onClose: () => this.host.pause(false) });
    box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => { this.start(); this.map(); };
  }

  private start() {
    const map: HNode[][] = [];
    for (let f = 0; f < FLOORS; f++) {
      const arena = () => Phaser.Utils.Array.GetRandom(Object.keys(ARENAS)) as ArenaId;
      if (f === 0) { map.push([{ type: 'battle', arena: 'farm', weather: 'clear' }]); continue; }
      if (f === FLOORS - 1) { map.push([{ type: 'boss', arena: arena(), weather: Math.random() < 0.5 ? 'fullmoon' : 'eclipse' }]); continue; }
      if (f === FLOORS - 2) { map.push([{ type: 'rest', arena: 'farm', weather: 'clear' }, { type: 'shop', arena: 'farm', weather: 'clear' }]); continue; }
      const n = Phaser.Math.Between(2, 3), row: HNode[] = [];
      for (let k = 0; k < n; k++) {
        const r = Math.random();
        const type: NodeType = k === 0 ? 'battle' : f >= 3 && r < 0.25 ? 'elite' : r < 0.5 ? 'event' : r < 0.72 ? 'shop' : r < 0.88 ? 'rest' : 'battle';
        row.push({ type, arena: arena(), weather: type === 'elite' && Math.random() < 0.4 ? 'fullmoon' : rollWeather(false) });
      }
      map.push(Phaser.Utils.Array.Shuffle(row));
    }
    this.run = { floor: 0, lives: 5, deck: [...START_DECK], cardLv: {}, relics: [], bones: 20, map, path: [], drafted: [] };
    this.save();
  }

  // ---------- map ----------
  private map() {
    const r = this.run!;
    const nodeImg = this.nodeArt();
    const col = (row: HNode[], f: number) => `<div style="display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-width:54px">` +
      `<small style="color:#6a5a58">${f + 1}</small>` + row.map((n, i) => {
        const cur = f === r.floor, past = f < r.floor, chosen = r.path[f] === i;
        const bg = nodeImg ? `background:url(assets/${nodeImg}.webp) ${(NODE[n.type].frame / 5) * 100}% 0/600% 100% no-repeat,#1a0f14;` : 'background:#1a0f14;';
        return `<button data-n="${i}" ${cur ? '' : 'disabled'} title="${NODE[n.type].name} · ${ARENAS[n.arena].name} · ${WEATHER[n.weather].name}" style="width:46px;height:46px;border-radius:50%;` +
          `${bg}border:2px solid ${cur ? '#e8b54a' : chosen ? '#8a1424' : '#3a2a30'};color:${n.type === 'boss' || n.type === 'elite' ? '#ff6a78' : '#f3e2c8'};` +
          `font-size:20px;cursor:${cur ? 'pointer' : 'default'};opacity:${past && !chosen ? 0.25 : 1};${cur ? 'box-shadow:0 0 10px #e8b54a;' : ''}">${nodeImg ? '' : NODE[n.type].icon}</button>`;
      }).join('') + '</div>';
    const deck = r.deck.map(id => `<span style="padding:2px 7px;border-radius:10px;background:#241218;font-size:11px">${UNITS[id].name}${r.cardLv[id] ? ` ${'★'.repeat(r.cardLv[id])}` : ''}</span>`).join(' ');
    const relics = r.relics.map(id => `<span title="${HRELICS[id].desc}">${icon(HRELICS[id].icon, 18)}</span>`).join('');
    const box = this.modal.show(`<h2>Caçada · etapa ${r.floor + 1}/${FLOORS}</h2>
      <div class="sub">${'♥'.repeat(r.lives)} voluntários · ${r.bones} ossos ${relics}</div>
      <div style="display:flex;gap:4px;overflow-x:auto;padding:6px 2px 10px;${nodeImg ? '' : ''}background:${this.hasBg() ? 'url(assets/hunt_map_bg.jpg) center/cover' : 'linear-gradient(90deg,#140b10,#1f1016)'};border-radius:10px">
        ${r.map.map(col).join('<div style="align-self:center;color:#4a3a38">›</div>')}</div>
      <div class="muted" style="font-size:12px;margin:6px 0">Toque num dos nós da etapa atual (brilhando). Deck: ${deck}</div>
      <button class="go" data-quit style="filter:brightness(.7)">Abandonar a Caçada</button>`, { wide: true, onClose: () => this.host.pause(false) });
    box.querySelectorAll<HTMLButtonElement>('[data-n]').forEach(b => b.onclick = () => this.enter(Number(b.dataset.n)));
    box.querySelector<HTMLButtonElement>('[data-quit]')!.onclick = () => { if (confirm('Abandonar? Você recebe as recompensas das etapas vencidas.')) this.over(false); };
  }

  private nodeArt() { return this.host.hasArt('hunt_nodes') ? 'hunt_nodes' : undefined; }
  private hasBg() { return this.host.hasArt('hunt_map_bg'); }

  private enter(i: number) {
    const r = this.run!;
    const n = r.map[r.floor][i];
    r.path[r.floor] = i;
    this.save();
    if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') this.fight(n);
    else if (n.type === 'event') this.event();
    else if (n.type === 'shop') this.shop();
    else this.rest();
  }

  private boost() {
    const b = { dmg: 0, hp: 0, gen: 0, cost: 0 };
    let bank = 150;
    for (const id of this.run!.relics) {
      const h = HRELICS[id];
      for (const k of Object.keys(h.boost ?? {}) as (keyof typeof b)[]) b[k] += h.boost![k]!;
      bank += h.bank ?? 0;
    }
    return { b, bank };
  }

  private fight(n: HNode) {
    const r = this.run!;
    const lanes = ARENAS[n.arena].lanes;
    const { b, bank } = this.boost();
    this.modal.close();
    const title = n.type === 'boss' ? 'Chefe: Mãe da Matilha' : n.type === 'elite' ? `Elite · etapa ${r.floor + 1}` : `Caçada · etapa ${r.floor + 1}`;
    this.host.battle({ raid: huntRaid(r.floor, n.type as 'battle' | 'elite' | 'boss', lanes), mode: 'hunt', arena: n.arena, weather: n.weather, deck: r.deck,
      cardLv: r.cardLv, lives: r.lives, bank, boost: b, title }, res => {
      this.host.pause(true);
      r.lives = Math.max(0, res.livesLeft);
      if (!res.won || r.lives <= 0) { this.over(false); return; }
      const bones = 10 + r.floor * 3 + (n.type === 'elite' ? 15 : 0);
      r.bones += bones;
      if (n.type === 'elite') this.giveRelic();
      if (n.type === 'boss') { this.over(true); return; }
      sfx.coin();
      this.draft(`+${bones} ossos${n.type === 'elite' ? ' · relíquia nova' : ''}`);
    });
  }

  // ---------- rewards ----------
  private offers(): Offer[] {
    const r = this.run!;
    const fresh = Phaser.Utils.Array.Shuffle((Object.keys(UNITS) as UnitId[]).filter(id => !r.deck.includes(id)));
    const ups = Phaser.Utils.Array.Shuffle(r.deck.filter(id => (r.cardLv[id] ?? 0) < 3));
    const out: Offer[] = [];
    for (const id of fresh.slice(0, 2)) out.push({ kind: 'card', id });
    if (ups[0]) out.push({ kind: 'up', id: ups[0] });
    while (out.length < 3 && fresh[out.length]) out.push({ kind: 'card', id: fresh[out.length] });
    return out;
  }

  private offerHtml(o: Offer, price?: number) {
    const u = UNITS[o.id], lv = this.run!.cardLv[o.id] ?? 0;
    return `<b>${o.kind === 'card' ? u.name : `${u.name} ★${lv + 1}`}</b><span style="font-size:12px">${o.kind === 'card' ? u.desc : '+20% de força nesta Caçada.'}</span>` +
      `<small>${o.kind === 'card' ? `Custo ${u.cost} Sangue` : 'Melhoria'}${price ? ` · ${price} ossos` : ''}</small>`;
  }

  private take(o: Offer) {
    const r = this.run!;
    if (o.kind === 'card') { r.deck.push(o.id); r.drafted.push(o.id); }
    else r.cardLv[o.id] = (r.cardLv[o.id] ?? 0) + 1;
  }

  private draft(gain: string) {
    const r = this.run!;
    const offers = this.offers();
    const box = this.modal.show(`<h2>Vitória!</h2><div class="sub">${gain} · escolha uma recompensa</div>
      <div class="cards3">${offers.map((o, i) => `<button class="pick" data-o="${i}">${this.offerHtml(o)}</button>`).join('')}</div>
      <button class="go" data-skip style="filter:brightness(.7)">Pular (+10 ossos)</button>`, { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-o]').forEach(b => b.onclick = () => { this.take(offers[Number(b.dataset.o)]); this.next(); });
    box.querySelector<HTMLButtonElement>('[data-skip]')!.onclick = () => { r.bones += 10; this.next(); };
  }

  giveRelic() {
    const r = this.run!;
    const pool = Object.keys(HRELICS).filter(id => !r.relics.includes(id));
    const id = Phaser.Utils.Array.GetRandom(pool);
    if (id) { r.relics.push(id); this.host.toast(`Relíquia da Caçada: ${HRELICS[id].name} (${HRELICS[id].desc})`, 'good'); }
  }

  giveCard() {
    const r = this.run!;
    const id = Phaser.Utils.Array.GetRandom((Object.keys(UNITS) as UnitId[]).filter(x => !r.deck.includes(x)));
    if (id) { r.deck.push(id); r.drafted.push(id); this.host.toast(`Nova carta na Caçada: ${UNITS[id].name}.`, 'good'); }
  }

  upgradeRandom() {
    const r = this.run!;
    const id = Phaser.Utils.Array.GetRandom(r.deck.filter(x => (r.cardLv[x] ?? 0) < 3));
    if (id) { r.cardLv[id] = (r.cardLv[id] ?? 0) + 1; this.host.toast(`${UNITS[id].name} melhorou (★${r.cardLv[id]}).`, 'good'); }
  }

  // ---------- other nodes ----------
  private event() {
    const r = this.run!;
    const ev = Phaser.Utils.Array.GetRandom(EVENTS);
    const box = this.modal.show(`<h2>${ev.title}</h2><div class="sub">${ev.text}</div>
      <div class="cards3" style="grid-template-columns:1fr 1fr"><button class="pick" data-a="1"><b>${ev.a}</b></button><button class="pick" data-a="0"><b>${ev.b}</b></button></div>`, { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-a]').forEach(b => b.onclick = () => { ev.run(r, b.dataset.a === '1', this); this.next(); });
  }

  private shop() {
    const r = this.run!;
    const cards = this.offers().filter(o => o.kind === 'card').slice(0, 2);
    const up = r.deck.filter(id => (r.cardLv[id] ?? 0) < 3)[0];
    const relic = Object.keys(HRELICS).find(id => !r.relics.includes(id));
    const items: { html: string; price: number; buy: () => void }[] = [
      ...cards.map(o => ({ html: this.offerHtml(o, 35), price: 35, buy: () => this.take(o) })),
      ...(up ? [{ html: this.offerHtml({ kind: 'up', id: up }, 30), price: 30, buy: () => this.take({ kind: 'up', id: up }) }] : []),
      { html: '<b>Curandeira</b><span style="font-size:12px">+2 voluntários</span><small>25 ossos</small>', price: 25, buy: () => { r.lives = Math.min(MAX_LIVES, r.lives + 2); } },
      ...(relic ? [{ html: `<b>${HRELICS[relic].name}</b><span style="font-size:12px">${HRELICS[relic].desc}</span><small>60 ossos</small>`, price: 60, buy: () => { r.relics.push(relic); } }] : []),
    ];
    const render = () => {
      const box = this.modal.show(`<h2>Mercador da Trilha</h2><div class="sub">${r.bones} ossos · ${'♥'.repeat(r.lives)}</div>
        <div class="cards3">${items.map((it, i) => `<button class="pick" data-i="${i}"${r.bones < it.price ? ' disabled style="opacity:.45"' : ''}>${it.html}</button>`).join('')}</div>
        <button class="go" data-go>Seguir viagem</button>`, { closable: false });
      box.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => b.onclick = () => {
        const it = items[Number(b.dataset.i)];
        if (r.bones < it.price) return;
        r.bones -= it.price;
        it.buy();
        items.splice(Number(b.dataset.i), 1);
        sfx.coin();
        this.save();
        render();
      });
      box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => this.next();
    };
    render();
  }

  private rest() {
    const r = this.run!;
    const up = r.deck.filter(id => (r.cardLv[id] ?? 0) < 3);
    const box = this.modal.show(`<h2>Fogueira</h2><div class="sub">Os voluntários descansam. Escolha uma coisa.</div>
      <div class="cards3" style="grid-template-columns:1fr 1fr"><button class="pick" data-a="heal"><b>Descansar</b><span>+2 voluntários</span></button>
      <button class="pick" data-a="up"${up.length ? '' : ' disabled'}><b>Treinar</b><span>Melhora uma carta aleatória do deck</span></button></div>`, { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-a]').forEach(b => b.onclick = () => {
      if (b.dataset.a === 'heal') r.lives = Math.min(MAX_LIVES, r.lives + 2); else this.upgradeRandom();
      this.next();
    });
  }

  private next() {
    const r = this.run!;
    r.floor++;
    this.save();
    if (r.floor >= FLOORS) { this.over(true); return; }
    this.map();
  }

  // ---------- end of the run ----------
  private over(won: boolean) {
    const r = this.run!;
    const floors = won ? FLOORS : r.floor;
    const marks = floors + (won ? 6 : 0), essence = floors * 12 + (won ? 60 : 0);
    const fresh = r.drafted.filter(id => !meta.cards.includes(id));
    meta.marks = (meta.marks ?? 0) + marks;
    meta.huntBest = Math.max(meta.huntBest ?? 0, floors);
    meta.hunts = (meta.hunts ?? 0) + 1;
    meta.cards = [...(meta.cards ?? []), ...fresh];
    saveMeta();
    state.resources.essence += essence;
    this.run = undefined;
    this.save();
    sfx[won ? 'chime' : 'bad']();
    const box = this.modal.show(`<h2>${won ? 'A Mãe da Matilha caiu!' : 'Fim da Caçada'}</h2>
      <div class="sub">${won ? 'Aureliano: Isso vai para os livros. Os livros que eu mesmo escrevo.' : `Etapas vencidas: ${floors}/${FLOORS}.`}</div>
      <div class="gains"><span>★ +${marks} marcas de caça</span><span>${icon('icon_research')} +${essence} Essência</span></div>
      ${fresh.length ? `<div class="row"><div class="t"><b>Novas cartas na defesa da fazenda</b><br><small>${fresh.map(id => UNITS[id].name).join(', ')}</small></div></div>` : ''}
      <button class="go" data-ok>Voltar à fazenda</button>`, { onClose: () => this.host.pause(false) });
    box.querySelector<HTMLButtonElement>('[data-ok]')!.onclick = () => this.modal.close();
  }
}
