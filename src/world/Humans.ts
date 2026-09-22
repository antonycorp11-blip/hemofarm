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
import { state } from '../core/state';
import { FOOD_PER_MEAL } from '../data/crops';

type P = [number, number];
type State = 'idle' | 'walking' | 'eating' | 'socializing' | 'queued' | 'collecting' | 'inside' | 'resting' | 'farming';

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

class Human implements Speaker {
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

  constructor(private scene: Phaser.Scene, private map: FarmMap, private bubbles: Bubbles, private buildings: Buildings, private farms: Farms) {
    this.makeAnims();
    this.queue = this.makeStation('collect');
  }

  spawn(n: number, saved: HumanSave[] = []) {
    const cells = [...this.map.walkable].map(k => k.split(',').map(Number) as P);
    for (let k = 0; k < Math.max(n, saved.length); k++) {
      const sv = saved[k];
      const tile = sv && this.map.walkable.has(sv.tile.join(',')) ? sv.tile : Phaser.Utils.Array.GetRandom(cells);
      const named = !saved.length ? NAMED[k] : undefined;
      const look = sv?.look ?? named?.look ?? Phaser.Utils.Array.GetRandom(ANONYMOUS_LOOKS);
      const sprite = this.scene.add.sprite(0, 0, look === 'base' ? 'human_actions' : look, 0).setOrigin(0.5, 1).setScale(S);
      if (look === 'base') sprite.setTint(Phaser.Utils.Array.GetRandom(TINTS));
      const h = new Human(k, sprite, tile, '');
      h.look = look;
      h.name = sv?.name ?? named?.name;
      h.home = sv && this.buildings.level(sv.home) > 0 && this.residents(sv.home) < this.buildings.capacity(sv.home) ? sv.home : this.findHome();
      if (sv) Object.assign(h, { hunger: sv.hunger, energy: sv.energy, morale: sv.morale, vitality: sv.vitality });
      this.place(h, tile);
      this.list.push(h);
      bus.emit('HUMAN_CREATED', { humanId: h.id, source: sv ? 'save' : 'initial' });
      this.scene.time.delayedCall(Phaser.Math.Between(0, 2500), () => this.decide(h));
    }
  }

  export(): HumanSave[] {
    const r = (v: number) => Math.round(v);
    return this.list.map(h => ({ hunger: r(h.hunger), energy: r(h.energy), morale: r(h.morale), vitality: r(h.vitality), home: h.home, tile: h.tile, look: h.look, name: h.name }));
  }

  get population() { return this.list.length; }
  get avgMorale() { return this.list.reduce((a, h) => a + h.morale, 0) / Math.max(1, this.list.length); }
  get collectSpot(): P { return this.queue.entry; }

  update(dt: number) {
    const s = dt / 1000, now = this.scene.time.now;
    for (const h of this.list) {
      if (h.state !== 'eating') h.hunger = Math.min(100, h.hunger + HUNGER_RATE * s);
      if (h.state !== 'inside') h.energy = Math.max(0, h.energy - ENERGY_RATE * s);
      if (h.state !== 'collecting') h.vitality = Math.min(100, h.vitality + (h.hunger < 50 ? 0.6 : 0.25) * s);
      if (h.hunger > 85) h.morale = Math.max(0, h.morale - 0.2 * s);
      h.sprite.setDepth(h.sprite.y);
      this.updateMarker(h, now);
    }
    if (now > this.nextAmbient) {
      this.nextAmbient = now + Phaser.Math.Between(6000, 12000);
      this.ambientLine();
    }
  }

  // ---------- decisions ----------
  private decide(h: Human) {
    if (h.taken) return;
    h.state = 'idle';
    const now = this.scene.time.now;
    if (h.energy < 25) return this.goSleep(h);
    if (h.hunger > 65) return this.goEat(h);
    const canCollect = this.buildings.level('collect') > 0 && h.vitality > 70 && now > h.recoveringUntil
      && this.queue.members.length < this.queue.spots.length;
    if (Math.random() < 0.4) {
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
      this.enter(h, Phaser.Math.Between(9000, 14000), () => { h.energy = 100; this.decide(h); });
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
    const spot = this.near(Phaser.Utils.Array.GetRandom(this.map.social));
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
    const amount = def?.blood ?? 10;
    this.enter(h, def?.collectMs ?? 4000, () => {
      h.vitality = Math.max(0, h.vitality - 30);
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
    const pool = this.list.filter(h => h.state !== 'collecting' && !h.taken && !h.name);
    const chosen = Phaser.Utils.Array.Shuffle(pool).slice(0, count);
    for (const h of chosen) {
      h.taken = true;
      this.leaveQueue(h);
      h.sprite.setVisible(true).setAlpha(1);
      this.bubbles.say(h, 'taken', true);
      this.walkTo(h, gate, () => {
        this.anim(h, 'front').setFlipX(true);
        this.scene.tweens.add({
          targets: h.sprite, x: carriage.x, y: carriage.y, alpha: 0, duration: 1600,
          onComplete: () => {
            h.sprite.destroy();
            h.marker?.destroy();
            this.list = this.list.filter(x => x !== h);
            bus.emit('HUMAN_TAKEN', { humanId: h.id, by: 'tithe' });
            onBoarded();
          },
        });
      }, true);
    }
    return chosen.length;
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
    this.scene.tweens.killTweensOf(h.sprite);
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
    this.scene.tweens.add({
      targets: h.sprite, x: c.x + h.offset.x, y: c.y + h.offset.y,
      duration: STEP_MS * slow, onComplete: () => this.step(h),
    });
  }

  private enter(h: Human, ms: number, done: () => void, state: State = 'inside') {
    h.state = state;
    h.sprite.stop();
    this.scene.tweens.add({ targets: h.sprite, alpha: 0, duration: 400, onComplete: () => h.sprite.setVisible(false) });
    this.scene.time.delayedCall(ms, () => {
      h.sprite.setVisible(true);
      this.scene.tweens.add({ targets: h.sprite, alpha: 1, duration: 400 });
      done();
    });
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
    if (h.taken) return 'mk_contract';
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
