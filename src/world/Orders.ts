// Castle orders: three short goals every night, each paying a chest (Gold + Essência); all three open a bonus chest.
// Always something to do in the next couple of minutes, pointing at systems the player might be ignoring.
import Phaser from 'phaser';
import { bus, GameEvents } from '../core/events';
import { state, quotaFor, Order } from '../core/state';
import { sfx } from '../core/sfx';
import type { Hud } from '../ui/Hud';
import { Modal, icon } from '../ui/Modal';

interface Kind { text: (t: number) => string; target: (n: number) => number; event: keyof GameEvents; count: (p: any) => number; ok?: (w: Orders) => boolean }

const KINDS: Record<string, Kind> = {
  blood: { text: t => `Colete ${t} de Sangue`, target: n => Math.round(quotaFor(n) * 1.3 / 10) * 10, event: 'BLOOD_COLLECTED', count: p => p.amount },
  harvest: { text: t => `Colha ${t} de Comida`, target: n => 20 + n * 6, event: 'CROP_HARVESTED', count: p => p.food, ok: () => Object.keys(state.plots).length > 0 },
  orbs: { text: t => `Estoure ${t} orbes de sangue`, target: n => 3 + Math.floor(n / 2), event: 'ORB_TAPPED', count: () => 1 },
  feed: { text: t => `Sirva ${t} refeições`, target: n => 6 + n, event: 'HUMAN_ATE', count: () => 1 },
  contract: { text: () => 'Entregue um contrato', target: () => 1, event: 'CONTRACT_COMPLETED', count: () => 1, ok: w => w.built('boarding') },
  research: { text: t => `Faça ${t} pesquisas`, target: () => 2, event: 'RESEARCH_DONE', count: () => 1, ok: w => w.built('lab') },
  upgrade: { text: t => `Compre ${t} aprimoramentos de construção`, target: n => 2 + Math.floor(n / 4), event: 'UPGRADE_BOUGHT', count: () => 1 },
  heir: { text: () => 'Receba um parente', target: () => 1, event: 'HEIR_ARRIVED', count: () => 1, ok: w => w.built('family') },
  defend: { text: () => 'Vença uma defesa sem perder ninguém', target: () => 1, event: 'RAID_ENDED', count: p => (p.result === 'won' && !p.losses ? 1 : 0),
    ok: () => !!state.world.raid && state.world.raid.kind !== 'none' && state.world.raid.status !== 'done' },
};

export const orderReward = (n: number) => ({ gold: 30 + n * 15, essence: 10 + n * 5 });
export const bonusReward = (n: number) => ({ prestige: 5 + n, essence: 20 + n * 8 });

export class Orders {
  constructor(private hud: Hud, private modal: Modal, readonly built: (kind: string) => boolean) {
    for (const [id, k] of Object.entries(KINDS)) bus.on(k.event, (p: unknown) => this.progress(id, k.count(p)));
    bus.on('NIGHT_STARTED', ({ night }) => this.roll(night));
    if (state.orders.night !== state.night.night) this.roll(state.night.night);
  }

  private roll(night: number) {
    const pool = Phaser.Utils.Array.Shuffle(Object.keys(KINDS).filter(id => KINDS[id].ok?.(this) ?? true));
    // Blood is almost always on the list: it's the heart of the farm.
    const pick = pool.includes('blood') && Math.random() < 0.7 ? ['blood', ...pool.filter(x => x !== 'blood')] : pool;
    state.orders = { night, bonus: false, list: pick.slice(0, 3).map(kind => ({ kind, target: KINDS[kind].target(night), progress: 0, claimed: false })) };
  }

  private progress(kind: string, n: number) {
    if (!n || !state.tutorial.done && state.tutorial.step < 6) return; // orders start after the first steps of the tutorial
    for (const o of state.orders.list) {
      if (o.kind !== kind || o.progress >= o.target) continue;
      o.progress = Math.min(o.target, o.progress + n);
      if (o.progress >= o.target) {
        sfx.chime();
        this.hud.toast(`Encomenda pronta: ${KINDS[o.kind].text(o.target)}. Abra o baú em Encomendas.`, 'good');
        bus.emit('ORDER_DONE', { kind });
      }
    }
    if (this.modal.open && this.modal === this.openModal) this.open();
  }

  private openModal?: Modal;

  get ready() {
    const l = state.orders.list;
    return l.filter(o => o.progress >= o.target && !o.claimed).length + (this.bonusReady ? 1 : 0);
  }
  private get bonusReady() { const l = state.orders.list; return !state.orders.bonus && l.length > 0 && l.every(o => o.claimed); }

  private claim(o?: Order) {
    const n = state.night.night, r = state.resources;
    let gains: Record<string, number>;
    if (o) { o.claimed = true; gains = orderReward(n); }
    else { state.orders.bonus = true; gains = bonusReward(n); }
    for (const [k, v] of Object.entries(gains)) r[k as keyof typeof r] += v;
    sfx.coin();
    this.open(gains);
  }

  open(gains?: Record<string, number>) {
    this.openModal = this.modal;
    const n = state.night.night;
    const rw = orderReward(n), bw = bonusReward(n);
    const row = (o: Order, i: number) => {
      const done = o.progress >= o.target;
      return `<div class="row"><div class="t"><b>${KINDS[o.kind].text(o.target)}</b><br><small>${Math.floor(o.progress)}/${o.target} · baú: ${rw.gold} Ouro + ${rw.essence} Essência</small>` +
        `<div class="meter"><i style="width:${(o.progress / o.target) * 100}%"></i></div></div>` +
        `<button data-o="${i}"${done && !o.claimed ? '' : ' disabled'}>${o.claimed ? 'Aberto ✓' : done ? 'Abrir baú' : 'Em andamento'}</button></div>`;
    };
    const names: Record<string, [string, string]> = { gold: ['Ouro', 'icon_gold'], essence: ['Essência', 'icon_research'], prestige: ['Prestígio', 'icon_prestige'] };
    const box = this.modal.show(`<h2>Encomendas do Castelo</h2><div class="sub">Noite ${n} · novas encomendas a cada noite</div>
      ${gains ? `<div class="gains">${Object.entries(gains).map(([k, v]) => `<span>${icon(names[k][1])} +${v} ${names[k][0]}</span>`).join('')}</div>` : ''}
      ${state.orders.list.map(row).join('')}
      <div class="row" style="border:1px solid #a07818"><div class="t"><b>Baú do Castelo</b><br><small>Abra os três baús da noite: +${bw.prestige} Prestígio + ${bw.essence} Essência</small></div>
      <button data-b${this.bonusReady ? '' : ' disabled'}>${state.orders.bonus ? 'Aberto ✓' : 'Abrir'}</button></div>`, { onClose: () => { this.openModal = undefined; } });
    box.querySelectorAll<HTMLButtonElement>('[data-o]').forEach(b => b.onclick = () => this.claim(state.orders.list[Number(b.dataset.o)]));
    box.querySelector<HTMLButtonElement>('[data-b]')!.onclick = () => this.claim();
  }
}
