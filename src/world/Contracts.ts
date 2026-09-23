// Human sheet + buyer contracts (GDD §6, §10): inspect a human, decide to keep or sell,
// send matching humans to the Boarding Yard and deliver them for Gold + Prestige.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { CONTRACTS, ContractDef, Requirement, BUYER_NAMES, MAX_OFFERS } from '../data/contracts';
import { BLOOD, QUALITY, TEMPER, TRAIT } from '../data/humans';
import { heirOdds } from '../sim/genetics';
import { fx, more } from '../core/bonus';

// Research can raise what buyers pay.
const goldOf = (d: ContractDef) => Math.round(d.reward.gold * more('contractGold') * state.mods.contractGold);
import { slotGeometry, FarmMap } from '../map/bosque';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';
import type { Buildings } from './Buildings';
import type { Human, Humans } from './Humans';
import { L } from '../core/i18n';

const def = (id: string) => CONTRACTS.find(c => c.id === id)!;
const SHORT: Record<string, string> = { rubelia: L('Rubélia', 'Rubelia'), hematico: L('Hemático', 'Hematic'), vesper: 'Vesper', merchant: L('Mercador', 'Merchant') };

export function meets(h: Human, r: Requirement) {
  const t = h.traits;
  return (!r.blood || t.blood === r.blood) && (!r.temper || t.temper === r.temper) && (!r.trait || t.trait === r.trait)
    && (!r.minQuality || QUALITY[t.quality].rank >= QUALITY[r.minQuality].rank) && (!r.minMorale || h.morale >= r.minMorale);
}

export function describe(r: Requirement) {
  const parts: string[] = [];
  if (r.blood) parts.push(BLOOD[r.blood].name);
  if (r.temper) parts.push(TEMPER[r.temper].name);
  if (r.trait) parts.push(TRAIT[r.trait].name);
  if (r.minQuality) parts.push(`${QUALITY[r.minQuality].name}+`);
  if (r.minMorale) parts.push(`${L('moral', 'morale')} ≥ ${r.minMorale}`);
  return parts.length ? parts.join(' · ') : L('qualquer humano', 'any human');
}

export class Contracts {
  private ring?: Phaser.GameObjects.Graphics;
  private selected?: Human;
  crownHook?: { can(h: Human): { ok: boolean; why?: string }; crown(h: Human): void };
  // Active contract helpers on the map: a golden aura under every human who fits, and a "Send" tag over their head.
  private auras = new Map<number, { aura: Phaser.GameObjects.Ellipse; tag: Phaser.GameObjects.Text }>();

  constructor(private scene: Phaser.Scene & { fx(k: string, x: number, y: number, s?: number): void }, private map: FarmMap, private humans: Humans, private buildings: Buildings,
    private panel: BuildPanel, private hud: Hud) {
    humans.onSelect = h => this.openHuman(h);
    bus.on('NIGHT_STARTED', ({ night }) => this.onNight(night));
    if (!state.contracts.offers.length && !state.contracts.active) this.refreshOffers();
  }

  get active() { return state.contracts.active ? def(state.contracts.active.id) : undefined; }
  private assigned() { return this.humans.all.filter(h => h.contract && h.contract === state.contracts.active?.id && !h.taken); }

  update() {
    // Selection ring follows the chosen human while their sheet is open.
    if (this.ring && this.selected) this.ring.setPosition(this.selected.sprite.x, this.selected.sprite.y - 2).setVisible(this.selected.sprite.visible);
    this.updateAuras();
    // Delivery happens once every requested human is standing at the yard.
    const c = this.active;
    if (!c) return;
    const a = this.assigned();
    if (a.length >= c.count && a.every(h => h.state === 'boarding')) this.deliver(c, a.slice(0, c.count));
  }

  // Rare humans can be turned into the region's vampire Regent (a pillar of the conquest).
  private regentHtml(h: Human) {
    if (!this.crownHook || !state.tutorial.done || h.name || QUALITY[h.traits.quality].rank < 2) return '';
    const c = this.crownHook.can(h);
    if (!c.ok && state.conquest.regent) return ''; // this region already has one
    return `<div class="card" style="border-color:#8a6aff;margin-top:8px"><h4>🦇 ${L('Transformar em Regente', 'Turn into Regent')}</h4><div class="muted">${L('Um vampiro para governar esta região em seu nome. Pilar da conquista.', 'A vampire to rule this region in your name. A pillar of the conquest.')}` +
      `</div><button class="go" data-a="regent"${c.ok ? '' : ' disabled'} style="background:#4a2a7a">${c.ok ? L('Transformar', 'Transform') : c.why}</button></div>`;
  }

