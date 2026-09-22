// Human sheet + buyer contracts (GDD §6, §10): inspect a human, decide to keep or sell,
// send matching humans to the Boarding Yard and deliver them for Gold + Prestige.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { CONTRACTS, ContractDef, Requirement, BUYER_NAMES, MAX_OFFERS } from '../data/contracts';
import { BLOOD, QUALITY, TEMPER, TRAIT } from '../data/humans';
import { slotGeometry, FarmMap } from '../map/bosque';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';
import type { Buildings } from './Buildings';
import type { Human, Humans } from './Humans';

const def = (id: string) => CONTRACTS.find(c => c.id === id)!;
const SHORT: Record<string, string> = { rubelia: 'Rubélia', hematico: 'Hemático', vesper: 'Vesper', merchant: 'Mercador' };

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
  if (r.minMorale) parts.push(`moral ≥ ${r.minMorale}`);
  return parts.length ? parts.join(' · ') : 'qualquer humano';
}

export class Contracts {
  private ring?: Phaser.GameObjects.Graphics;
  private selected?: Human;

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
    // Delivery happens once every requested human is standing at the yard.
    const c = this.active;
    if (!c) return;
    const a = this.assigned();
    if (a.length >= c.count && a.every(h => h.state === 'boarding')) this.deliver(c, a.slice(0, c.count));
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
    if (h.contract) action = `<button class="go" data-a="unassign">Retirar do contrato</button>`;
    else if (h.name) action = `<p class="muted">${h.name.split(' ')[0]} não está à venda: personagens da história ficam na fazenda.</p>`;
    else if (!c) action = `<p class="muted">Nenhum contrato ativo. Veja as ofertas no pergaminho do HUD.</p>`;
    else if (!meets(h, c.req)) action = `<p class="muted">Não atende ao contrato atual (${describe(c.req)}).</p>`;
    else if (!this.buildings.level('boarding')) action = `<p class="muted">Atende ao contrato, mas falta construir o Pátio de Embarque.</p>`;
    else action = `<button class="go" data-a="assign">Enviar ao Pátio · ${c.title}</button>`;
    this.panel.open({
      title: h.name ?? `Unidade ${t.code}`,
      subtitle: `${QUALITY[t.quality].name} · valor estimado ${value} Ouro`,
      desc: '',
      stats: [],
      html: `<div class="tags">${tag(`blood_${t.blood}`, BLOOD[t.blood].name)}${tag(`quality_${t.quality}`, QUALITY[t.quality].name)}` +
        `${tag(`temper_${t.temper}`, TEMPER[t.temper].name)}${t.trait ? tag(`trait_${t.trait}`, TRAIT[t.trait].name) : ''}</div>` +
        meter('Vitalidade', h.vitality, '#d8122a') + meter('Moral', h.morale, '#6fbf73') + meter('Fome', h.hunger, '#e8b54a') +
        `<p class="muted" style="margin:8px 0">${TEMPER[t.temper].desc}${t.trait ? ` ${TRAIT[t.trait].desc}` : ''}</p>${action}`,
      bind: root => {
        root.querySelector<HTMLButtonElement>('[data-a="assign"]')?.addEventListener('click', () => this.assign(h));
        root.querySelector<HTMLButtonElement>('[data-a="unassign"]')?.addEventListener('click', () => { this.humans.unassign(h); this.openHuman(h); });
      },
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
    if (this.assigned().length >= c.count) { this.hud.toast('Bóris: O contrato já tem gente suficiente no pátio.'); return; }
    this.humans.assign(h, c.id);
    const n = this.assigned().length;
    this.hud.toast(`${n}/${c.count} a caminho do Pátio de Embarque.`);
    this.panel.close();
  }

  // ---------- contracts ----------
  openBoard() {
    const c = this.active;
    const offers = state.contracts.offers.map(def);
    const card = (d: ContractDef, active: boolean) => {
      const eligible = this.humans.all.filter(h => !h.taken && meets(h, d.req)).length;
      const left = active ? state.contracts.active!.night + d.nights - state.night.night : d.nights;
      return `<div class="card"><h4>${d.title}</h4><div class="muted">${BUYER_NAMES[d.buyer]} · prazo ${left} noite${left === 1 ? '' : 's'}</div>` +
        `<div style="margin:5px 0">${d.count}× ${describe(d.req)}</div>` +
        `<div class="muted">Recompensa: ${d.reward.gold} Ouro · ${d.reward.prestige} Prestígio · você tem ${eligible} elegíve${eligible === 1 ? 'l' : 'is'}</div>` +
        (active ? `<div style="margin-top:5px">No pátio: ${this.assigned().length}/${d.count}</div><button class="go" data-cancel>Desistir</button>`
          : c ? '' : `<button class="go" data-accept="${d.id}">Aceitar</button>`) + '</div>';
    };
    this.panel.open({
      title: 'Contratos',
      subtitle: c ? 'Um contrato ativo por vez' : 'Escolha um comprador',
      desc: '',
      stats: [],
      html: (c ? card(c, true) : '') + (offers.length ? offers.map(d => card(d, false)).join('')
        : '<p class="muted">Sem ofertas agora. Novos compradores chegam a cada noite.</p>') +
        `<p class="muted">Toque num humano para ver a ficha e enviá-lo ao Pátio de Embarque. Humanos vendidos deixam a fazenda.</p>`,
      bind: root => {
        root.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach(b => b.addEventListener('click', () => this.accept(b.dataset.accept!)));
        root.querySelector('[data-cancel]')?.addEventListener('click', () => { if (confirm('Desistir do contrato? O comprador não vai gostar.')) this.fail(true); });
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
    state.resources.gold += d.reward.gold;
    state.resources.prestige += d.reward.prestige;
    state.contracts.active = undefined;
    if (!state.contracts.done.includes(d.id)) state.contracts.done.push(d.id);
    bus.emit('CONTRACT_COMPLETED', { contractId: d.id, delivered: who.length, gold: d.reward.gold });
    this.hud.toast(`${SHORT[d.buyer] ?? BUYER_NAMES[d.buyer]}: ${d.done}`, 'good', 7000);
    this.hud.toast(`Contrato entregue: +${d.reward.gold} Ouro · +${d.reward.prestige} Prestígio`, 'good');
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
    this.hud.toast(gaveUp ? 'Contrato cancelado. −5 Prestígio.' : `${SHORT[d.buyer] ?? BUYER_NAMES[d.buyer]}: O prazo acabou. Vou lembrar disso. (−5 Prestígio)`, 'bad', 6000);
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
    state.contracts.offers = [...keep, ...pool].slice(0, MAX_OFFERS);
  }
}
