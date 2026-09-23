// Human routine (GDD §6.2): leave home → eat → socialize → queue for collection → recover → sleep.
// Needs drive a small utility choice; every step is visible on the map.
import Phaser from 'phaser';
import type { FarmMap } from '../map/bosque';
import { tileCenter } from '../map/iso';
import { findPath } from '../sim/pathfind';
import { bus } from '../core/events';
import { Bubbles, Speaker } from './Bubbles';
import type { BubbleState } from '../data/lines';
import type { HumanSave } from '../core/state';
import type { Buildings } from './Buildings';
import type { Farms, FarmJob } from './Farms';
import { HumanTraits, NAMED_TRAITS, QUALITY, randomTraits } from '../data/humans';
import { state } from '../core/state';
import { heirOf } from '../sim/genetics';
import { has } from '../data/research';
import { FOOD_PER_MEAL } from '../data/crops';

type P = [number, number];
type State = 'idle' | 'walking' | 'eating' | 'socializing' | 'queued' | 'collecting' | 'inside' | 'resting' | 'farming' | 'boarding';

const S = 0.5;
const STEP_MS = 1700;          // one tile at normal pace
const HUNGER_RATE = 0.55;      // per second, 0..100
const ENERGY_RATE = 0.3;
const TINTS = [0xffffff, 0xf0e0d0, 0xdde4ff, 0xffe8e8, 0xe6ffe6, 0xf6f0c8];

// Appearances. 'base' uses the first three separate sheets; the others are 16-frame sheets
// (row 1 walk front, row 2 walk back, rows 3-4 actions — frame indices below).
type Action = 'front' | 'back' | 'idle' | 'talk' | 'eat' | 'work';
interface LookSpec { idle: number[]; talk: number[]; eat: number[]; work: number[]; sleep: number }
const SHEET_LOOKS: Record<string, LookSpec> = {
  human_b: { idle: [8, 9], talk: [10, 11], eat: [13, 14], work: [13, 14], sleep: 15 },
  human_c: { idle: [8, 9], talk: [10, 11], eat: [13, 14], work: [13, 14], sleep: 15 },
  davi: { idle: [8, 9], talk: [10, 11], eat: [8, 9], work: [14, 15], sleep: 8 },
  lia: { idle: [8, 9], talk: [10, 11], eat: [8, 9], work: [12, 13], sleep: 8 },
};
const ANONYMOUS_LOOKS = ['base', 'base', 'human_b', 'human_c'];
// Recurring humans from the GDD (§7) join every new farm; the tithe never picks them.
const NAMED = [{ name: 'Davi 17-B', look: 'davi' }, { name: 'Lia 04-A', look: 'lia' }];

export class Human implements Speaker {
  state: State = 'idle';
  tile: P;
  lastSpoke = -1e9;
  hunger = Phaser.Math.Between(10, 60);
  energy = Phaser.Math.Between(50, 100);
  morale = Phaser.Math.Between(35, 80);
  vitality = Phaser.Math.Between(70, 100);
  recoveringUntil = 0;
  ateAt = -1e9;
  taken = false;
  look = 'base';
  marker?: Phaser.GameObjects.Image;
  name?: string;
  traits!: HumanTraits;
  contract?: string;   // assigned to this contract: waits at the Boarding Yard
  partner?: number;    // uid of the bonded partner
  kin = 0;             // 0..100 progress towards sending for a relative (kept on the couple's lower uid)
  lovedUntil = 0;
  move?: Phaser.Tweens.Tween;   // walking step (kept apart from fades so one never cancels the other)
  fade?: Phaser.Tweens.Tween;   // entering/leaving buildings
  offset = { x: Phaser.Math.Between(-12, 12), y: Phaser.Math.Between(-5, 5) };
  path: P[] = [];
  onArrive?: () => void;

  constructor(public id: number, public sprite: Phaser.GameObjects.Sprite, tile: P, public home: string) {
    this.tile = tile;
  }
}

interface Station { entry: P; spots: P[]; members: Human[]; busy: boolean }

export class Humans {
  private list: Human[] = [];
  private queue!: Station;
  private nextAmbient = 4000;
  private downAt?: { x: number; y: number };
  onSelect?: (h: Human) => void;
  private affinity = new Map<string, number>();
  private bondTick = 0;
  private noRoomWarned = false;