  // ---------- contract auras ----------
  private updateAuras() {
    const c = this.active;
    const yard = this.buildings.level('boarding') > 0;
    const room = c ? this.assigned().length < c.count : false;
    const z = this.scene.cameras.main.zoom, now = this.scene.time.now;
    const seen = new Set<number>();
    if (c) for (const h of this.humans.all) {
      if (h.taken || !h.sprite.active) continue;
      const going = h.contract === c.id;
      const fits = !h.contract && meets(h, c.req);
      if (!going && !(fits && room)) continue;
      seen.add(h.id);
      let a = this.auras.get(h.id);
      if (!a) {
        const aura = this.scene.add.ellipse(0, 0, 64, 26, 0xe8b54a, 0.35).setStrokeStyle(3, 0xf6d9a0, 0.9).setBlendMode(Phaser.BlendModes.ADD);
        const tag = this.scene.add.text(0, 0, L('Enviar ao Pátio ▸', 'Send to the Yard ▸'), { fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold', color: '#1a0a0e',
          backgroundColor: '#e8b54a', padding: { x: 12, y: 6 } }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
        tag.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          if (p.getDistance() > 12) return; // it was a drag of the map
          if (!yard) { this.hud.toast(L('Bóris: Falta construir o Pátio de Embarque.', 'Boris: The Boarding Yard still needs to be built.')); return; }
          this.assign(h);
        });
        a = { aura, tag };
        this.auras.set(h.id, a);
      }
      const vis = h.sprite.visible && h.sprite.alpha > 0.3;
      const pulse = 1 + Math.sin(now / 250 + h.id) * 0.08;
      a.aura.setPosition(h.sprite.x, h.sprite.y - 3).setDepth(h.sprite.depth - 1).setVisible(vis).setScale(pulse)
        .setFillStyle(going ? 0x6fe07a : 0xe8b54a, 0.3).setStrokeStyle(3, going ? 0xa8ffb0 : 0xf6d9a0, 0.9);
      // Tag only for those who can still be sent (the ones already going just keep a green aura).
      a.tag.setVisible(vis && !going && yard).setScale(0.5 / z).setPosition(h.sprite.x, h.sprite.y - h.sprite.displayHeight - 10 / z).setDepth(2.2e6);
    }
    for (const [id, a] of this.auras) if (!seen.has(id)) { a.aura.destroy(); a.tag.destroy(); this.auras.delete(id); }
  }

  // ---------- human sheet ----------
  openHuman(h: Human) {
    bus.emit('HUMAN_INSPECTED', { humanId: h.id });
    this.select(h);
    const t = h.traits, c = this.active;
    const meter = (label: string, v: number, color: string) =>
      `<div class="row"><span style="width:74px">${label}</span><div class="meter"><i style="width:${Math.round(v)}%;background:${color}"></i></div><span style="width:28px;text-align:right">${Math.round(v)}</span></div>`;
    const tag = (img: string, text: string) => `<span class="tag"><img src="assets/${img}.webp" alt="">${text}</span>`;
    const value = Math.round(80 * QUALITY[t.quality].mult * (t.blood === 'carmesim' ? 3 : t.blood === 'umbra' ? 1.5 : 1) * (t.trait ? 1.6 : 1));
    let action: string;
    if (h.contract) action = `<button class="go" data-a="unassign">${L('Retirar do contrato', 'Remove from contract')}</button>`;
    else if (h.name) action = `<p class="muted">${L(`${h.name.split(' ')[0]} não está à venda: personagens da história ficam na fazenda.`, `${h.name.split(' ')[0]} is not for sale: story characters stay on the farm.`)}</p>`;
    else if (!c) action = `<p class="muted">${L('Nenhum contrato ativo. Veja as ofertas no pergaminho do HUD.', 'No active contract. See the offers in the HUD scroll.')}</p>`;
    else if (!meets(h, c.req)) action = `<p class="muted">${L('Não atende ao contrato atual', 'Doesn\'t fit the current contract')} (${describe(c.req)}).</p>`;
    else if (!this.buildings.level('boarding')) action = `<p class="muted">${L('Atende ao contrato, mas falta construir o Pátio de Embarque.', 'Fits the contract, but the Boarding Yard isn\'t built yet.')}</p>`;
    else action = `<button class="go" data-a="assign">${L('Enviar ao Pátio', 'Send to the Yard')} · ${c.title}</button>`;
    this.panel.open({
      title: h.name ?? `${L('Unidade', 'Unit')} ${t.code}`,
      subtitle: `${QUALITY[t.quality].name} · ${L(`valor estimado ${value} Ouro`, `estimated value ${value} Gold`)}`,
      desc: '',
      stats: [],
      html: `<div class="tags">${tag(`blood_${t.blood}`, BLOOD[t.blood].name)}${tag(`quality_${t.quality}`, QUALITY[t.quality].name)}` +
        `${tag(`temper_${t.temper}`, TEMPER[t.temper].name)}${t.trait ? tag(`trait_${t.trait}`, TRAIT[t.trait].name) : ''}</div>` +
        meter(L('Vitalidade', 'Vitality'), h.vitality, '#d8122a') + meter(L('Moral', 'Morale'), h.morale, '#6fbf73') + meter(L('Fome', 'Hunger'), h.hunger, '#e8b54a') +
        `<p class="muted" style="margin:8px 0">${TEMPER[t.temper].desc}${t.trait ? ` ${TRAIT[t.trait].desc}` : ''}</p>` +
        `<div style="display:flex;gap:6px;margin-bottom:8px"><button class="go" data-a="collect"${this.humans.canQueue(h) ? '' : ' disabled'}>${L('Enviar à coleta', 'Send to collection')}</button>` +
        `<button class="go" data-a="feed"${state.resources.food >= 1 && h.hunger > 5 ? '' : ' disabled'}>${L('Alimentar · 1 Comida', 'Feed · 1 Food')}</button></div>` +
        this.bondHtml(h) + action + this.regentHtml(h),
      bind: root => {
        root.querySelector<HTMLButtonElement>('[data-a="assign"]')?.addEventListener('click', () => this.assign(h));
        root.querySelector<HTMLButtonElement>('[data-a="regent"]')?.addEventListener('click', () => {
          if (confirm(L(`Transformar ${this.label(h)} em vampiro Regente? Ele deixa o rebanho para governar a região.`, `Turn ${this.label(h)} into a vampire Regent? They leave the herd to rule the region.`))) { this.crownHook!.crown(h); this.panel.close(); }
        });
        root.querySelector<HTMLButtonElement>('[data-a="unassign"]')?.addEventListener('click', () => { this.humans.unassign(h); this.openHuman(h); });
        root.querySelector<HTMLButtonElement>('[data-a="pair"]')?.addEventListener('click', () => this.openPairing(h));
        root.querySelector<HTMLButtonElement>('[data-a="collect"]')?.addEventListener('click', () => {
          if (this.humans.sendToCollect(h)) { this.hud.toast(L(`${this.label(h)} entrou na fila de coleta.`, `${this.label(h)} joined the collection line.`)); this.panel.close(); }
        });
        root.querySelector<HTMLButtonElement>('[data-a="feed"]')?.addEventListener('click', () => { if (this.humans.feed(h)) this.openHuman(h); });
        root.querySelector<HTMLButtonElement>('[data-a="unpair"]')?.addEventListener('click', () => {
          if (confirm(L('Desfazer o par? O progresso do parente se perde.', 'Break up the pair? The relative\'s progress is lost.'))) { this.humans.unbond(h); this.openHuman(h); }
        });
      },
      onClose: () => this.select(undefined),
    });
  }

  // ---------- bonds (GDD_ADENDO A2) ----------
  private label(h: Human) { return h.name ?? `${L('Unidade', 'Unit')} ${h.traits.code}`; }

  private bondHtml(h: Human) {
    const p = this.humans.partnerOf(h);
    if (!p) {
      return `<div class="row" style="margin:6px 0"><span>♡ ${L('Sem par', 'Single')}</span></div>` +
        (h.contract ? '' : `<button class="go" data-a="pair" style="margin-bottom:8px">${L('Formar par', 'Make a pair')}</button>`);
    }
    const family = this.buildings.built('family').length > 0;
    const kin = Math.round(this.humans.kinOf(h));
    const odds = heirOdds(h.traits, p.traits, fx('heirQ'));
    return `<div class="card"><div>❤ ${L('Par', 'Partner')}: <b>${this.label(p)}</b> · ${BLOOD[p.traits.blood].name} · ${QUALITY[p.traits.quality].name}</div>` +
      (family ? `<div class="row"><span style="width:74px">${L('Parente', 'Relative')}</span><div class="meter"><i style="width:${kin}%;background:#ff8a8a"></i></div><span style="width:28px;text-align:right">${kin}</span></div>`
        : `<div class="muted">${L('Construa a Casa das Famílias para o casal mandar buscar parentes.', 'Build the Family House so the couple can send for relatives.')}</div>`) +
      `<div class="muted">${L('Chance de o parente subir de qualidade', 'Chance the relative rises in quality')}: ${odds.upgrade}%${odds.combo ? ` · ${odds.combo.pct}% ${L('de sair', 'to be born')} ${BLOOD[odds.combo.out].name}` : ''}</div>` +
      `<button class="go" data-a="unpair" style="margin-top:6px">${L('Desfazer par', 'Break up')}</button></div>`;
  }

  // Arranged pairing: pick a partner, best candidates first, with the odds for their heirs.
  private openPairing(h: Human) {
    const cands = this.humans.singles().filter(x => x !== h && !x.contract)
      .sort((a, b) => QUALITY[b.traits.quality].rank - QUALITY[a.traits.quality].rank);
    const row = (c: Human) => {
      const o = heirOdds(h.traits, c.traits, fx('heirQ'));
      return `<div class="card"><h4>${this.label(c)}</h4><div class="muted">${BLOOD[c.traits.blood].name} · ${QUALITY[c.traits.quality].name} · ${TEMPER[c.traits.temper].name}` +
        `${c.traits.trait ? ` · ${TRAIT[c.traits.trait].name}` : ''}</div><div class="muted">${L('Qualidade do parente sobe', 'Relative quality rises')}: ${o.upgrade}%` +
        `${o.combo ? ` · ${o.combo.pct}% ${BLOOD[o.combo.out].name}` : ''}</div><button class="go" data-pair="${c.id}">${L('Formar par', 'Make a pair')}</button></div>`;
    };
    this.panel.open({
      title: L(`Par para ${this.label(h)}`, `Partner for ${this.label(h)}`),
      subtitle: L('Bóris registra como "parceria estratégica"', 'Boris files it as a "strategic partnership"'),
      desc: '',
      stats: [],
      html: cands.length ? cands.map(row).join('') : `<p class="muted">${L('Ninguém disponível. Todo mundo já tem par.', 'Nobody available. Everyone already has a partner.')}</p>`,
      bind: root => root.querySelectorAll<HTMLButtonElement>('[data-pair]').forEach(b => b.addEventListener('click', () => {
        const c = this.humans.all.find(x => x.id === Number(b.dataset.pair));
        if (c) { this.humans.bond(h, c, true); this.openHuman(h); }
      })),
      onClose: () => this.select(undefined),
    });
  }

  private select(h?: Human) {
    this.selected = h;
    this.ring?.destroy();
    this.ring = undefined;
    if (!h) return;
    this.ring = this.scene.add.graphics().setDepth(h.sprite.depth - 1);
    this.ring.lineStyle(3, 0xe8b54a, 1).strokeEllipse(0, 0, 44, 20);
    this.scene.tweens.add({ targets: this.ring, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
  }

  private assign(h: Human) {
    const c = this.active;
    if (!c) return;
    if (this.assigned().length >= c.count) { this.hud.toast(L('Bóris: O contrato já tem gente suficiente no pátio.', 'Boris: The contract already has enough people in the yard.')); return; }
    this.humans.assign(h, c.id);
    const n = this.assigned().length;
    this.hud.toast(L(`${n}/${c.count} a caminho do Pátio de Embarque.`, `${n}/${c.count} on the way to the Boarding Yard.`));
    this.panel.close();
  }

  // ---------- contracts ----------
  openBoard() {
    const c = this.active;
    const offers = state.contracts.offers.map(def);
    const card = (d: ContractDef, active: boolean) => {
      const eligible = this.humans.all.filter(h => !h.taken && meets(h, d.req)).length;
      const left = active ? state.contracts.active!.night + d.nights - state.night.night : d.nights;
      return `<div class="card"><h4>${d.title}</h4><div class="muted">${BUYER_NAMES[d.buyer]} · ${L(`prazo ${left} noite${left === 1 ? '' : 's'}`, `due in ${left} night${left === 1 ? '' : 's'}`)}</div>` +
        `<div style="margin:5px 0">${d.count}× ${describe(d.req)}</div>` +
        `<div class="muted">${L(`Recompensa: ${goldOf(d)} Ouro · ${d.reward.prestige} Prestígio · você tem ${eligible} elegíve${eligible === 1 ? 'l' : 'is'}`, `Reward: ${goldOf(d)} Gold · ${d.reward.prestige} Prestige · you have ${eligible} eligible`)}</div>` +
        (active ? `<div style="margin-top:5px">${L('No pátio', 'In the yard')}: ${this.assigned().length}/${d.count}</div><button class="go" data-cancel>${L('Desistir', 'Give up')}</button>`
          : c ? '' : `<button class="go" data-accept="${d.id}">${L('Aceitar', 'Accept')}</button>`) + '</div>';
    };
    this.panel.open({
      title: L('Contratos', 'Contracts'),
      subtitle: c ? L('Um contrato ativo por vez', 'One active contract at a time') : L('Escolha um comprador', 'Choose a buyer'),
      desc: '',
      stats: [],
      html: (c ? card(c, true) : '') + (offers.length ? offers.map(d => card(d, false)).join('')
        : `<p class="muted">${L('Sem ofertas agora. Novos compradores chegam a cada noite.', 'No offers right now. New buyers arrive every night.')}</p>`) +
        `<p class="muted">${L('Toque num humano para ver a ficha e enviá-lo ao Pátio de Embarque. Humanos vendidos deixam a fazenda.', 'Tap a human to see their record and send them to the Boarding Yard. Sold humans leave the farm.')}</p>`,
      bind: root => {
        root.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach(b => b.addEventListener('click', () => this.accept(b.dataset.accept!)));
        root.querySelector('[data-cancel]')?.addEventListener('click', () => { if (confirm(L('Desistir do contrato? O comprador não vai gostar.', 'Give up the contract? The buyer won\'t like it.'))) this.fail(true); });
      },
    });
  }

  private accept(id: string) {
    const d = def(id);
    state.contracts.active = { id, night: state.night.night };
    state.contracts.offers = state.contracts.offers.filter(o => o !== id);
    bus.emit('CONTRACT_ACCEPTED', { contractId: id });
    this.hud.toast(`${SHORT[d.buyer] ?? BUYER_NAMES[d.buyer]}: ${d.intro}`, '', 8000);
    this.panel.close();
  }

  private deliver(d: ContractDef, who: Human[]) {
    const yard = this.map.slots.find(s => s.id === 'boarding');
    const exit = yard ? slotGeometry(yard).front : { x: 0, y: 2000 };
    for (const h of who) this.humans.sell(h, { x: exit.x - 120, y: exit.y + 80 });
    const gold = goldOf(d);
    state.resources.gold += gold;
    state.resources.prestige += d.reward.prestige;
    state.contracts.active = undefined;
    if (!state.contracts.done.includes(d.id)) state.contracts.done.push(d.id);
    bus.emit('CONTRACT_COMPLETED', { contractId: d.id, delivered: who.length, gold });
    this.hud.toast(`${SHORT[d.buyer] ?? BUYER_NAMES[d.buyer]}: ${d.done}`, 'good', 7000);
    this.hud.toast(L(`Contrato entregue: +${gold} Ouro · +${d.reward.prestige} Prestígio`, `Contract delivered: +${gold} Gold · +${d.reward.prestige} Prestige`), 'good');
    this.scene.fx('fx_coins', exit.x, exit.y - 60, 1.6);
    if (state.contracts.offers.length < 1) this.refreshOffers();
  }

  private fail(gaveUp = false) {
    const d = this.active;
    if (!d) return;
    for (const h of this.assigned()) this.humans.unassign(h);
    state.contracts.active = undefined;
    state.resources.prestige = Math.max(0, state.resources.prestige - 5);
    bus.emit('CONTRACT_FAILED', { contractId: d.id });
    this.hud.toast(gaveUp ? L('Contrato cancelado. −5 Prestígio.', 'Contract cancelled. −5 Prestige.') : `${SHORT[d.buyer] ?? BUYER_NAMES[d.buyer]}: ${L('O prazo acabou. Vou lembrar disso. (−5 Prestígio)', 'Time\'s up. I\'ll remember this. (−5 Prestige)')}`, 'bad', 6000);
    this.panel.close();
  }

  private onNight(night: number) {
    const a = state.contracts.active;
    if (a && night > a.night + def(a.id).nights) this.fail();
    this.refreshOffers();
  }

  // New buyers every night; the tutorial order stays until it's done.
  private refreshOffers() {
    const keep = state.contracts.offers.filter(id => def(id).tutorialOnly);
    const pool = Phaser.Utils.Array.Shuffle(CONTRACTS.filter(c => !c.tutorialOnly && c.id !== state.contracts.active?.id).map(c => c.id));
    state.contracts.offers = [...keep, ...pool].slice(0, MAX_OFFERS + fx('offers'));
  }
}
