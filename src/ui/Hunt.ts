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
import { L } from '../core/i18n';

type NodeType = 'battle' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';
interface HNode { type: NodeType; arena: ArenaId; weather: WeatherId }
interface Offer { kind: 'card' | 'up'; id: UnitId }
interface Run { floor: number; lives: number; deck: UnitId[]; cardLv: Record<string, number>; relics: string[]; bones: number; map: HNode[][]; path: number[]; drafted: UnitId[] }

const FLOORS = 12;
const START_DECK: UnitId[] = ['chalice', 'sentinel', 'wall', 'maid'];
const MAX_LIVES = 8;
const KEY = 'hemo.hunt';

const NODE_DESC: Record<NodeType, string> = {
  battle: L('Uma luta normal. Vencer dá ossos e a escolha de uma carta nova (ou melhoria) para o seu deck.', 'A normal fight. Winning gives bones and a choice of a new card (or upgrade) for your deck.'),
  elite: L('Luta difícil com um líder da matilha. Vencer dá mais ossos e uma relíquia da Caçada.', 'A hard fight with a pack leader. Winning gives more bones and a Hunt relic.'),
  event: L('Um encontro na trilha com duas escolhas. Pode dar vidas, ossos, cartas... ou custar algo.', 'An encounter on the trail with two choices. It may give lives, bones, cards... or cost you something.'),
  shop: L('Gaste ossos em cartas, melhorias, voluntários e relíquias.', 'Spend bones on cards, upgrades, volunteers and relics.'),
  rest: L('Descanse (+2 voluntários) ou treine (melhora uma carta).', 'Rest (+2 volunteers) or train (upgrade a card).'),
  boss: L('A Mãe da Matilha. Vencê-la termina a Caçada com a recompensa máxima.', 'The Pack Mother. Beating her ends the Hunt with the top reward.'),
};

const NODE: Record<NodeType, { name: string; icon: string; frame: number }> = {
  battle: { name: L('Batalha', 'Battle'), icon: '⚔', frame: 0 }, elite: { name: 'Elite', icon: '☠', frame: 1 }, event: { name: L('Evento', 'Event'), icon: '?', frame: 2 },
  shop: { name: L('Mercador', 'Merchant'), icon: '⚖', frame: 3 }, rest: { name: L('Fogueira', 'Campfire'), icon: '🔥', frame: 4 }, boss: { name: L('Mãe da Matilha', 'Pack Mother'), icon: '☾', frame: 5 },
};

// Battle-only relics of the hunt.
const HRELICS: Record<string, { name: string; desc: string; icon: string; boost?: { dmg?: number; hp?: number; gen?: number; cost?: number }; bank?: number }> = {
  presas: { name: L('Presas de Lua', 'Moon Fangs'), desc: L('Defensores +20% de dano.', 'Defenders +20% damage.'), icon: 'icon_defense', boost: { dmg: 0.2 } },
  escudo: { name: L('Brasão da Casa', 'House Crest'), desc: L('Defensores +25% de vida.', 'Defenders +25% health.'), icon: 'icon_defense', boost: { hp: 0.25 } },
  calice: { name: L('Cálice de Prata', 'Silver Chalice'), desc: L('Geradores +40% de Sangue.', 'Generators +40% Blood.'), icon: 'icon_blood', boost: { gen: 0.4 } },
  bolsa: { name: L('Bolsa do Tesoureiro', 'Treasurer\'s Purse'), desc: L('Cartas 10% mais baratas.', 'Cards 10% cheaper.'), icon: 'icon_gold', boost: { cost: 0.1 } },
  reserva: { name: L('Reserva de Sangue', 'Blood Reserve'), desc: L('+60 de Sangue no início de cada luta.', '+60 Blood at the start of each fight.'), icon: 'icon_blood', bank: 60 },
  foice: { name: L('Foice Afiada', 'Sharpened Scythe'), desc: L('Defensores +10% de dano e +10% de vida.', 'Defenders +10% damage and +10% health.'), icon: 'icon_defense', boost: { dmg: 0.1, hp: 0.1 } },
};