  constructor(private scene: Phaser.Scene, private map: FarmMap, private bubbles: Bubbles, private buildings: Buildings, private farms: Farms) {
    this.makeAnims();
    this.queue = this.makeStation('collect');
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.downAt = { x: p.x, y: p.y }; });
  }

  spawn(n: number, saved: HumanSave[] = []) {
    const cells = [...this.map.walkable].map(k => k.split(',').map(Number) as P);
    for (let k = 0; k < Math.max(n, saved.length); k++) {
      const sv = saved[k];
      const named = !saved.length ? NAMED[k] : undefined;
      const name = sv?.name ?? named?.name;
      this.create({
        tile: sv && this.map.walkable.has(sv.tile.join(',')) ? sv.tile : Phaser.Utils.Array.GetRandom(cells),
        look: sv?.look ?? named?.look,
        name,
        // New farms always get two sellable Rubra, so Lady Rubélia's first order is doable (named humans aren't for sale).
        traits: sv?.traits ?? randomTraits(name ? NAMED_TRAITS[name] : !saved.length && (k === 2 || k === 3) ? { blood: 'rubra' } : {}),
        save: sv,
      });
    }
  }

  private create(o: { tile: P; look?: string; name?: string; traits: HumanTraits; save?: HumanSave; source?: string }) {
    const sv = o.save;
    const look = o.look ?? Phaser.Utils.Array.GetRandom(ANONYMOUS_LOOKS);
    const sprite = this.scene.add.sprite(0, 0, look === 'base' ? 'human_actions' : look, 0).setOrigin(0.5, 1).setScale(S);
    if (look === 'base') sprite.setTint(Phaser.Utils.Array.GetRandom(TINTS));
    const h = new Human(sv?.uid ?? state.nextUid++, sprite, o.tile, '');
    h.look = look;
    h.name = o.name;
    h.traits = o.traits;
    h.contract = sv?.contract;
    h.partner = sv?.partner;
    h.kin = sv?.kin ?? 0;
    this.makeTappable(h);
    h.home = sv && this.buildings.level(sv.home) > 0 && this.residents(sv.home) < this.buildings.capacity(sv.home) ? sv.home : this.findHome();
    if (sv) Object.assign(h, { hunger: sv.hunger, energy: sv.energy, morale: sv.morale, vitality: sv.vitality });
    this.place(h, o.tile);
    this.list.push(h);
    bus.emit('HUMAN_CREATED', { humanId: h.id, source: o.source ?? (sv ? 'save' : 'initial') });
    this.scene.time.delayedCall(Phaser.Math.Between(0, 2500), () => this.decide(h));
    return h;
  }

  export(): HumanSave[] {
    const r = (v: number) => Math.round(v);
    return this.list.map(h => ({ uid: h.id, hunger: r(h.hunger), energy: r(h.energy), morale: r(h.morale), vitality: r(h.vitality), home: h.home,
      tile: h.tile, look: h.look, name: h.name, traits: h.traits, contract: h.contract, partner: h.partner, kin: Math.round(h.kin) }));
  }

  get population() { return this.list.length; }
  get avgMorale() { return this.list.reduce((a, h) => a + h.morale, 0) / Math.max(1, this.list.length); }
  get collectSpot(): P { return this.queue.entry; }

  update(dt: number) {
    const s = dt / 1000, now = this.scene.time.now;
    for (const h of this.list) {
      if (h.state !== 'eating') h.hunger = Math.min(100, h.hunger + HUNGER_RATE * s);
      if (h.state !== 'inside') h.energy = Math.max(0, h.energy - ENERGY_RATE * s);
      if (h.state !== 'collecting') h.vitality = Math.min(100, h.vitality + (h.hunger < 50 ? 0.6 : 0.25) * (has('w1') ? 1.5 : 1) * s);
      if (has('w3') && h.hunger < 70) h.morale = Math.min(100, h.morale + 0.04 * s);
      if (h.hunger > 85) h.morale = Math.max(0, h.morale - 0.2 * s);
      h.sprite.setDepth(h.sprite.y);
      // Safety net: anyone outside a building must be visible and tappable.
      if (!h.taken && h.state !== 'inside' && h.state !== 'collecting' && !h.fade?.isPlaying()) {
        if (!h.sprite.visible) h.sprite.setVisible(true);
        if (h.sprite.alpha < 1) h.sprite.setAlpha(Math.min(1, h.sprite.alpha + s * 3));
      }
      this.updateMarker(h, now);
    }
    this.updateBonds(dt);
    if (now > this.nextAmbient) {
      this.nextAmbient = now + Phaser.Math.Between(6000, 12000);
      this.ambientLine();
    }
  }

  // ---------- decisions ----------
  private decide(h: Human) {
    if (h.taken) return;
    if (h.contract) return this.goBoard(h);
    h.state = 'idle';
    const now = this.scene.time.now;
    if (h.energy < 25) return this.goSleep(h);
    if (h.hunger > 65) return this.goEat(h);
    const canCollect = this.buildings.level('collect') > 0 && h.vitality > 70 && now > h.recoveringUntil
      && this.queue.members.length < this.queue.spots.length;
    if (Math.random() < 0.7) {
      const job = this.farms.claimJob();
      if (job) return this.goFarm(h, job);
    }
    const r = Math.random();
    if (canCollect && r < 0.3) return this.joinQueue(h);
    if (r < 0.7) return this.goSocialize(h);
    this.goWander(h);
  }

  private residents(id: string) { return this.list.filter(h => h.home === id).length; }

  // First built house with a free bed, or '' (homeless).
  private findHome() {
    return this.buildings.built('housing').find(id => this.residents(id) < this.buildings.capacity(id)) ?? '';
  }

  private goSleep(h: Human) {
    if (Math.random() < 0.3) this.bubbles.say(h, 'sleepy');
    if (!h.home || this.buildings.level(h.home) === 0) h.home = this.findHome();
    if (!h.home) return this.sleepOutside(h);
    this.walkTo(h, this.map.entries[h.home], () => {
      this.enter(h, Phaser.Math.Between(9000, 14000) * (has('w2') ? 0.7 : 1), () => {
        h.energy = 100;
        if (has('w2')) h.morale = Math.min(100, h.morale + 2);
        this.decide(h);
      });
    });
  }

  // No free bed: sleep on the ground at a gathering spot. Works, but costs morale.
  private sleepOutside(h: Human) {
    this.walkTo(h, this.near(Phaser.Utils.Array.GetRandom(this.map.social)), () => {
      h.state = 'resting';
      this.still(h, 'sleep');
      this.scene.time.delayedCall(Phaser.Math.Between(9000, 13000), () => {
        h.energy = 70; h.morale = Math.max(0, h.morale - 4);
        this.decide(h);
      });
    });
  }

  private goEat(h: Human) {
    if (Math.random() < 0.4) this.bubbles.say(h, 'hungry');
    const foods = this.buildings.built('food');
    if (!foods.length || state.resources.food < FOOD_PER_MEAL) { h.morale = Math.max(0, h.morale - 2); return this.goWander(h); }
    const food = Phaser.Utils.Array.GetRandom(foods);
    const eatMs = this.buildings.levelDef(food)?.eatMs ?? 7000;
    this.walkTo(h, this.near(this.map.entries[food]), () => {
      h.state = 'eating';
      this.anim(h, 'eat');
      this.scene.time.delayedCall(eatMs * Phaser.Math.FloatBetween(0.85, 1.15), () => {
        if (state.resources.food < FOOD_PER_MEAL) { h.morale = Math.max(0, h.morale - 2); this.decide(h); return; } // ran out mid-meal
        state.resources.food -= FOOD_PER_MEAL;
        h.hunger = 0; h.ateAt = this.scene.time.now; h.morale = Math.min(100, h.morale + 3);
        bus.emit('HUMAN_ATE', { humanId: h.id });
        if (Math.random() < 0.35) this.bubbles.say(h, 'well_fed');
        this.decide(h);
      });
    });
  }

  private goFarm(h: Human, job: FarmJob) {
    this.walkTo(h, job.spot, () => {
      h.state = 'farming';
      this.anim(h, 'work').setFlipX(Math.random() < 0.5);
      this.scene.time.delayedCall(this.farms.workMs, () => {
        if (h.taken) return;
        this.farms.complete(job);
        this.decide(h);
      });
    });
  }

  private goSocialize(h: Human) {
    const p = this.partnerOf(h);
    // Couples look for each other at the gathering spots.
    const spot = p && p.state === 'socializing' && Math.random() < 0.7 ? this.near(p.tile) : this.near(Phaser.Utils.Array.GetRandom(this.map.social));
    this.walkTo(h, spot, () => {
      h.state = 'socializing';
      this.anim(h, Math.random() < 0.6 ? 'talk' : 'idle').setFlipX(Math.random() < 0.5);
      h.morale = Math.min(100, h.morale + 1);
      this.scene.time.delayedCall(Phaser.Math.Between(6000, 12000), () => this.decide(h));
    });
  }

  private goWander(h: Human) {
    const cells = [...this.map.paths];
    const t = Phaser.Utils.Array.GetRandom(cells).split(',').map(Number) as P;
    this.walkTo(h, t, () => {
      this.anim(h, 'idle');
      this.scene.time.delayedCall(Phaser.Math.Between(1500, 4000), () => this.decide(h));
    });
  }

  // ---------- collection queue: the line visibly moves forward ----------
  private makeStation(slotId: string): Station {
    const entry = this.map.entries[slotId];
    const path = findPath([21, 21], entry, this.map.walkable, this.map.paths) ?? [entry];
    return { entry, spots: path.reverse().slice(0, 7), members: [], busy: false };
  }

  private joinQueue(h: Human) {
    const q = this.queue;
    q.members.push(h);
    if (Math.random() < 0.3) this.bubbles.say(h, 'queued_collection');
    this.advanceQueue(h);
  }

  private advanceQueue(h: Human) {
    const q = this.queue, idx = q.members.indexOf(h);
    this.walkTo(h, q.spots[idx], () => {
      h.state = 'queued';
      this.anim(h, 'idle').setFlipX(false);
      this.tryCollect();
    }, true);
  }

  private tryCollect() {
    const q = this.queue, h = q.members[0];
    if (q.busy || !h || h.state !== 'queued') return;
    q.busy = true;
    const def = this.buildings.levelDef('collect');
    const amount = Math.round((def?.blood ?? 10) * QUALITY[h.traits.quality].mult * (has('c1') ? 1.2 : 1));
    this.enter(h, (def?.collectMs ?? 4000) * (has('c3') ? 0.7 : 1), () => {
      h.vitality = Math.max(0, h.vitality - (has('c2') ? 20 : 30));
      h.morale = Math.max(0, h.morale - 4);
      h.recoveringUntil = this.scene.time.now + 25000;
      bus.emit('BLOOD_COLLECTED', { humanId: h.id, amount, vitalityAfter: h.vitality });
      q.members.shift();
      q.busy = false;
      for (const m of q.members) this.advanceQueue(m);
      if (Math.random() < 0.5) this.bubbles.say(h, 'recovering');
      this.decide(h);
    }, 'collecting');
  }

  // ---------- tithe: random humans are pulled out of whatever they're doing ----------
  summon(count: number, gate: P, carriage: { x: number; y: number }, onBoarded: () => void) {
    const pool = this.list.filter(h => h.state !== 'collecting' && !h.taken && !h.name && !h.contract);
    const chosen = Phaser.Utils.Array.Shuffle(pool).slice(0, count);
    for (const h of chosen) {
      h.taken = true;
      this.leaveQueue(h);
      this.show(h, true);
      this.bubbles.say(h, 'taken', true);
      this.walkTo(h, gate, () => {
        this.anim(h, 'front').setFlipX(true);
        this.scene.tweens.add({
          targets: h.sprite, x: carriage.x, y: carriage.y, alpha: 0, duration: 1600,
          onComplete: () => {
            h.sprite.destroy();
            h.marker?.destroy();
            this.drop(h);
            bus.emit('HUMAN_TAKEN', { humanId: h.id, by: 'tithe' });
            onBoarded();
          },
        });
      }, true);
    }
    return chosen.length;
  }

  // ---------- selection & contracts ----------
  get all(): readonly Human[] { return this.list; }

  // Generous hit area: humans are tiny on a phone screen.
  private makeTappable(h: Human) {
    const f = h.sprite.frame, pad = 36;
    h.sprite.setInteractive(new Phaser.Geom.Rectangle(-pad, -pad, f.width + pad * 2, f.height + pad * 2), Phaser.Geom.Rectangle.Contains);
    h.sprite.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.downAt && Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y) > 8) return;
      this.onSelect?.(h);
    });
  }

  assign(h: Human, contractId: string) {
    h.contract = contractId;
    this.leaveQueue(h);
    this.show(h, true);
    this.bubbles.say(h, 'boarding', true);
    this.goBoard(h);
  }

  unassign(h: Human) {
    h.contract = undefined;
    this.decide(h);
  }

  // Walk to the Boarding Yard and wait there for the buyer.
  private goBoard(h: Human) {
    const yard = this.map.entries['boarding'];
    if (!yard) return;
    this.walkTo(h, this.near(yard), () => {
      h.state = 'boarding';
      this.anim(h, 'idle').setFlipX(Math.random() < 0.5);
    }, true);
  }

  // Delivered to a buyer: leaves the farm for good.
  sell(h: Human, to: { x: number; y: number }) {
    h.taken = true;
    this.scene.tweens.killTweensOf(h.sprite);
    this.anim(h, 'front').setFlipX(true);
    this.scene.tweens.add({
      targets: h.sprite, x: to.x, y: to.y, alpha: 0, duration: 1800,
      onComplete: () => {
        h.sprite.destroy(); h.marker?.destroy();
        this.drop(h);
      },
    });
  }

  // ---------- bonds & heirs (GDD_ADENDO A2) ----------
  partnerOf(h: Human) { return h.partner !== undefined ? this.list.find(x => x.id === h.partner && !x.taken) : undefined; }

  bond(a: Human, b: Human, arranged = false) {
    for (const x of [a, b]) { const old = this.partnerOf(x); if (old) old.partner = undefined; }
    a.partner = b.id; b.partner = a.id;
    a.kin = b.kin = 0;
    const now = this.scene.time.now;
    a.lovedUntil = b.lovedUntil = now + 10000;
    this.bubbles.say(Math.random() < 0.5 ? a : b, arranged ? 'arranged' : 'bond', true);
    bus.emit('BOND_FORMED', { a: a.id, b: b.id, arranged });
  }

  unbond(h: Human) {
    const p = this.partnerOf(h);
    if (p) p.partner = undefined;
    h.partner = undefined;
  }

  singles() { return this.list.filter(h => !h.taken && this.partnerOf(h) === undefined); }

  // Progress of the couple towards their next relative (0..100), stored on the lower uid.
  kinOf(h: Human) {
    const p = this.partnerOf(h);
    return p ? (h.id < p.id ? h : p).kin : 0;
  }

  private drop(h: Human) {
    this.list = this.list.filter(x => x !== h);
    const p = this.list.find(x => x.partner === h.id);
    if (p) p.partner = undefined;
  }

  private updateBonds(dt: number) {
    this.bondTick += dt;
    if (this.bondTick < 1000) return;
    const s = this.bondTick / 1000;
    this.bondTick = 0;
    // Spontaneous bonds: singles who keep socializing side by side.
    const social = this.list.filter(h => h.state === 'socializing' && !h.taken && !this.partnerOf(h));
    for (let i = 0; i < social.length; i++) for (let j = i + 1; j < social.length; j++) {
      const a = social[i], b = social[j];
      if (Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, b.sprite.x, b.sprite.y) > 80) continue;
      const k = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      const v = (this.affinity.get(k) ?? 0) + 6 * s * (a.morale + b.morale > 100 ? 1.3 : 0.8) * (has('g3') ? 2 : 1);
      this.affinity.set(k, v);
      if (v >= 100) { this.affinity.delete(k); this.bond(a, b); return; }
    }
    // Heirs: only with a Family House, and only if there's a free bed.
    const rate = Math.max(0, ...this.buildings.built('family').map(id => this.buildings.levelDef(id)?.kinRate ?? 0)) * (has('g1') ? 1.3 : 1);
    if (!rate) return;
    for (const h of this.list) {
      const p = this.partnerOf(h);
      if (!p || h.id > p.id || h.taken) continue;
      h.kin = Math.min(100, h.kin + rate * s * (h.morale + p.morale > 80 ? 1 : 0.4));
      if (h.kin < 100) continue;
      if (this.list.length >= this.buildings.totalCapacity) {
        if (!this.noRoomWarned) { this.noRoomWarned = true; bus.emit('HEIR_BLOCKED', { reason: 'capacity' }); }
        continue;
      }
      this.noRoomWarned = false;
      h.kin = 0;
      this.heir(h, p);
    }
  }

  private heir(a: Human, b: Human) {
    const gate: P = [21, 33];
    const c = this.create({ tile: gate, traits: heirOf(a.traits, b.traits, has('g2') ? 0.1 : 0), source: 'bond' });
    c.sprite.setAlpha(0);
    this.scene.tweens.add({ targets: c.sprite, alpha: 1, duration: 800 });
    this.scene.time.delayedCall(900, () => this.bubbles.say(c, 'heir', true));
    bus.emit('HEIR_ARRIVED', { humanId: c.id, parents: [a.id, b.id], quality: c.traits.quality, blood: c.traits.blood,
      code: c.traits.code, parentNames: [a.name ?? `Unidade ${a.traits.code}`, b.name ?? `Unidade ${b.traits.code}`] });
  }

  // A few visible humans comment on something that just happened.
  react(state: BubbleState, n = 2) {
    const view = this.scene.cameras.main.worldView;
    const pool = this.list.filter(h => !h.taken && h.sprite.visible && view.contains(h.sprite.x, h.sprite.y));
    for (const h of Phaser.Utils.Array.Shuffle(pool).slice(0, n)) this.bubbles.say(h, state);
  }

  private leaveQueue(h: Human) {
    const q = this.queue;
    if (!q.members.includes(h)) return;
    q.members = q.members.filter(m => m !== h);
    for (const m of q.members) this.advanceQueue(m);
  }

  // ---------- movement ----------
  private walkTo(h: Human, target: P, onArrive: () => void, keepQueue = false) {
    if (!keepQueue && this.queue.members.includes(h)) return; // queued humans only move via the queue
    h.move?.remove();
    const path = findPath(h.tile, target, this.map.walkable, this.map.paths);
    if (!path) { this.scene.time.delayedCall(1000, () => this.decide(h)); return; }
    h.state = 'walking';
    h.path = path.slice(1);
    h.onArrive = onArrive;
    this.step(h);
  }

  private step(h: Human) {
    const next = h.path.shift();
    if (!next) { h.onArrive?.(); return; }
    const di = next[0] - h.tile[0], dj = next[1] - h.tile[1];
    const front = di > 0 || dj > 0;
    this.anim(h, front ? 'front' : 'back').setFlipX(front ? dj > 0 : di < 0);
    h.tile = next;
    const c = tileCenter(next[0], next[1]);
    const slow = this.scene.time.now < h.recoveringUntil ? 1.5 : 1;
    h.move = this.scene.tweens.add({
      targets: h.sprite, x: c.x + h.offset.x, y: c.y + h.offset.y,
      duration: STEP_MS * slow, onComplete: () => this.step(h),
    });
  }

  private enter(h: Human, ms: number, done: () => void, state: State = 'inside') {
    h.state = state;
    h.sprite.stop();
    h.fade?.remove();
    h.fade = this.scene.tweens.add({ targets: h.sprite, alpha: 0, duration: 400, onComplete: () => h.sprite.setVisible(false) });
    this.scene.time.delayedCall(ms, () => {
      if (h.taken) return;
      this.show(h);
      done();
    });
  }

  // Bring a human back into view, cancelling any fade-out still running.
  private show(h: Human, instant = false) {
    h.fade?.remove();
    h.sprite.setVisible(true);
    if (instant) { h.sprite.setAlpha(1); h.fade = undefined; return; }
    h.fade = this.scene.tweens.add({ targets: h.sprite, alpha: 1, duration: 400 });
  }

  private place(h: Human, t: P) {
    const c = tileCenter(t[0], t[1]);
    h.sprite.setPosition(c.x + h.offset.x, c.y + h.offset.y);
  }

  // A random walkable tile around p, so groups spread instead of stacking.
  private near(p: P): P {
    const opts: P[] = [p];
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) {
      const t: P = [p[0] + di, p[1] + dj];
      if (this.map.walkable.has(`${t[0]},${t[1]}`)) opts.push(t);
    }
    return Phaser.Utils.Array.GetRandom(opts);
  }

  // ---------- ambient chatter ----------
  private bubbleState(h: Human): BubbleState {
    const now = this.scene.time.now;
    if (h.state === 'boarding') return 'boarding';
    if (h.state === 'queued') return 'queued_collection';
    if (now < h.recoveringUntil) return 'recovering';
    if (h.hunger > 65) return 'hungry';
    if (h.energy < 25) return 'sleepy';
    if (now - h.ateAt < 20000) return 'well_fed';
    if (h.morale > 75) return 'high_morale';
    if (h.morale < 35) return 'low_morale';
    return 'idle';
  }

  private ambientLine() {
    const view = this.scene.cameras.main.worldView;
    const visible = this.list.filter(h => h.sprite.visible && view.contains(h.sprite.x, h.sprite.y) && this.bubbles.canSpeak(h));
    const h = Phaser.Utils.Array.GetRandom(visible);
    if (h) this.bubbles.say(h, this.bubbleState(h));
  }

  // Overhead status icon (GDD Anexo B): the most urgent state wins.
  private markerFor(h: Human, now: number): string | null {
    if (h.taken || h.contract) return 'mk_contract';
    if (now < h.lovedUntil) return 'mk_happy';
    if (h.state === 'resting') return 'mk_sleep';
    if (h.hunger > 80) return 'mk_hungry';
    if (now < h.recoveringUntil) return 'mk_recover';
    if (h.morale < 30) return 'mk_angry';
    if (h.name) return 'mk_star';
    return null;
  }

  private updateMarker(h: Human, now: number) {
    const key = h.sprite.visible ? this.markerFor(h, now) : null;
    if (!key || !this.scene.textures.exists(key)) { h.marker?.setVisible(false); return; }
    if (!h.marker) h.marker = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    const z = this.scene.cameras.main.zoom;
    h.marker.setTexture(key).setVisible(true).setAlpha(h.sprite.alpha)
      .setScale(0.5 * Math.max(1, 0.8 / z))
      .setPosition(h.sprite.x, h.sprite.y - h.sprite.displayHeight - 4 + Math.sin(now / 300 + h.id) * 2)
      .setDepth(2.15e6);
  }

  private makeAnims() {
    const a = this.scene.anims;
    const def = (key: string, tex: string, frames: number[], frameRate: number) =>
      a.exists(key) || a.create({ key, frames: a.generateFrameNumbers(tex, { frames }), frameRate, repeat: -1 });
    def('h_walk_front', 'human_walk_front', [0, 1, 2, 3], 7);
    def('h_walk_back', 'human_walk_back', [0, 1, 2, 3], 7);
    def('h_idle', 'human_actions', [0, 1], 2);
    def('h_talk', 'human_actions', [2, 3], 3);
    def('h_eat', 'human_actions', [5, 6], 3);
    for (const [k, L] of Object.entries(SHEET_LOOKS)) {
      if (!this.scene.textures.exists(k)) continue;
      def(`${k}_front`, k, [0, 1, 2, 3], 7);
      def(`${k}_back`, k, [4, 5, 6, 7], 7);
      def(`${k}_idle`, k, L.idle, 2);
      def(`${k}_talk`, k, L.talk, 3);
      def(`${k}_eat`, k, L.eat, 3);
      def(`${k}_work`, k, L.work, 3);
    }
  }

  private anim(h: Human, a: Action) {
    const key = h.look === 'base'
      ? { front: 'h_walk_front', back: 'h_walk_back', idle: 'h_idle', talk: 'h_talk', eat: 'h_eat', work: 'h_eat' }[a]
      : `${h.look}_${a}`;
    return h.sprite.play(key, true);
  }

  private still(h: Human, pose: 'sleep') {
    h.sprite.stop();
    if (h.look === 'base') h.sprite.setTexture('human_actions', 7);
    else h.sprite.setTexture(h.look, SHEET_LOOKS[h.look][pose]);
  }
}