const EVENTS = [
  { title: L('Aldeões assustados', 'Frightened villagers'), text: L('Uma família foge dos lobos pela trilha e pede abrigo atrás das suas linhas.', 'A family fleeing the wolves down the trail asks for shelter behind your lines.'),
    a: L('Acolher (+1 voluntário)', 'Take them in (+1 volunteer)'), b: L('Pedir pagamento (+25 ossos)', 'Ask for payment (+25 bones)'),
    run: (r: Run, a: boolean) => { if (a) r.lives = Math.min(MAX_LIVES, r.lives + 1); else r.bones += 25; } },
  { title: L('Altar de Sangue', 'Blood Altar'), text: L('Uma pedra antiga pede um tributo. Em troca, oferece poder.', 'An ancient stone asks for tribute. In return, it offers power.'),
    a: L('Oferecer um voluntário (relíquia)', 'Offer a volunteer (relic)'), b: L('Seguir em frente', 'Move on'),
    run: (r: Run, a: boolean, h: Hunt) => { if (a && r.lives > 1) { r.lives--; h.giveRelic(); } } },
  { title: L('Ferreiro Ghoul', 'Ghoul Blacksmith'), text: L('Um ghoul de avental afia armas por um punhado de ossos.', 'A ghoul in an apron sharpens weapons for a handful of bones.'),
    a: L('Pagar 20 ossos (melhora uma carta)', 'Pay 20 bones (upgrade a card)'), b: L('Recusar', 'Refuse'),
    run: (r: Run, a: boolean, h: Hunt) => { if (a && r.bones >= 20) { r.bones -= 20; h.upgradeRandom(); } } },
  { title: L('Cova Aberta', 'Open Grave'), text: L('Uma cova recém-aberta, cheia de ossos... e de lobos dormindo em volta.', 'A freshly dug grave, full of bones... and with wolves sleeping around it.'),
    a: L('Saquear (+40 ossos, −1 voluntário)', 'Loot it (+40 bones, −1 volunteer)'), b: L('Deixar quieto', 'Leave it be'),
    run: (r: Run, a: boolean) => { if (a && r.lives > 1) { r.bones += 40; r.lives--; } } },
  { title: L('Vampiro Errante', 'Wandering Vampire'), text: L('Um vampiro sem casa oferece seus serviços por uma noite de abrigo.', 'A houseless vampire offers his services for a night\'s shelter.'),
    a: L('Recrutar (carta nova)', 'Recruit (new card)'), b: L('Pedir ossos (+15)', 'Ask for bones (+15)'),
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
    const box = this.modal.show(L(`<h2>Caçada</h2><div class="sub">Uma campanha longa contra a matilha, longe da fazenda</div>
      <div class="row"><div class="t"><b>O que é</b><br><small>Aureliano leva um grupo de voluntários floresta adentro para caçar a matilha antes que ela chegue à fazenda.
      É uma sequência de batalhas de tower defense, separada da fazenda: <b>nada da fazenda é gasto e ninguém da fazenda é levado</b>.</small></div></div>
      <div class="row"><div class="t"><b>Como jogar</b><br><small>1. Um mapa com 12 etapas; em cada uma você escolhe um caminho (⚔ batalha, ☠ elite, ? evento, ⚖ mercador, 🔥 fogueira).<br>
      2. Você começa com 4 cartas e 5 voluntários (vidas). Cada lobo que passa pela cerca custa um voluntário.<br>
      3. Após cada vitória, escolha uma carta nova ou melhore uma do deck. O deck cresce a cada luta.<br>
      4. No fim, a Mãe da Matilha. Se os voluntários acabarem, a Caçada termina com o que você já conquistou.</small></div></div>
      <div class="row"><div class="t"><b>Recompensas</b><br><small>Marcas de caça (Arsenal), Essência para a fazenda, e toda carta conquistada passa a defender a fazenda também.</small></div></div>
      <div class="row"><div class="t"><small>Melhor etapa: ${meta.huntBest ?? 0}/${FLOORS} · Caçadas: ${meta.hunts ?? 0} · Cartas liberadas na fazenda: ${meta.cards?.length ?? 0}</small></div></div>
      <button class="go" data-go>Começar a Caçada</button>`, `<h2>The Hunt</h2><div class="sub">A long campaign against the pack, far from the farm</div>
      <div class="row"><div class="t"><b>What it is</b><br><small>Aureliano leads a group of volunteers deep into the forest to hunt the pack before it reaches the farm.
      It's a series of tower defense battles, separate from the farm: <b>nothing from the farm is spent and nobody from the farm is taken</b>.</small></div></div>
      <div class="row"><div class="t"><b>How to play</b><br><small>1. A map with 12 stages; at each one you choose a path (⚔ battle, ☠ elite, ? event, ⚖ merchant, 🔥 campfire).<br>
      2. You start with 4 cards and 5 volunteers (lives). Every wolf that gets past the fence costs a volunteer.<br>
      3. After each win, pick a new card or upgrade one in your deck. The deck grows with every fight.<br>
      4. At the end, the Pack Mother. If you run out of volunteers, the Hunt ends with what you've already won.</small></div></div>
      <div class="row"><div class="t"><b>Rewards</b><br><small>Hunt marks (Armory), Essence for the farm, and every card you win defends the farm too.</small></div></div>
      <div class="row"><div class="t"><small>Best stage: ${meta.huntBest ?? 0}/${FLOORS} · Hunts: ${meta.hunts ?? 0} · Cards unlocked on the farm: ${meta.cards?.length ?? 0}</small></div></div>
      <button class="go" data-go>Start the Hunt</button>`), { onClose: () => this.host.pause(false) });
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
    const box = this.modal.show(`<h2>${L('Caçada · etapa', 'Hunt · stage')} ${r.floor + 1}/${FLOORS}</h2>
      <div class="sub">${'♥'.repeat(r.lives)} ${L('voluntários', 'volunteers')} · ${r.bones} ${L('ossos', 'bones')} ${relics}</div>
      <div style="display:flex;gap:4px;overflow-x:auto;padding:6px 2px 10px;${nodeImg ? '' : ''}background:${this.hasBg() ? 'url(assets/hunt_map_bg.jpg) center/cover' : 'linear-gradient(90deg,#140b10,#1f1016)'};border-radius:10px">
        ${r.map.map(col).join('<div style="align-self:center;color:#4a3a38">›</div>')}</div>
      <div class="muted" style="font-size:12px;margin:6px 0">${L('⚔ batalha · ☠ elite · ? evento · ⚖ mercador · 🔥 fogueira · ☾ chefe — toque num nó <b>brilhando</b> para ver o que é.', '⚔ battle · ☠ elite · ? event · ⚖ merchant · 🔥 campfire · ☾ boss — tap a <b>glowing</b> node to see what it is.')}<br>Deck: ${deck}</div>
      <button class="go" data-quit style="filter:brightness(.7)">${L('Abandonar a Caçada', 'Abandon the Hunt')}</button>`, { wide: true, onClose: () => this.host.pause(false) });
    box.querySelectorAll<HTMLButtonElement>('[data-n]').forEach(b => b.onclick = () => this.peek(Number(b.dataset.n)));
    box.querySelector<HTMLButtonElement>('[data-quit]')!.onclick = () => { if (confirm(L('Abandonar? Você recebe as recompensas das etapas vencidas.', 'Abandon? You get the rewards for the stages you won.'))) this.over(false); };
  }

  // Explain a node before committing to it.
  private peek(i: number) {
    const r = this.run!, n = r.map[r.floor][i];
    const fight = n.type === 'battle' || n.type === 'elite' || n.type === 'boss';
    const w = WEATHER[n.weather], a = ARENAS[n.arena];
    const box = this.modal.show(`<h2>${NODE[n.type].icon} ${NODE[n.type].name}</h2><div class="sub">${L('Etapa', 'Stage')} ${r.floor + 1}/${FLOORS}</div>
      <div class="row"><div class="t">${NODE_DESC[n.type]}</div></div>
      ${fight ? `<div class="row"><div class="t"><b>${a.name}</b> · ${a.lanes} ${L('raias', 'lanes')}<br><small>${a.desc}</small></div></div>
      <div class="row"><div class="t"><b>${w.icon} ${w.name}</b><br><small>${w.desc}</small></div></div>` : ''}
      <div class="cards3" style="grid-template-columns:1fr 1fr"><button class="pick" data-back><b>${L('Voltar ao mapa', 'Back to the map')}</b></button><button class="pick" data-go style="border-color:#e8b54a"><b>${fight ? L('Lutar', 'Fight') : L('Seguir', 'Go')} ▸</b></button></div>`,
      { onClose: () => this.host.pause(false) });
    box.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => this.map();
    box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => this.enter(i);
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
    const title = n.type === 'boss' ? L('Chefe: Mãe da Matilha', 'Boss: Pack Mother') : n.type === 'elite' ? `Elite · ${L('etapa', 'stage')} ${r.floor + 1}` : `${L('Caçada · etapa', 'Hunt · stage')} ${r.floor + 1}`;
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
      this.draft(`+${bones} ${L('ossos', 'bones')}${n.type === 'elite' ? L(' · relíquia nova', ' · new relic') : ''}`);
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
    return `<b>${o.kind === 'card' ? u.name : `${u.name} ★${lv + 1}`}</b><span style="font-size:12px">${o.kind === 'card' ? u.desc : L('+20% de força nesta Caçada.', '+20% strength in this Hunt.')}</span>` +
      `<small>${o.kind === 'card' ? L(`Custo ${u.cost} Sangue`, `Costs ${u.cost} Blood`) : L('Melhoria', 'Upgrade')}${price ? ` · ${price} ${L('ossos', 'bones')}` : ''}</small>`;
  }

  private take(o: Offer) {
    const r = this.run!;
    if (o.kind === 'card') { r.deck.push(o.id); r.drafted.push(o.id); }
    else r.cardLv[o.id] = (r.cardLv[o.id] ?? 0) + 1;
  }

  private draft(gain: string) {
    const r = this.run!;
    const offers = this.offers();
    const box = this.modal.show(`<h2>${L('Vitória!', 'Victory!')}</h2><div class="sub">${gain} · ${L('escolha uma recompensa', 'choose a reward')}</div>
      <div class="cards3">${offers.map((o, i) => `<button class="pick" data-o="${i}">${this.offerHtml(o)}</button>`).join('')}</div>
      <button class="go" data-skip style="filter:brightness(.7)">${L('Pular (+10 ossos)', 'Skip (+10 bones)')}</button>`, { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-o]').forEach(b => b.onclick = () => { this.take(offers[Number(b.dataset.o)]); this.next(); });
    box.querySelector<HTMLButtonElement>('[data-skip]')!.onclick = () => { r.bones += 10; this.next(); };
  }

  giveRelic() {
    const r = this.run!;
    const pool = Object.keys(HRELICS).filter(id => !r.relics.includes(id));
    const id = Phaser.Utils.Array.GetRandom(pool);
    if (id) { r.relics.push(id); this.host.toast(`${L('Relíquia da Caçada', 'Hunt relic')}: ${HRELICS[id].name} (${HRELICS[id].desc})`, 'good'); }
  }

  giveCard() {
    const r = this.run!;
    const id = Phaser.Utils.Array.GetRandom((Object.keys(UNITS) as UnitId[]).filter(x => !r.deck.includes(x)));
    if (id) { r.deck.push(id); r.drafted.push(id); this.host.toast(`${L('Nova carta na Caçada', 'New card in the Hunt')}: ${UNITS[id].name}.`, 'good'); }
  }

  upgradeRandom() {
    const r = this.run!;
    const id = Phaser.Utils.Array.GetRandom(r.deck.filter(x => (r.cardLv[x] ?? 0) < 3));
    if (id) { r.cardLv[id] = (r.cardLv[id] ?? 0) + 1; this.host.toast(L(`${UNITS[id].name} melhorou (★${r.cardLv[id]}).`, `${UNITS[id].name} improved (★${r.cardLv[id]}).`), 'good'); }
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
      { html: L('<b>Curandeira</b><span style="font-size:12px">+2 voluntários</span><small>25 ossos</small>', '<b>Healer</b><span style="font-size:12px">+2 volunteers</span><small>25 bones</small>'), price: 25, buy: () => { r.lives = Math.min(MAX_LIVES, r.lives + 2); } },
      ...(relic ? [{ html: `<b>${HRELICS[relic].name}</b><span style="font-size:12px">${HRELICS[relic].desc}</span><small>60 ${L('ossos', 'bones')}</small>`, price: 60, buy: () => { r.relics.push(relic); } }] : []),
    ];
    const render = () => {
      const box = this.modal.show(`<h2>${L('Mercador da Trilha', 'Trail Merchant')}</h2><div class="sub">${r.bones} ${L('ossos', 'bones')} · ${'♥'.repeat(r.lives)}</div>
        <div class="cards3">${items.map((it, i) => `<button class="pick" data-i="${i}"${r.bones < it.price ? ' disabled style="opacity:.45"' : ''}>${it.html}</button>`).join('')}</div>
        <button class="go" data-go>${L('Seguir viagem', 'Move on')}</button>`, { closable: false });
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
    const box = this.modal.show(`<h2>${L('Fogueira', 'Campfire')}</h2><div class="sub">${L('Os voluntários descansam. Escolha uma coisa.', 'The volunteers rest. Choose one thing.')}</div>
      <div class="cards3" style="grid-template-columns:1fr 1fr"><button class="pick" data-a="heal"><b>${L('Descansar', 'Rest')}</b><span>${L('+2 voluntários', '+2 volunteers')}</span></button>
      <button class="pick" data-a="up"${up.length ? '' : ' disabled'}><b>${L('Treinar', 'Train')}</b><span>${L('Melhora uma carta aleatória do deck', 'Upgrades a random card in the deck')}</span></button></div>`, { closable: false });
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
    // She only truly falls in the story's last chapter; in the Hunt she retreats into the forest.
    const box = this.modal.show(`<h2>${won ? L('A Mãe da Matilha recuou!', 'The Pack Mother retreated!') : L('Fim da Caçada', 'The Hunt is over')}</h2>
      <div class="sub">${won ? L('Aureliano: Ela sumiu entre as árvores, sem pressa. Como se voltasse para casa. Isso vai para os livros.', 'Aureliano: She vanished into the trees, unhurried. As if heading home. This goes in the books.') : L(`Etapas vencidas: ${floors}/${FLOORS}.`, `Stages won: ${floors}/${FLOORS}.`)}</div>
      <div class="gains"><span>★ +${marks} ${L('marcas de caça', 'hunt marks')}</span><span>${icon('icon_research')} +${essence} ${L('Essência', 'Essence')}</span></div>
      ${fresh.length ? `<div class="row"><div class="t"><b>${L('Novas cartas na defesa da fazenda', 'New cards for the farm\'s defense')}</b><br><small>${fresh.map(id => UNITS[id].name).join(', ')}</small></div></div>` : ''}
      <button class="go" data-ok>${L('Voltar à fazenda', 'Back to the farm')}</button>`, { onClose: () => this.host.pause(false) });
    box.querySelector<HTMLButtonElement>('[data-ok]')!.onclick = () => this.modal.close();
  }
}
