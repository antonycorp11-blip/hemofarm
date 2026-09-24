// Battle: "Vampiros vs. Lobisomens" (GDD_ADENDO A6/A7). Separate scene, PvZ-like horizontal lanes: the fence is on the left,
// wolves come out of the forest on the right. Three modes: a farm raid (real humans, farm Blood), the Blood Moon (endless)
// and a Caçada battle (run deck, own Blood, volunteers as lives). Arenas and weather change the rules of each fight.
import Phaser from 'phaser';
import { state } from '../core/state';
import { ARENAS, ArenaId, Arena, BATTLE_LINES, BYPASS, COLS, Raid, UNITS, UnitDef, UnitId, WEATHER, WeatherId, WOLVES, WolfDef, WolfId, endlessWave } from '../data/battle';
import { has } from '../data/research';
import { fx, less } from '../core/bonus';
import { meta, saveMeta } from '../core/meta';
import { sfx, voice } from '../core/sfx';
import { L } from '../core/i18n';

const S = 0.5;
const US = S * 1.35; // units and wolves read bigger than farm props: they're the focus here
export type BattleMode = 'raid' | 'endless' | 'hunt';
export interface BattleResult { bossKilled?: boolean; won: boolean; grabbed: number; bloodSpent: number; kills: number; retreated: boolean; stars: number; waves: number; livesLeft: number; weather: WeatherId }
export interface BattleData {
  raid: Raid; collectLevel: number; looks: string[]; onEnd: (r: BattleResult) => void;
  mode?: BattleMode; arena?: ArenaId; weather?: WeatherId;
  deck?: UnitId[]; cardLv?: Record<string, number>;   // Caçada: the run's deck and card levels
  lives?: number; bank?: number;                         // own Blood pool and lives (endless / hunt)
  boost?: { dmg?: number; hp?: number; gen?: number; cost?: number }; // Caçada relics
  title?: string;
  bossHp?: number;                                       // story consequences: region boss health multiplier
  notes?: string[];                                      // lines shown in the battle after the intro (boss taunt, consequences)
  alphaName?: string;                                    // region boss fight: the alpha is that chapter's named boss
}

interface Unit { def: UnitDef; id: UnitId; tex: string; lane: number; col: number; spr: Phaser.GameObjects.Sprite; hp: number; cd: number; stunUntil: number; stoneUntil: number;
  extra?: Phaser.GameObjects.GameObject }
interface Wolf { def: WolfDef; id: WolfId; tex: string; lane: number; j: number; spr: Phaser.GameObjects.Sprite; hp: number; bite: number; slowUntil: number;
  buffUntil: number; jumped: boolean; skill: number; busy: boolean; dead: boolean; hidden: boolean; phase: number; bob: number }

const CW = 96, CH = 72;                       // cell size in world units
const cellPos = (lane: number, j: number) => ({ x: (j + 0.5) * CW, y: (lane + 0.72) * CH });
const PREP_MS = 20000;                        // preparation time before the first wolf
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// Vampire spells: always available, paid in Blood, long cooldowns. Tap the spell, then the field.
type SpellId = 'rain' | 'mist' | 'drain';
const SPELLS: Record<SpellId, { name: string; cost: number; cd: number; desc: string; icon: string; color: number; css: string }> = {
  rain: { name: L('Chuva Rubra', 'Crimson Rain'), cost: 60, cd: 25000, icon: 'icon_blood', color: 0xd8122a, css: '#e0283c', desc: L('toque numa raia: 120 de dano em todos os lobos dela', 'tap a lane: 120 damage to every wolf in it') },
  mist: { name: L('Névoa Hipnótica', 'Hypnotic Mist'), cost: 40, cd: 30000, icon: 'mk_sleep', color: 0x9a6aff, css: '#9a6aff', desc: L('toque no campo: todos os lobos ficam lentos por 6 s', 'tap the field: every wolf slows down for 6 s') },
  drain: { name: L('Beijo Sombrio', 'Dark Kiss'), cost: 30, cd: 18000, icon: 'icon_vitality', color: 0xff3a7a, css: '#ff4a8a', desc: L('toque numa área 3×3: 80 de dano e +10 Sangue por lobo atingido', 'tap a 3×3 area: 80 damage and +10 Blood per wolf hit') },
};

export class BattleScene extends Phaser.Scene {
  private cfg!: BattleData;
  private L = 5;                                // lanes in this arena
  private arena!: Arena;
  private weather: WeatherId = 'clear';
  private blocked = new Set<string>();
  private torches: boolean[] = [];               // PvZ lawnmower: one emergency fire per lane
  private torchImgs: Phaser.GameObjects.Image[] = [];          // "lane:col" cells where units can't stand
  private burning = new Map<string, number>();  // fire arena: cell → time it stops burning
  private nextFire = 8000;
  private nextBolt = 7000;
  private units: Unit[] = [];
  private wolves: Wolf[] = [];
  private t = 0;
  private spawnIdx = 0;
  private selected?: UnitId;
  private grabbed = 0;
  private bossKilled = false;
  private spell?: SpellId;
  private spellReady: Partial<Record<SpellId, number>> = {};
  private bank = 0;
  private wave = 0;
  private lives = 3;
  private maxLives = 3;
  private spent = 0;
  private kills = 0;
  private trickle = 0;
  private ended = false;
  private folk: Phaser.GameObjects.Sprite[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ui!: HTMLDivElement;
  private ready: Partial<Record<UnitId, number>> = {};
  private uiTick = 0;
  private ring!: Phaser.GameObjects.Graphics;
  private down?: { x: number; y: number; moved: boolean };
  private pinch = 0;
  private touches = new Map<number, { x: number; y: number }>();
  private fitZoom = 1;

  constructor() { super('Battle'); }

  private get mode(): BattleMode { return this.cfg.mode ?? (this.cfg.raid.endless ? 'endless' : 'raid'); }
  private get endless() { return this.mode === 'endless'; }
  private get ownBank() { return true; } // battles have their own Blood: defending never competes with the farm's Sangria

  init(data: BattleData) {
    this.cfg = data;
    this.arena = ARENAS[data.arena ?? 'farm'];
    this.L = data.raid.lanes ?? this.arena.lanes;
    this.weather = data.weather ?? 'clear';
    const lives = data.lives ?? 3;
    Object.assign(this, { bossKilled: false, aim: undefined, ghost: undefined, cardDrag: undefined, spell: undefined, spellReady: {}, bank: data.bank ?? 150, wave: 1, lives, maxLives: Math.max(3, lives),
      units: [], wolves: [], t: 0, spawnIdx: 0, selected: undefined, grabbed: 0, spent: 0, kills: 0, trickle: 0, ended: false, folk: [], ready: {}, uiTick: 0,
      touches: new Map(), pinch: 0, blocked: new Set(), torches: [], torchImgs: [], burning: new Map(), nextFire: 8000, nextBolt: 7000, mistUntil: 0 });
    this.t = -(this.endless ? 12000 : data.raid.spawns.length <= 5 ? PREP_MS + 5000 : PREP_MS);
  }

  preload() {
    const m = this.cache.json.get('manifest');
    const a = this.arena.art ?? {};
    const keys = [...Object.values(UNITS).flatMap(u => [u.tex, u.art ?? '']), ...Object.values(WOLVES).flatMap(w => [w.tex, w.art ?? '']),
      'fx_bolt', 'fx_flask', 'fx_vampire_poof', 'fx_hit', 'fx_fear', 'fx_bomb', 'wave_flag', 'rock_a', 'rock_b', 'rock_c', 'tile_water', 'tile_soil', 'tile_dirt_road',
      'tile_cobble_b', a.ground ?? '', a.water ?? '', a.block ?? '', 'fx_spells', 'fx_weather'];
    for (const k of keys) {
      if (!k || this.textures.exists(k) || !m[k]) continue;
      if (m[k].frameW) this.load.spritesheet(k, `assets/${k}.webp`, { frameWidth: m[k].frameW, frameHeight: m[k].frameH });
      else this.load.image(k, `assets/${k}.webp`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a1410');
    if (!this.textures.exists('bt_dot')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      for (let r = 8; r > 0; r--) g.fillStyle(0xffffff, 0.14 + (8 - r) * 0.11).fillCircle(8, 8, r); // soft glow dot for particles
      g.generateTexture('bt_dot', 16, 16);
      g.destroy();
    }
    this.buildField();
    this.buildWeather();
    this.bars = this.add.graphics().setDepth(1e6);
    this.ring = this.add.graphics().setDepth(1e6);
    this.hover = this.add.graphics().setDepth(-1e5);
    this.drawGrid();
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.scale.on('resize', this.refitLater, this);
    this.setupGestures();
    this.buildUi();
    this.fitCamera();
    const w = WEATHER[this.weather];
    const intro = this.endless ? L('Lua de Sangue. Ondas sem fim, Sangue próprio. Ninguém da fazenda corre perigo, só o seu orgulho.', 'Blood Moon. Endless waves, its own Blood. Nobody from the farm is in danger, only your pride.')
      : this.mode === 'hunt' ? `${this.cfg.title ?? L('Caçada', 'The Hunt')} · ${this.arena.name}.` : `${BATTLE_LINES.start} ${L('Você tem alguns segundos para se preparar.', 'You have a few seconds to prepare.')}`;
    this.toast(`Aureliano: ${intro}${this.weather !== 'clear' ? ` ${L('Clima', 'Weather')}: ${w.name} (${w.desc})` : ''}${this.arena !== ARENAS.farm ? ` ${this.arena.desc}` : ''}`, 9000);
    (this.cfg.notes ?? []).forEach((n, i) => this.time.delayedCall(9500 * (i + 1), () => this.toast(n, 8000)));
  }

  // Art that doesn't exist yet falls back to an existing sheet with a tint (the art replaces it once it's in the folder).
  private texFor(d: { tex: string; art?: string }) { return d.art && this.textures.exists(d.art) ? d.art : d.tex; }
  private tintFor(d: { tex: string; art?: string; tint?: number }) { return d.art && this.textures.exists(d.art) ? undefined : d.tint; }
  // Dedicated sheets follow the block-20 layout (row 1 idle, row 3 action); fallbacks reuse the frames of the borrowed sheet.
  private framesFor(d: UnitDef) { return d.art && this.textures.exists(d.art) ? { idle: [0, 1, 2, 3], act: [8, 9, 10, 11] } : d.fr ?? { idle: [0], act: [0] }; }

  // ---------- field ----------
  private buildField() {
    const rnd = new Phaser.Math.RandomDataGenerator([`battle${this.arena.name}`]);
    const L = this.L, ar = this.arena;
    const x0 = -9 * CW, x1 = (COLS + 8) * CW, y0 = -7 * CH, y1 = (L + 7) * CH; // generous: panning never shows the edge
    const groundArt = ar.art?.ground && this.textures.exists(ar.art.ground) ? ar.art.ground : undefined;
    // Isometric ground tiles laid over the rectangle (same art as the farm).
    for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) {
      const x = (i - j) * 64, y = (i + j) * 32;
      if (x < x0 - 64 || x > x1 + 64 || y < y0 - 32 || y > y1 + 32) continue;
      const field = x >= -CW * 0.2 && x <= COLS * CW + 20;
      const bridgeSide = this.arena === ARENAS.bridge && field && (y < -CH * 0.3 || y > L * CH + CH * 0.3);
      const key = x < -CW * 0.2 ? ar.back : !field ? ar.forest : bridgeSide ? 'tile_water' : groundArt ?? rnd.pick(ar.ground);
      const img = this.add.image(x, y, key).setScale(S * 1.03).setDepth(-2e5 + y * 0.001).setFlipX(rnd.frac() < 0.5);
      if (field && !groundArt && !bridgeSide && ar.groundTint) img.setTint(ar.groundTint);
    }
    // Alternate lane shading so rows read at a glance.
    const bands = this.add.graphics().setDepth(-1.6e5);
    for (let l = 0; l < L; l++) bands.fillStyle(l % 2 ? 0x000000 : 0x1a2a10, l % 2 ? 0.14 : 0.1).fillRect(0, l * CH, COLS * CW, CH);
    // Water lanes (swamp): dark water with a moving sheen; wolves wade slowly.
    for (const l of ar.water ?? []) {
      if (l >= L) continue;
      bands.fillStyle(0x10283a, 0.62).fillRect(0, l * CH + 4, COLS * CW, CH - 8);
      const sheen = this.add.graphics().setDepth(-1.55e5);
      for (let k = 0; k < 6; k++) sheen.lineStyle(2, 0x6aa0c8, 0.25).lineBetween(k * 150 + 20, l * CH + 20 + (k % 2) * 24, k * 150 + 90, l * CH + 20 + (k % 2) * 24);
      this.tweens.add({ targets: sheen, x: 40, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Flooded cells and tombstones: cells where no unit can stand.
    const free = () => {
      for (let tries = 0; tries < 50; tries++) {
        const lane = rnd.between(0, L - 1), col = rnd.between(1, COLS - 2), k = `${lane}:${col}`;
        if (!this.blocked.has(k) && !(ar.water ?? []).includes(lane)) return { lane, col, k };
      }
      return undefined;
    };
    for (let n = 0; n < (ar.flooded ?? 0); n++) {
      const c = free(); if (!c) break;
      this.blocked.add(c.k);
      const p = cellPos(c.lane, c.col);
      this.add.ellipse(p.x, p.y - 22, CW * 0.8, CH * 0.6, 0x10283a, 0.75).setDepth(-1.5e5).setStrokeStyle(2, 0x3a6a8a, 0.6);
    }
    const tomb = ar.art?.block && this.textures.exists(ar.art.block) ? ar.art.block : undefined;
    for (let n = 0; n < (ar.blocked ?? 0); n++) {
      const c = free(); if (!c) break;
      this.blocked.add(c.k);
      const p = cellPos(c.lane, c.col);
      const img = tomb ? this.add.sprite(p.x, p.y - 4, tomb, rnd.between(0, 3)) : this.add.image(p.x, p.y - 4, rnd.pick(['rock_a', 'rock_b', 'rock_c']));
      img.setOrigin(0.5, 1).setScale(S * 1.1).setDepth(p.y - 5);
      if (!tomb) img.setTint(0xb0b0c8);
    }
    // Palisade: a column of logs between the field and the farm.
    for (let y = -CH * 0.4; y <= L * CH + 10; y += 22) this.add.image(-10, y, 'fence_palisade_post').setOrigin(0.5, 1).setScale(S * 0.9).setDepth(y);
    // Forest edge where the wolves come from.
    for (let k = 0; k < 4 + L * 2; k++) {
      const x = (COLS + 0.6 + rnd.frac() * 2.2) * CW, y = rnd.between(-CH, (L + 1) * CH);
      const tree = this.add.image(x, y, rnd.pick(['pine_a', 'pine_b', 'pine_c', 'dead_tree_b'])).setOrigin(0.5, 1).setScale(S * 0.85).setDepth(y);
      if (ar.fire) tree.setTint(0xff9a7a);
    }
    // The farm's own humans (or the volunteers of the hunt), anxiously watching from behind the fence.
    this.cfg.looks.slice(0, 8).forEach((look, k) => {
      const x = -60 - (k % 2) * 55 - rnd.between(0, 20), y = (k / 8) * L * CH + 30;
      const tex = look === 'base' ? 'human_walk_front' : look;
      if (!this.textures.exists(tex)) return;
      const spr = this.add.sprite(x, y, tex, look === 'base' ? 0 : 8).setOrigin(0.5, 1).setScale(S * 1.2).setDepth(y);
      this.tweens.add({ targets: spr, y: y - 2, duration: 300 + k * 40, yoyo: true, repeat: -1 });
      this.folk.push(spr);
    });
    for (const y of [-CH * 0.5, L * CH + 20]) this.add.image(-10, y, 'torch_stand').setOrigin(0.5, 1).setScale(S).setDepth(y + 1);
    // Emergency torches: one per lane, at the fence. The first wolf to reach it sets the whole lane on fire.
    for (let l = 0; l < L; l++) {
      this.torches[l] = true;
      const p = cellPos(l, -0.25);
      const t = this.add.image(p.x, p.y, 'torch_stand').setOrigin(0.5, 1).setScale(S * 0.8).setDepth(p.y + 1);
      this.tweens.add({ targets: t, scaleY: S * 0.84, duration: 400 + l * 60, yoyo: true, repeat: -1 });
      this.torchImgs[l] = t;
    }
  }

  // ---------- weather ----------
  private buildWeather() {
    const W = COLS * CW, H = this.L * CH;
    const wx = this.weather;
    if (wx === 'rain') {
      this.add.particles(0, 0, 'bt_dot', { x: { min: -200, max: W + 300 }, y: -260, speedY: { min: 650, max: 900 }, speedX: -80, scaleX: 0.18, scaleY: 1.4,
        lifespan: 900, tint: 0x8ab0d8, alpha: 0.45, quantity: 2, frequency: 25 }).setDepth(9.3e5);
      this.add.rectangle(W / 2, H / 2, W + 1200, H + 800, 0x0a1a2a, 0.18).setDepth(9.2e5);
    } else if (wx === 'snow') {
      this.add.particles(0, 0, 'bt_dot', { x: { min: -200, max: W + 300 }, y: -200, speedY: { min: 40, max: 90 }, speedX: { min: -30, max: 10 }, scale: { min: 0.2, max: 0.45 },
        lifespan: 9000, tint: 0xffffff, alpha: 0.8, quantity: 1, frequency: 70 }).setDepth(9.3e5);
      this.add.rectangle(W / 2, H / 2, W + 1200, H + 800, 0xc8d8ff, 0.08).setDepth(9.2e5);
    } else if (wx === 'fog') {
      // Thick fog over the far cells: wolves only show up close to the fence.
      const g = this.add.graphics().setDepth(9.25e5);
      for (let k = 0; k < 10; k++) g.fillStyle(0xb8b0c8, 0.05 + k * 0.05).fillRect((COLS - 4.6 + k * 0.5) * CW, -CH * 2, CW * 0.5 + 2, H + CH * 4);
      g.fillStyle(0xb8b0c8, 0.55).fillRect((COLS + 0.4) * CW, -CH * 2, CW * 6, H + CH * 4);
      this.tweens.add({ targets: g, alpha: 0.8, duration: 3000, yoyo: true, repeat: -1 });
    } else if (wx === 'fullmoon') {
      const moon = this.add.circle(W + 60, -CH * 1.6, 60, 0xf4f0d8, 1).setDepth(-1.9e5);
      this.add.circle(moon.x, moon.y, 110, 0xf4f0d8, 0.12).setDepth(-1.9e5);
      this.add.rectangle(W / 2, H / 2, W + 1200, H + 800, 0x4a6aa0, 0.1).setDepth(9.2e5);
    } else if (wx === 'eclipse') {
      this.add.circle(W + 60, -CH * 1.6, 60, 0x1a0508, 1).setDepth(-1.9e5).setStrokeStyle(6, 0xff3348, 0.8);
      this.add.rectangle(W / 2, H / 2, W + 1200, H + 800, 0x3a0010, 0.18).setDepth(9.2e5);
    } else if (wx === 'storm') {
      this.add.rectangle(W / 2, H / 2, W + 1200, H + 800, 0x10182a, 0.22).setDepth(9.2e5);
      this.add.particles(0, 0, 'bt_dot', { x: { min: -200, max: W + 300 }, y: -260, speedY: { min: 800, max: 1000 }, speedX: -160, scaleX: 0.15, scaleY: 1.6,
        lifespan: 800, tint: 0x90a8c8, alpha: 0.4, quantity: 2, frequency: 20 }).setDepth(9.3e5);
    }
  }

  // Storm: lightning on a random cell (wolves and vampires alike); fire arena: cells ignite.
  private updateHazards(dt: number) {
    if (this.t < 0) return;
    if (this.weather === 'storm') {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = Phaser.Math.Between(6000, 9000);
        const lane = Phaser.Math.Between(0, this.L - 1), col = Phaser.Math.Between(1, COLS - 1);
        this.lightning(lane, col, 80, 40);
      }
    }
    if (this.arena.fire) {
      this.nextFire -= dt;
      if (this.nextFire <= 0) {
        this.nextFire = Phaser.Math.Between(6000, 10000);
        const lane = Phaser.Math.Between(0, this.L - 1), col = Phaser.Math.Between(1, COLS - 1), k = `${lane}:${col}`;
        this.burning.set(k, this.t + 5000);
        const p = cellPos(lane, col);
        const fire = this.add.particles(p.x, p.y - 10, 'bt_dot', { x: { min: -CW * 0.4, max: CW * 0.4 }, speedY: { min: -120, max: -60 }, scale: { start: 0.9, end: 0 },
          lifespan: 700, tint: [0xff7a1a, 0xffc040, 0xd8122a], quantity: 2, frequency: 40, blendMode: 'ADD' }).setDepth(p.y + 2);
        this.time.delayedCall(5000, () => { fire.stop(); this.time.delayedCall(800, () => fire.destroy()); });
      }
      const s = dt / 1000;
      for (const [k, until] of this.burning) {
        if (this.t > until) { this.burning.delete(k); continue; }
        const [lane, col] = k.split(':').map(Number);
        for (const u of this.units) if (u.lane === lane && u.col === col && u.def.kind !== 'mine') { u.hp -= 15 * s; if (u.hp <= 0) this.killUnit(u); }
        for (const w of this.wolves) if (!w.dead && w.lane === lane && Math.abs(w.j - (col + 0.5)) < 0.6) this.hurt(w, 25 * s, true);
      }
    }
  }

  private lightning(lane: number, col: number, wolfDmg: number, unitDmg: number) {
    const p = cellPos(lane, col);
    const g = this.add.graphics().setDepth(9.7e5);
    let x = p.x, y = p.y - 420;
    g.lineStyle(5, 0xd8e8ff, 1).beginPath().moveTo(x, y);
    while (y < p.y - 20) { x += Phaser.Math.Between(-22, 22); y += Phaser.Math.Between(30, 60); g.lineTo(x, Math.min(y, p.y - 20)); }
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
    this.cameras.main.flash(120, 200, 210, 255);
    sfx.hitHeavy();
    this.burst(p.x, p.y - 20, 0xb0d0ff, 16, 200);
    for (const w of this.wolves) if (!w.dead && w.lane === lane && Math.abs(w.j - (col + 0.5)) < 0.8) this.hurt(w, wolfDmg, true);
    for (const u of [...this.units]) if (u.lane === lane && u.col === col) this.hitUnit(u, unitDmg);
  }

  // Frame the lanes (plus the fence and the forest edge) between the horde bar and the cards.
  private fitCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width, H = this.scale.height;
    const land = W > H;
    const left = land ? -190 : -24, right = COLS * CW + (land ? 70 : 12), topY = -CH * 0.9, bottomY = this.L * CH + 30;
    this.ui?.classList.toggle('portrait', !land);
    this.ui?.classList.toggle('land', land);
    // Measure what the HTML UI actually covers and fit the field into the rest of the screen.
    const horde = this.ui?.querySelector('.horde')?.getBoundingClientRect();
    const panel = this.ui?.querySelector('.bottom')?.getBoundingClientRect();
    const top = (horde?.bottom ?? 60) + 4;
    const spells = this.ui?.querySelector('.spells')?.getBoundingClientRect();
    const bottom = land ? (spells ? H - spells.top + 2 : 6) : H - Math.min(panel?.top ?? H - 190, spells?.top ?? H) + 4;
    const leftPad = land ? (panel?.right ?? 90) + 4 : 0;
    const w = right - left, h = bottomY - topY;
    this.fitZoom = Math.max(0.1, Math.min((W - leftPad) / w, (H - top - bottom) / h));
    cam.setZoom(this.fitZoom);
    // Bounds larger than any zoomed-out view, otherwise the camera gets pushed off-centre.
    cam.setBounds(left - 2500, topY - 2500, w + 5000, h + 5000);
    // Put the field's centre at the centre of the free rectangle, not of the whole screen.
    const dx = leftPad / 2, dy = (top - bottom) / 2;
    cam.centerOn((left + right) / 2 - dx / cam.zoom, (topY + bottomY) / 2 - dy / cam.zoom);
  }

  // Rotating a phone reports the new size before the page finishes reflowing: fit again a moment later.
  private refitLater() { this.time.delayedCall(250, () => this.fitCamera()); }

  // ---------- input ----------
  // Placement (PvZ-like): drag a card onto the field, or tap a card then the field. While a card or spell is selected,
  // one finger moves an aim with a live preview and releasing places it; the camera only moves with nothing selected.
  private aim?: { lane: number; col: number };
  private ghost?: Phaser.GameObjects.Sprite;
  private cardDrag?: { id: UnitId | SpellId; spell: boolean; x: number; y: number; moved: boolean; was: boolean };

  private get armed() { return !!(this.selected || this.spell); }

  // Screen point → cell, forgiving half a cell around the grid (fat fingers near the edges).
  private cellFrom(sx: number, sy: number) {
    const w = this.cameras.main.getWorldPoint(sx, sy);
    const col = Math.floor(w.x / CW), lane = Math.floor(w.y / CH);
    if (w.x < -CW * 0.5 || w.x > (COLS + 0.5) * CW || w.y < -CH * 0.5 || w.y > (this.L + 0.5) * CH) return undefined;
    return { lane: Phaser.Math.Clamp(lane, 0, this.L - 1), col: Phaser.Math.Clamp(col, 0, COLS - 1) };
  }

  private toGame(e: PointerEvent) {
    const r = this.game.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.scale.width / r.width), y: (e.clientY - r.top) * (this.scale.height / r.height) };
  }

  private setupGestures() {
    const cam = this.cameras.main;
    this.input.addPointer(2);
    const zoomAt = (z: number, sx: number, sy: number) => {
      const before = cam.getWorldPoint(sx, sy);
      cam.setZoom(Phaser.Math.Clamp(z, this.fitZoom * 0.8, this.fitZoom * 2.6));
      cam.preRender();
      const after = cam.getWorldPoint(sx, sy);
      cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
    };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) { this.cancelArm(); return; } // PC: right click drops the card in hand
      this.touches.set(p.id, { x: p.x, y: p.y });
      this.pinch = 0;
      this.down = this.touches.size === 1 ? { x: p.x, y: p.y, moved: false } : undefined;
      if (this.armed && this.touches.size === 1) this.aim = this.cellFrom(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const t = this.touches.get(p.id);
      // PC: with a card in hand, the aim follows the mouse before any click.
      if (!t) { if (this.armed && !p.wasTouch && !this.cardDrag) this.aim = this.cellFrom(p.x, p.y); return; }
      const dx = p.x - t.x, dy = p.y - t.y;
      t.x = p.x; t.y = p.y;
      if (this.touches.size >= 2) {
        this.aim = undefined;
        const [a, b] = [...this.touches.values()];
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.pinch) zoomAt(cam.zoom * d / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = d;
        return;
      }
      if (this.down && Phaser.Math.Distance.Between(this.down.x, this.down.y, p.x, p.y) > 10) this.down.moved = true;
      if (this.armed && this.down) { this.aim = this.cellFrom(p.x, p.y); return; } // aiming, not panning
      if (this.down?.moved) { cam.scrollX -= dx / cam.zoom; cam.scrollY -= dy / cam.zoom; }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const single = this.touches.size === 1 && !!this.down;
      this.touches.delete(p.id);
      if (single && this.armed) { const c = this.cellFrom(p.x, p.y); if (c) this.commit(c.lane, c.col); }
      if (!this.touches.size) { this.down = undefined; this.aim = undefined; }
      this.pinch = 0;
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => zoomAt(cam.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
    // Dragging from a card (HTML) onto the canvas.
    window.addEventListener('pointermove', this.onCardMove);
    window.addEventListener('pointerup', this.onCardUp);
    window.addEventListener('pointercancel', this.onCardCancel);
    window.addEventListener('keydown', this.onKey);
  }

  private cancelArm() {
    this.selected = undefined; this.spell = undefined; this.aim = undefined; this.cardDrag = undefined;
    this.refreshUi();
  }

  // PC: 1–9 pick a card (in the order shown), Q/W/E a spell, Esc cancels, Space starts the fight during preparation.
  private onKey = (e: KeyboardEvent) => {
    if (!this.ui?.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.cancelArm(); return; }
    if (k === ' ') { e.preventDefault(); if (this.t < 0) this.t = 0; return; }
    const pick = (id: UnitId | SpellId, spell: boolean) => {
      const same = spell ? this.spell === id : this.selected === id;
      if (same) { this.cancelArm(); return; }
      if (spell) { this.spell = id as SpellId; this.selected = undefined; } else { this.selected = id as UnitId; this.spell = undefined; }
      const ptr = this.input.activePointer;
      this.aim = this.cellFrom(ptr.x, ptr.y);
      this.refreshUi();
    };
    if (/^[1-9]$/.test(k)) {
      const b = this.ui.querySelectorAll<HTMLButtonElement>('.bc')[Number(k) - 1];
      if (b) pick(b.dataset.u as UnitId, false);
      return;
    }
    const s = { q: 0, w: 1, e: 2 }[k as 'q' | 'w' | 'e'];
    if (s !== undefined) { const b = this.ui.querySelectorAll<HTMLButtonElement>('.sp')[s]; if (b) pick(b.dataset.s as SpellId, true); }
  };

  // The browser took the gesture (e.g. scrolling the card column): just drop the drag.
  private onCardCancel = () => { if (this.cardDrag) { this.cardDrag = undefined; this.aim = undefined; this.refreshUi(); } };

  private startCardDrag(e: PointerEvent, id: UnitId | SpellId, spell: boolean) {
    e.preventDefault();
    const was = spell ? this.spell === id : this.selected === id;
    if (spell) { this.spell = id as SpellId; this.selected = undefined; } else { this.selected = id as UnitId; this.spell = undefined; }
    this.cardDrag = { id, spell, x: e.clientX, y: e.clientY, moved: false, was };
    this.refreshUi();
  }

  private onCardMove = (e: PointerEvent) => {
    const d = this.cardDrag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) d.moved = true;
    if (!d.moved) return;
    const g = this.toGame(e);
    this.aim = this.cellFrom(g.x, g.y);
  };

  private onCardUp = (e: PointerEvent) => {
    const d = this.cardDrag;
    if (!d) return;
    this.cardDrag = undefined;
    if (d.moved) {
      const g = this.toGame(e), c = this.cellFrom(g.x, g.y);
      if (c) this.commit(c.lane, c.col);            // dropped on the field
      else { this.selected = undefined; this.spell = undefined; } // dropped back on the UI: cancel
    } else if (d.was) { this.selected = undefined; this.spell = undefined; } // tapping the selected card again: deselect
    this.aim = undefined;
    this.refreshUi();
  };

  // Faint lane grid, always visible, so it's obvious where defenders go.
  private drawGrid() {
    const g = this.add.graphics().setDepth(-1.5e5);
    g.lineStyle(1.5, 0xe8d8a8, 0.28);
    for (let l = 0; l <= this.L; l++) g.lineBetween(0, l * CH, COLS * CW, l * CH);
    for (let j = 0; j <= COLS; j++) g.lineBetween(j * CW, 0, j * CW, this.L * CH);
  }

  // ---------- UI (HTML) ----------
  // Farm defenses: research unlocks + cards won in the Caçada. A hunt battle uses the run's deck.
  private unlocked(): UnitId[] {
    if (this.cfg.deck) return this.cfg.deck;
    return (Object.keys(UNITS) as UnitId[]).filter(id => {
      const u = UNITS[id];
      if (meta.cards?.includes(id)) return true;
      return !u.hunt && (!u.research || has(u.research));
    });
  }

  private buildUi() {
    const m = this.cache.json.get('manifest');
    const el = document.createElement('div');
    el.className = 'bt';
    const pc = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const card = (id: UnitId, i: number) => {
      const u = UNITS[id], tex = this.texFor(u), mt = m[tex];
      const frames = mt?.frames ?? 16, f = id === 'bats' ? 4 : this.framesFor(u).idle[0];
      const tint = this.tintFor(u), lv = this.cfg.cardLv?.[id] ?? 0;
      return `<button class="bc${u.kind === 'hero' ? ' hero' : ''}" data-u="${id}" title="${u.desc}"${tint ? ` style="box-shadow:inset 0 -5px 0 ${hex(tint)}"` : ''}>` +
        `<span class="pic" style="background-image:url(assets/${tex}.webp);background-size:${frames * 100}% 100%;background-position:${(f / (frames - 1)) * 100}% 0"></span>` +
        `<span class="cn">${u.name}${lv ? ` ${'★'.repeat(lv)}` : ''}</span><span class="cc">${this.costOf(id)}</span><span class="cd"></span>${pc && i < 9 ? `<span class="kb">${i + 1}</span>` : ''}</button>`;
    };
    const w = WEATHER[this.weather];
    el.innerHTML = `<style>
      .bt{font:600 13px Georgia,serif;color:#f3e2c8}
      .bt .horde{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:9;width:min(460px,calc(100vw - 20px));
        box-sizing:border-box;padding:6px 12px 8px;border:8px solid transparent;border-image:url(assets/frame_tooltip.webp) 18 fill / 8px stretch}
      .bt .horde .lbl{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px}
      .bt .horde .wx{color:#b8c8ff;white-space:nowrap}
      .bt .horde .track{position:relative;height:12px;background:#2a1016;border-radius:6px;overflow:visible}
      .bt .horde .fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#5a0f1a,#d8122a);border-radius:6px}
      .bt .horde .flag{position:absolute;top:-14px;width:16px;height:22px;background:url(assets/wave_flag.webp) 0 0/400% 100% no-repeat;transform:translateX(-50%)}
      .bt .horde .head{position:absolute;top:-7px;width:26px;height:26px;background:url(assets/icon_raid.webp) center/contain no-repeat;transform:translateX(-50%);transition:left .3s}
      .bt .bottom{position:fixed;left:0;right:0;bottom:0;z-index:9;display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));background:linear-gradient(0deg,#0b0709f5 60%,#0b070900)}
      .bt .top{display:flex;gap:8px;align-items:center}
      .bt .blood{display:flex;align-items:center;gap:6px;padding:4px 12px;font-size:18px;border:8px solid transparent;border-image:url(assets/frame_panel.webp) 22 fill / 8px stretch}
      .bt .blood img{height:22px}
      .bt .hint{font-size:12px;color:#f6d9a0;min-height:15px}
      .bt .retreat{padding:6px 12px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:inherit;cursor:pointer}
      .bt .cards{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:4px 2px 2px}
      .bt .bc .kb{position:absolute;top:3px;left:4px;min-width:14px;height:14px;border-radius:3px;background:#000a;color:#f6d9a0;font:700 10px/14px system-ui;text-align:center}
      .bt .bc{position:relative;flex:none;width:74px;height:100px;border:0;background:url(assets/card_unit.webp) center/100% 100% no-repeat;cursor:pointer;padding:0;color:#f3e2c8;overflow:hidden}
      .bt .bc.hero{filter:drop-shadow(0 0 5px #e8b54a)}
      .bt .bc .pic{position:absolute;left:14px;right:14px;top:10px;height:56px;background-repeat:no-repeat}
      .bt .bc .cn{position:absolute;left:0;right:0;top:66px;font-size:10px;text-align:center;line-height:1}
      .bt .bc .cc{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);font-size:12px;color:#ffd0d4;font-weight:700}
      .bt .bc .cd{position:absolute;left:0;right:0;bottom:0;height:0;background:#000a;pointer-events:none}
      .bt .bc.sel{filter:drop-shadow(0 0 8px #e8b54a);transform:translateY(-6px)}.bt .bc.off{filter:grayscale(1) brightness(.55)}
      .bt .res{position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:#000b}
      .bt .res.on{display:flex}.bt .res .box{width:min(360px,calc(100vw - 32px));padding:14px;text-align:center;border:12px solid transparent;
        border-image:url(assets/frame_panel.webp) 22 fill / 12px stretch}.bt .res h3{margin:0 0 6px;color:#f6d9a0;font-size:20px}
      .bt .res button{margin-top:10px;width:100%;min-height:44px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:700 15px Georgia,serif}
      .bt .btoast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:9;max-width:min(460px,70vw);padding:4px 10px;
        background:#0d070acc;border-left:3px solid #a07818;border-radius:0 8px 8px 0;font-size:12px;line-height:1.25;display:none;pointer-events:none}
      .bt .btoast.on{display:block}
      .bt .go-now{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 66px);transform:translateX(-50%);z-index:9;padding:8px 14px;
        border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:700 14px Georgia,serif;cursor:pointer;
        animation:gnow 1s ease-in-out infinite alternate}@keyframes gnow{to{filter:drop-shadow(0 0 8px #e8b54a)}}
      .bt .rotate{display:none;position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 70px);z-index:9;font-size:11px;color:#c9b8a8;
        padding:4px 8px;border-radius:6px;background:#000a}
      .bt.portrait .rotate{display:block}.bt.portrait .go-now{top:calc(env(safe-area-inset-top,0px) + 96px)}
      /* Phone lying down: PvZ-like card column on the left, compact horde bar on top. */
      .bt.land .bottom{left:0;right:auto;top:0;bottom:0;width:88px;flex-direction:column;justify-content:flex-start;gap:4px;
        padding:calc(env(safe-area-inset-top,0px) + 6px) 4px calc(env(safe-area-inset-bottom,0px) + 6px) max(4px,env(safe-area-inset-left,0px));
        background:linear-gradient(90deg,#0b0709f5 75%,#0b070900)}
      .bt.land .top{flex-direction:column;gap:4px}
      .bt.land .blood{font-size:15px;padding:2px 6px;border-width:6px}.bt.land .blood img{height:18px}
      .bt.land .retreat{font-size:11px;padding:3px 6px}
      .bt.land .hint{display:none}
      .bt.land .cards{flex-direction:column;overflow-y:auto;overflow-x:hidden;flex:1;align-items:center;padding:4px 0}
      .bt.land .bc{width:60px;height:80px}.bt.land .bc .pic{left:11px;right:11px;top:8px;height:42px}.bt.land .bc .cn{top:52px;font-size:9px}
      .bt.land .bc.sel{transform:translateX(4px)}
      .bt.land .horde{left:calc(50% + 44px);width:min(460px,calc(100vw - 110px));padding:2px 10px 5px;border-width:6px}
      .bt.land .horde .lbl{margin-bottom:2px}
      .bt .spells{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:9;display:flex;gap:10px;
        padding:4px 10px;border-radius:30px;background:#0b0709b0}
      .bt.land .spells{left:calc(50% + 44px);bottom:calc(env(safe-area-inset-bottom,0px) + 6px)}
      .bt .bc,.bt .sp{touch-action:none}.bt.land .bc{touch-action:pan-y}
      .bt .sp{position:relative;width:54px;height:54px;border-radius:50%;padding:0;cursor:pointer;background:radial-gradient(circle,#2a1420,#0b0709);
        border:3px solid var(--c);box-shadow:0 0 10px var(--c);overflow:hidden}
      .bt .sp img{height:28px;margin-top:4px}.bt .sp .sc{position:absolute;left:0;right:0;bottom:3px;font:700 10px system-ui;color:#ffd0d4}
      .bt .sp .scd{position:absolute;left:0;right:0;bottom:0;height:0;background:#000b;pointer-events:none}
      .bt .sp.off{filter:grayscale(1) brightness(.6);box-shadow:none}.bt .sp.sel{transform:scale(1.15);box-shadow:0 0 18px var(--c),0 0 4px #fff}
      .bt .turn{display:none;position:fixed;inset:0;z-index:11;background:#070b14f2;align-items:center;justify-content:center;text-align:center;padding:24px}
      .bt .turn .ic{font-size:44px;margin-bottom:8px;animation:tilt 1.4s ease-in-out infinite}@keyframes tilt{50%{transform:rotate(-90deg)}}
      .bt .turn b{font-size:20px;color:#f6d9a0}.bt .turn p{color:#c9b8a8}.bt .turn button{margin-top:8px;background:none;border:1px solid #4a2a30;border-radius:6px;
        color:#c9a98a;font:inherit;padding:8px 14px}
      .bt.portrait:not(.stay) .turn{display:flex}
      .bt.land .go-now{left:calc(50% + 44px);top:calc(env(safe-area-inset-top,0px) + 50px)}
      .bt .prev{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 110px);z-index:9;max-width:min(520px,80vw);padding:5px 10px;
        background:#0d070ae0;border:1px solid #4a2a30;border-radius:8px;font-size:11px;line-height:1.35;text-align:center;pointer-events:none}
      .bt .prev b{color:#f6d9a0}.bt .prev .warn{color:#ffb070}
      .bt.land .prev{left:calc(50% + 44px);top:calc(env(safe-area-inset-top,0px) + 92px)}
      .bt.land .btoast{left:auto;right:max(8px,env(safe-area-inset-right,0px));top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);transform:none;max-width:min(250px,28vw)}
    </style>
    <div class="horde"><div class="lbl"><span class="wl">${L('Horda', 'Horde')}</span><span class="wx" title="${w.desc}">${w.icon} ${w.name}</span><span class="wk"></span></div>
      <div class="track"><div class="fill"></div>${this.cfg.raid.waves.map(v => `<i class="flag" style="left:${(v / this.lastSpawn) * 100}%"></i>`).join('')}<i class="head"></i></div></div>
    <button class="go-now"></button><div class="prev">${this.preview()}</div><div class="btoast"></div><div class="rotate">${L('↻ Melhor com o celular deitado', '↻ Better with your phone sideways')}</div>
    <div class="turn"><div><div class="ic">📱↻</div><b>${L('Gire o celular', 'Turn your phone')}</b><p>${L('A batalha foi feita para jogar deitado.', 'The battle was made to be played sideways.')}</p><button>${L('Continuar assim mesmo', 'Continue anyway')}</button></div></div>
    <div class="bottom"><div class="top"><div class="blood"><img src="assets/icon_blood.webp" alt=""><b class="bv">0</b></div><button class="retreat">${L('Recuar', 'Retreat')}</button></div>
      <div class="hint"></div>
      <div class="cards">${this.unlocked().map(card).join('')}</div></div>
    <div class="spells">${(Object.keys(SPELLS) as SpellId[]).map(id => `<button class="sp" data-s="${id}" style="--c:${SPELLS[id].css}" title="${SPELLS[id].name}: ${SPELLS[id].desc}">` +
      `<img src="assets/${SPELLS[id].icon}.webp" alt=""><span class="sc">${SPELLS[id].cost}</span><span class="scd"></span></button>`).join('')}</div>
    <div class="res"><div class="box"><h3></h3><p class="rt"></p><button>${this.mode === 'hunt' ? L('Continuar a Caçada', 'Continue the Hunt') : L('Voltar à fazenda', 'Back to the farm')}</button></div></div>`;
    document.body.appendChild(el);
    document.body.classList.add('in-battle');
    this.ui = el;
    el.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => b.addEventListener('pointerdown', e => this.startCardDrag(e, b.dataset.u as UnitId, false)));
    el.querySelectorAll<HTMLButtonElement>('.sp').forEach(b => b.addEventListener('pointerdown', e => this.startCardDrag(e, b.dataset.s as SpellId, true)));
    el.querySelector<HTMLButtonElement>('.go-now')!.onclick = () => { if (this.t < 0) this.t = 0; };
    el.querySelector<HTMLButtonElement>('.turn button')!.onclick = () => { el.classList.add('stay'); this.fitCamera(); };
    el.querySelector<HTMLButtonElement>('.retreat')!.onclick = () => {
      const q = this.endless ? L('Encerrar a Lua de Sangue?', 'End the Blood Moon?') : this.mode === 'hunt' ? L('Desistir desta luta? A Caçada termina aqui.', 'Give up this fight? The Hunt ends here.') : L('Recuar? Os lobisomens que restarem levam humanos.', 'Retreat? The remaining werewolves will take humans.');
      if (confirm(q)) this.finish(false, true);
    };
    this.refreshUi();
  }

  // What's coming, so the player can plan: counts per wolf type, and a warning for those that get past defenders on purpose.
  private preview() {
    const n = new Map<WolfId, number>();
    for (const s of this.cfg.raid.spawns) n.set(s.wolf, (n.get(s.wolf) ?? 0) + 1);
    const list = [...n].map(([id, c]) => `${c}× ${id === 'alpha' && this.cfg.alphaName ? this.cfg.alphaName : WOLVES[id].name}`).join(' · ');
    const warn = [...n.keys()].filter(id => BYPASS[id]).map(id => `⚠ ${WOLVES[id].name} ${BYPASS[id]}`).join('<br>');
    const tip = L('Dica: Cálices primeiro (Sangue), Sentinelas atrás, Muralhas na frente. Cada raia tem uma tocha de emergência na cerca.', 'Tip: Chalices first (Blood), Sentinels behind, Walls in front. Each lane has an emergency torch at the fence.')
      + (matchMedia('(hover: hover) and (pointer: fine)').matches ? L(' Teclado: 1–9 cartas · Q W E magias · Espaço começa · botão direito ou Esc cancela.', ' Keyboard: 1–9 cards · Q W E spells · Space starts · right click or Esc cancels.') : '');
    return `<b>${this.endless ? L('Primeira onda', 'First wave') : L('Vêm aí', 'Incoming')}:</b> ${list}${warn ? `<br><span class="warn">${warn}</span>` : ''}<br>${tip}`;
  }

  private get lastSpawn() { const sp = this.cfg.raid.spawns; return Math.max(1, sp[sp.length - 1]?.at ?? 1); }

  private refreshUi() {
    const blood = Math.floor(this.blood);
    this.ui.querySelector('.bv')!.textContent = String(blood);
    this.ui.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => {
      const id = b.dataset.u as UnitId, u = UNITS[id];
      const left = Math.max(0, (this.ready[id] ?? -Infinity) - this.t);
      const heroUsed = u.kind === 'hero' && this.units.some(x => x.def.kind === 'hero');
      b.classList.toggle('off', blood < this.costOf(id) || left > 0 || heroUsed);
      b.classList.toggle('sel', id === this.selected);
      b.querySelector<HTMLElement>('.cd')!.style.height = `${(left / u.recharge) * 100}%`;
    });
    this.ui.querySelectorAll<HTMLButtonElement>('.sp').forEach(b => {
      const id = b.dataset.s as SpellId, sp = SPELLS[id];
      const left = Math.max(0, (this.spellReady[id] ?? -Infinity) - this.t);
      b.classList.toggle('off', blood < sp.cost || left > 0);
      b.classList.toggle('sel', id === this.spell);
      b.querySelector<HTMLElement>('.scd')!.style.height = `${(left / sp.cd) * 100}%`;
    });
    const total = this.cfg.raid.spawns.length;
    const prog = this.endless ? Phaser.Math.Clamp(this.spawnIdx / Math.max(1, total), 0, 1) : Phaser.Math.Clamp(this.t / this.lastSpawn, 0, 1);
    const prep = this.t < 0;
    this.ui.querySelector<HTMLElement>('.go-now')!.style.display = prep ? 'block' : 'none';
    this.ui.querySelector<HTMLElement>('.prev')!.style.display = prep ? 'block' : 'none';
    if (prep) this.ui.querySelector('.go-now')!.textContent = L(`Preparação · ${Math.ceil(-this.t / 1000)} s · Começar já ▸`, `Preparing · ${Math.ceil(-this.t / 1000)} s · Start now ▸`);
    this.ui.querySelector<HTMLElement>('.horde .fill')!.style.width = `${prog * 100}%`;
    this.ui.querySelector<HTMLElement>('.horde .head')!.style.left = `${prog * 100}%`;
    const wave = this.cfg.raid.waves.filter(v => this.t >= v).length;
    const hearts = `${'♥'.repeat(Math.max(0, this.lives))}${'♡'.repeat(Math.max(0, this.maxLives - this.lives))}`;
    this.ui.querySelector('.wl')!.textContent = this.endless ? `${L('Lua de Sangue · onda', 'Blood Moon · wave')} ${this.wave} · ${hearts}`
      : this.mode === 'hunt' ? `${this.cfg.title ?? L('Caçada', 'The Hunt')} · ${hearts}`
      : `${this.cfg.raid.big ? L('Lua cheia', 'Full moon') : L('Horda', 'Horde')} · ${L('onda', 'wave')} ${Math.max(1, wave)}/${this.cfg.raid.waves.length}`;
    this.ui.querySelector('.wk')!.textContent = this.endless ? L(`${this.kills} abatidos · recorde ${meta.bestWave ?? 0}`, `${this.kills} slain · record ${meta.bestWave ?? 0}`) : L(`${this.kills}/${total} abatidos`, `${this.kills}/${total} slain`);
    this.ui.querySelector('.hint')!.textContent = this.spell ? `${SPELLS[this.spell].name}: ${SPELLS[this.spell].desc}` : this.selected
      ? `${UNITS[this.selected].name}: ${L('arraste até uma casa', 'drag onto a cell')} · ${UNITS[this.selected].desc}` : L('Arraste uma carta até a grade (ou toque na carta e depois na casa).', 'Drag a card onto the grid (or tap the card, then the cell).');
  }

  private toast(msg: string, ms = 4200) {
    const t = this.ui?.querySelector<HTMLElement>('.btoast');
    if (!t) return;
    const who = msg.match(/^(Aureliano|Conde Valério|Count Valerio|Ulf):/)?.[1];
    if (who) voice(who === 'Aureliano' || who === 'Ulf' ? who.toLowerCase() : 'count', 200);
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout((t as any)._h);
    (t as any)._h = setTimeout(() => t.classList.remove('on'), ms);
  }

  // ---------- placing ----------
  private cellFree(lane: number, col: number) { return !this.blocked.has(`${lane}:${col}`) && !this.units.some(x => x.lane === lane && x.col === col); }

  private canPlace(lane: number, col: number) {
    if (this.spell) return this.blood >= SPELLS[this.spell].cost && (this.spellReady[this.spell] ?? -Infinity) <= this.t;
    if (!this.selected) return false;
    const u = UNITS[this.selected];
    if (u.kind === 'hero' && this.units.some(x => x.def.kind === 'hero')) return false;
    return this.blood >= this.costOf(this.selected) && (this.ready[this.selected] ?? -Infinity) <= this.t && (!!u.spell || this.cellFree(lane, col));
  }

  private commit(lane: number, col: number) {
    if (this.ended) return;
    if (this.spell) { this.cast(this.spell, lane, col); return; }
    if (!this.selected) return;
    const id = this.selected, def = UNITS[id], cost = this.costOf(id);
    if (this.blood < cost) { this.toast(L('Sangue insuficiente.', 'Not enough Blood.')); return; }
    if ((this.ready[id] ?? -Infinity) > this.t) { this.toast(L('Carta recarregando.', 'Card recharging.')); return; }
    if (def.kind === 'hero' && this.units.some(x => x.def.kind === 'hero')) { this.toast(L('Só um herói por batalha.', 'Only one hero per battle.')); return; }
    if (def.spell) { this.pay(cost); this.castBats(lane, col); this.ready.bats = this.t + def.recharge; this.selected = undefined; this.refreshUi(); return; }
    if (this.blocked.has(`${lane}:${col}`)) { this.toast(this.arena.flooded ? L('Casa alagada: ninguém fica de pé ali.', 'Flooded cell: nobody can stand there.') : L('Uma lápide ocupa essa casa.', 'A tombstone takes up that cell.')); return; }
    if (!this.cellFree(lane, col)) { this.toast(L('Essa casa já está ocupada.', 'That cell is already taken.')); return; }
    this.pay(cost);
    this.place(id, lane, col);
    this.selected = undefined; // PvZ: one card, one placement
    this.refreshUi();
  }

  private costOf(id: UnitId) { return Math.round(UNITS[id].cost * state.mods.unitCost * less('unitCost', 0.5) * (1 - (this.cfg.boost?.cost ?? 0))); }

  private get blood() { return this.ownBank ? this.bank : state.resources.blood; }
  private set blood(v: number) { if (this.ownBank) this.bank = v; else state.resources.blood = v; }
  private pay(n: number) { this.blood -= n; this.spent += n; }

  // Unit strength: Arsenal level (hunt marks) + run card level + research + relics.
  private scaled(id: UnitId): UnitDef {
    const d = UNITS[id], b = this.cfg.boost ?? {};
    const lv = (1 + 0.15 * (meta.unitLv?.[id] ?? 0)) * (1 + 0.2 * (this.cfg.cardLv?.[id] ?? 0));
    return { ...d, hp: Math.round(d.hp * lv * (1 + fx('unitHp') + (b.hp ?? 0))), dmg: d.dmg && Math.round(d.dmg * lv * (1 + fx('unitDmg') + (b.dmg ?? 0))),
      gen: d.gen && Math.round(d.gen * lv * (1 + fx('chalice') + (b.gen ?? 0)) * (this.weather === 'rain' ? 1.25 : 1)) };
  }

  // Attack pace: rain slows shooters, snow slows everyone.
  private rateOf(u: Unit) { return u.def.rate! * (this.weather === 'snow' ? 1.25 : 1) * (this.weather === 'rain' && (u.def.kind === 'shoot' || u.def.kind === 'air') ? 1.25 : 1); }

  // Damage: eclipse + Blood Lantern auras around the unit.
  private dmgOf(u: Unit) {
    const aura = this.units.some(a => a.def.kind === 'aura' && a !== u && Math.abs(a.lane - u.lane) <= 1 && Math.abs(a.col - u.col) <= 1) ? 1.25 : 1;
    return u.def.dmg! * aura * (this.weather === 'eclipse' ? 1.3 : 1);
  }

  // ---------- units ----------
  private anim(key: string, tex: string, frames: number[], rate: number, repeat = -1) {
    if (!this.anims.exists(key) && this.textures.exists(tex)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
    return key;
  }
  private idleKey(u: { def: UnitDef; tex: string }) { return this.anim(`${u.tex}_idle`, u.tex, this.framesFor(u.def).idle, u.def.kind === 'gen' || u.def.kind === 'garg' ? 5 : 2); }
  private act(u: Unit, rate = 8) {
    const fr = this.framesFor(u.def).act;
    u.spr.play(this.anim(`${u.tex}_act`, u.tex, fr, rate, 0)).once('animationcomplete', () => { if (u.spr.active && u.hp > 0) u.spr.play(this.idleKey(u)); });
  }

  private place(id: UnitId, lane: number, col: number) {
    const def = this.scaled(id);
    const tex = this.texFor(def), tint = this.tintFor(def);
    const c = cellPos(lane, col);
    const scale = US * (def.scale ?? 1);
    const spr = this.add.sprite(c.x, c.y, tex, 0).setOrigin(0.5, 1).setDepth(c.y);
    if (tint) spr.setTint(tint);
    const u: Unit = { def, id, tex, lane, col, spr, hp: def.hp, cd: def.kind === 'gen' ? 2500 : def.rate ? def.rate * 0.4 : 0, stunUntil: 0, stoneUntil: 0 };
    spr.play(this.idleKey(u));
    spr.setScale(scale * 0.2);
    this.tweens.add({ targets: spr, scale, duration: 250, ease: 'Back.easeOut' });
    this.burst(c.x, c.y - 20, def.kind === 'hero' ? 0xffd870 : 0xe8b54a, def.kind === 'hero' ? 30 : 12, 120, 450);
    sfx.latch();
    if (def.kind === 'hero') { this.cameras.main.shake(200, 0.004); voice('count'); this.toast(L('Conde Valério: Boa noite, senhores. Vieram pelo jantar?', 'Count Valerio: Good evening, gentlemen. Have you come for dinner?')); }
    // The witch's fog: a permanent low cloud over the cells in front of her.
    if (def.kind === 'fog') {
      u.extra = this.add.particles(0, 0, 'bt_dot', { x: { min: (col + 0.8) * CW, max: (col + 1 + def.range!) * CW }, y: { min: lane * CH + 10, max: (lane + 1) * CH - 6 },
        speedX: { min: -10, max: 10 }, speedY: { min: -8, max: 2 }, scale: { start: 1.8, end: 3.2 }, alpha: { start: 0.22, end: 0 }, lifespan: 1800,
        tint: [0x9a6aff, 0xc8b0ff], quantity: 1, frequency: 90 }).setDepth(c.y + 5);
    }
    this.units.push(u);
    this.ready[id] = this.t + def.recharge;
  }

  private castBats(lane: number, col: number) {
    const c = cellPos(lane, col);
    const fx_ = this.add.sprite(c.x, c.y - 30, 'fx_bat_swarm', 0).setScale(S * 1.6).setDepth(9e5);
    fx_.play(this.anim('bats_fx', 'fx_bat_swarm', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12, 0)).once('animationcomplete', () => fx_.destroy());
    this.time.delayedCall(450, () => {
      for (const w of this.wolves) if (!w.dead && Math.abs(w.lane - lane) <= 1 && Math.abs(w.j - (col + 0.5)) <= 1.6) this.hurt(w, this.scaled('bats').dmg!);
    });
  }

  private hitUnit(u: Unit, dmg: number) {
    if (u.hp <= 0) return;
    u.hp -= dmg;
    u.spr.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (!u.spr.active) return; u.spr.clearTint(); const t = this.tintFor(u.def); if (t) u.spr.setTint(t); });
    if (u.id === 'wall' && u.tex === 'ghoul_wall') {
      const r = u.hp / u.def.hp;
      const key = r > 0.66 ? this.idleKey(u) : r > 0.33 ? this.anim('wall_crack', u.tex, [4, 5], 2) : this.anim('wall_broken', u.tex, [8, 9], 2);
      if (u.spr.anims.currentAnim?.key !== key) u.spr.play(key);
    }
    if (u.hp <= 0) this.killUnit(u);
  }

  private killUnit(u: Unit) {
    if (!this.units.includes(u)) return;
    this.units = this.units.filter(x => x !== u);
    u.hp = 0;
    u.extra?.destroy();
    const spr = u.spr;
    if ((u.tex === 'ghoul_wall' || u.tex === 'blood_chalice') && u.def.kind !== 'mine') {
      spr.play(this.anim(`${u.tex}_die`, u.tex, [12, 13, 14, 15], 7, 0)).once('animationcomplete', () =>
        this.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() }));
    } else if (u.def.kind === 'mine') {
      spr.destroy();
    } else {
      const poof = this.add.sprite(spr.x, spr.y, 'fx_vampire_poof', 0).setOrigin(0.5, 1).setScale(S).setDepth(spr.depth);
      poof.play(this.anim('poof', 'fx_vampire_poof', [0, 1, 2, 3], 7, 0)).once('animationcomplete', () => poof.destroy());
      spr.destroy();
    }
  }

  private updateUnits(dt: number) {
    for (const u of [...this.units]) {
      if (this.t < u.stunUntil || u.hp <= 0) continue;
      u.cd -= dt;
      const k = u.def.kind;
      if (k === 'gen' && u.cd <= 0) {
        u.cd = this.rateOf(u);
        this.act(u);
        this.spawnOrb(u);
      } else if (k === 'shoot' && u.cd <= 0) {
        const target = this.frontWolf(u.lane, u.col - 0.2, COLS + 0.6);
        if (target) { u.cd = this.rateOf(u); this.shoot(u, target, u.id === 'crossbow' && target.hp < target.def.hp ? 2 : 1); }
      } else if (k === 'air' && u.cd <= 0) {
        const inRange = (w: Wolf) => !w.dead && this.seen(w) && w.lane === u.lane && w.j >= u.col - 0.2 && w.j <= u.col + u.def.range! + 0.5;
        const target = this.wolves.find(w => inRange(w) && (w.def.fly || w.id === 'leaper')) ?? this.frontWolf(u.lane, u.col - 0.2, u.col + u.def.range! + 0.5);
        if (target) { u.cd = this.rateOf(u); this.shoot(u, target, target.def.fly || target.id === 'leaper' ? 2 : 1, 0x9a9aff); }
      } else if (k === 'pierce' && u.cd <= 0) {
        const hit = this.wolves.filter(w => !w.dead && this.seen(w) && w.lane === u.lane && w.j >= u.col + 0.3 && w.j <= u.col + 0.5 + u.def.range! + 0.4);
        if (hit.length) {
          u.cd = this.rateOf(u);
          this.act(u, 10);
          const c = cellPos(u.lane, u.col);
          const g = this.add.graphics().setDepth(9.6e5);
          g.fillStyle(0xff4a5a, 0.5).fillRect(c.x + 20, c.y - 40, CW * (u.def.range! + 0.3), 10);
          this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
          for (const w of hit) this.hurt(w, this.dmgOf(u));
        }
      } else if (k === 'fog' && u.cd <= 0) {
        u.cd = this.rateOf(u);
        for (const w of this.wolves) if (!w.dead && !w.def.fly && w.lane === u.lane && w.j >= u.col + 0.5 && w.j <= u.col + 1.5 + u.def.range!) {
          w.slowUntil = this.t + 1300;
          this.hurt(w, this.dmgOf(u), true);
        }
      } else if (k === 'mine') {
        const w = this.wolves.find(x => !x.dead && !x.def.fly && !x.hidden && x.lane === u.lane && Math.abs(x.j - (u.col + 0.5)) < 0.45);
        if (w) this.explodeMine(u);
      } else if (k === 'hero' && u.cd <= 0) {
        const hit = this.wolves.filter(w => !w.dead && !w.def.fly && w.lane === u.lane && w.j >= u.col + 0.2 && w.j <= u.col + 1.5);
        if (hit.length) {
          u.cd = this.rateOf(u);
          this.act(u, 12);
          const c = cellPos(u.lane, u.col);
          const arc = this.add.graphics().setDepth(9.6e5);
          arc.lineStyle(6, 0xffd870, 0.9).beginPath().arc(c.x + 20, c.y - 36, 46, -1.2, 1.2).strokePath();
          this.tweens.add({ targets: arc, alpha: 0, duration: 220, onComplete: () => arc.destroy() });
          for (const w of hit) this.hurt(w, this.dmgOf(u));
        }
      } else if (k === 'alch' && u.cd <= 0) {
        const target = this.frontWolf(u.lane, u.col - 0.2, u.col + 4.5);
        if (target) { u.cd = this.rateOf(u); this.throwFlask(u, target); }
      } else if (k === 'garg') {
        if (this.t < u.stoneUntil) continue;
        if (u.spr.anims.currentAnim?.key === 'garg_stone') u.spr.play(this.anim('garg_wake', u.tex, [13, 14, 15], 6, 0)).once('animationcomplete', () => u.spr.play(this.idleKey(u)));
        const target = this.frontWolf(u.lane, u.col - 0.3, u.col + 1.7);
        if (target) {
          u.stoneUntil = this.t + this.rateOf(u);
          u.spr.play(this.anim('garg_dive', u.tex, [8, 9, 10, 11], 12, 0)).once('animationcomplete', () => {
            u.spr.setFrame(12);
            u.spr.anims.stop();
            this.anims.exists('garg_stone') || this.anims.create({ key: 'garg_stone', frames: this.anims.generateFrameNumbers(u.tex, { frames: [12] }), frameRate: 1 });
            u.spr.play('garg_stone');
          });
          this.time.delayedCall(250, () => { if (!target.dead) this.hurt(target, this.dmgOf(u)); });
        }
      }
    }
  }

  private explodeMine(u: Unit) {
    const c = cellPos(u.lane, u.col);
    if (this.textures.exists('fx_bomb')) {
      const b = this.add.sprite(c.x, c.y - 20, 'fx_bomb', 0).setScale(S * 2.4).setDepth(9.6e5);
      b.play(this.anim('bomb', 'fx_bomb', [0, 1, 2, 3], 10, 0)).once('animationcomplete', () => b.destroy());
    }
    this.burst(c.x, c.y - 20, 0xff7a1a, 36, 280, 700);
    this.burst(c.x, c.y - 20, 0xd8122a, 20, 200, 600);
    this.cameras.main.shake(260, 0.008);
    sfx.hitHeavy(); sfx.bong();
    for (const w of this.wolves) if (!w.dead && !w.def.fly && w.lane === u.lane && Math.abs(w.j - (u.col + 0.5)) < 1.5) this.hurt(w, this.dmgOf(u));
    this.killUnit(u);
  }

  // Fog weather hides wolves in the far cells: nobody can target what they can't see.
  private seen(w: Wolf) { return !w.hidden && (this.weather !== 'fog' || w.j <= COLS - 3.5); }

  private frontWolf(lane: number, from: number, to: number) {
    let best: Wolf | undefined;
    for (const w of this.wolves) if (!w.dead && this.seen(w) && w.lane === lane && w.j >= from && w.j <= to && w.j < COLS + 0.6 && (!best || w.j < best.j)) best = w;
    return best;
  }

  private shoot(u: Unit, w: Wolf, mult = 1, tint?: number) {
    this.act(u);
    sfx.shot();
    const from = { x: u.spr.x + 10, y: u.spr.y - 34 }, to = { x: w.spr.x, y: w.spr.y - 30 };
    const bolt = this.add.sprite(from.x, from.y, 'fx_bolt', 0).setScale(S * 0.8).setDepth(9e5).setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
    if (tint ?? this.tintFor(u.def)) bolt.setTint(tint ?? this.tintFor(u.def)!);
    this.tweens.add({ targets: bolt, x: to.x, y: to.y, duration: 220, onComplete: () => { bolt.destroy(); if (!w.dead) this.hurt(w, this.dmgOf(u) * mult); } });
  }

  private throwFlask(u: Unit, w: Wolf) {
    this.act(u, 10);
    const fl = this.add.sprite(u.spr.x, u.spr.y - 30, 'fx_flask', 0).setScale(S * 0.7).setDepth(9e5).play(this.anim('flask_spin', 'fx_flask', [0, 1, 2, 3], 12));
    const tx = w.spr.x, ty = w.spr.y - 10;
    this.tweens.add({ targets: fl, x: tx, duration: 500 });
    this.tweens.add({ targets: fl, y: { from: fl.y, to: ty }, duration: 500, ease: 'Quad.easeIn', onComplete: () => {
      fl.play(this.anim('flask_splash', 'fx_flask', [4, 5, 6, 7], 10, 0)).once('animationcomplete', () => fl.destroy());
      this.burst(tx, ty, 0x7aff8a, 10, 120, 450);
      sfx.flask();
      for (const o of this.wolves) if (!o.dead && Math.abs(o.lane - w.lane) <= 1 && Math.abs(o.j - w.j) < 0.9) { this.hurt(o, this.dmgOf(u)); o.slowUntil = this.t + 3000; }
    } });
  }

  // Chalice overflow: tap it, or it flies into the pool on its own.
  private spawnOrb(u: Unit) {
    const orb = this.add.sprite(u.spr.x, u.spr.y - 80, 'blood_orb', 0).setScale(S * 1.3).setDepth(9.5e5);
    if (this.anims.exists('orb_float')) orb.play('orb_float');
    orb.setInteractive(new Phaser.Geom.Circle(orb.width / 2, orb.height / 2, orb.width), Phaser.Geom.Circle.Contains);
    let done = false;
    const take = () => {
      if (done) return;
      done = true;
      this.blood += u.def.gen!;
      this.floatText(orb.x, orb.y, L(`+${u.def.gen} Sangue`, `+${u.def.gen} Blood`));
      this.burst(orb.x, orb.y, 0xff3348, 8, 90, 350);
      sfx.coin();
      orb.destroy();
      this.refreshUi();
    };
    orb.once('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); take(); });
    this.tweens.add({ targets: orb, y: orb.y - 30, duration: 2200, onComplete: take });
  }

  private floatText(x: number, y: number, msg: string, color = '#ff3348') {
    const t = this.add.text(x, y, msg, { fontFamily: 'Georgia, serif', fontSize: '26px', color, fontStyle: 'bold', stroke: '#1a0508', strokeThickness: 5 })
      .setOrigin(0.5).setScale(0.5 / this.cameras.main.zoom).setDepth(1.1e6);
    this.tweens.add({ targets: t, y: y - 30 / this.cameras.main.zoom, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  // ---------- vampire spells ----------
  private cast(id: SpellId, lane: number, col: number) {
    const sp = SPELLS[id];
    if (this.blood < sp.cost) { this.toast(L('Sangue insuficiente para a magia.', 'Not enough Blood for the spell.')); return; }
    if ((this.spellReady[id] ?? -Infinity) > this.t) { this.toast(L('A magia ainda está recarregando.', 'The spell is still recharging.')); return; }
    this.pay(sp.cost);
    this.spellReady[id] = this.t + sp.cd;
    this.spell = undefined;
    const power = (1 + fx('unitDmg') + (this.cfg.boost?.dmg ?? 0)) * (this.weather === 'eclipse' ? 1.3 : 1);
    const cam = this.cameras.main;
    if (id === 'rain') {
      sfx.blade();
      const y0 = lane * CH;
      const band = this.add.rectangle(COLS * CW / 2, y0 + CH / 2, COLS * CW, CH, sp.color, 0).setDepth(-1.4e5);
      this.tweens.add({ targets: band, fillAlpha: 0.35, duration: 250, yoyo: true, hold: 500, onComplete: () => band.destroy() });
      const rain = this.add.particles(0, 0, 'bt_dot', { x: { min: 0, max: COLS * CW }, y: y0 - 160, speedY: { min: 700, max: 1000 }, scaleX: 0.35, scaleY: { start: 1.6, end: 0.8 },
        lifespan: 260, tint: [0xd8122a, 0xff3348, 0x8a0a1a], quantity: 5, frequency: 12, blendMode: 'ADD' }).setDepth(9.6e5);
      this.time.delayedCall(800, () => rain.stop());
      this.time.delayedCall(1400, () => rain.destroy());
      this.time.delayedCall(450, () => {
        cam.flash(180, 120, 0, 10);
        cam.shake(220, 0.005);
        for (const w of this.wolves) if (!w.dead && w.lane === lane && w.j < COLS + 0.8) { this.burst(w.spr.x, w.spr.y - 30, sp.color, 10); this.hurt(w, 120 * power); }
      });
    } else if (id === 'mist') {
      sfx.pluck(); sfx.glass();
      const fog = this.add.rectangle(COLS * CW / 2, this.L * CH / 2, COLS * CW + 200, this.L * CH + 100, sp.color, 0).setDepth(9.4e5);
      this.tweens.add({ targets: fog, fillAlpha: 0.22, duration: 500, yoyo: true, hold: 5000, onComplete: () => fog.destroy() });
      const wisps = this.add.particles(0, 0, 'bt_dot', { x: { min: 0, max: COLS * CW }, y: { min: 0, max: this.L * CH }, speedX: { min: -20, max: 20 }, speedY: { min: -12, max: 4 },
        scale: { start: 2.5, end: 5 }, alpha: { start: 0.25, end: 0 }, lifespan: 2200, tint: [0x9a6aff, 0xc8b0ff], quantity: 2, frequency: 60, blendMode: 'ADD' }).setDepth(9.45e5);
      this.time.delayedCall(5200, () => wisps.stop());
      this.time.delayedCall(7600, () => wisps.destroy());
      for (const w of this.wolves) if (!w.dead) { w.slowUntil = this.t + 6000; this.burst(w.spr.x, w.spr.y - 30, sp.color, 6, 60); }
    } else {
      const c = cellPos(lane, col);
      const ring = this.add.circle(c.x, c.y - 20, 10, sp.color, 0.5).setDepth(9.5e5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, radius: CW * 1.6, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
      this.burst(c.x, c.y - 20, sp.color, 24, 220, 700);
      sfx.glass();
      let got = 0;
      for (const w of this.wolves) {
        if (w.dead || Math.abs(w.lane - lane) > 1 || Math.abs(w.j - (col + 0.5)) > 1.6) continue;
        got++;
        this.hurt(w, 80 * power);
        this.stream(w.spr.x, w.spr.y - 30, -40, w.spr.y - 30, sp.color);
      }
      if (got) { this.blood += got * 10; this.floatText(c.x, c.y - 60, L(`+${got * 10} Sangue`, `+${got * 10} Blood`)); }
    }
    this.refreshUi();
  }

  // ---------- visual effects ----------
  private burst(x: number, y: number, tint: number, n = 12, speed = 160, life = 550) {
    const e = this.add.particles(x, y, 'bt_dot', { speed: { min: speed * 0.3, max: speed }, angle: { min: 0, max: 360 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: life, tint, emitting: false, blendMode: 'ADD', gravityY: 120 }).setDepth(9.6e5);
    e.explode(n);
    this.time.delayedCall(life + 100, () => e.destroy());
  }

  // Blood flowing from a point back to the fence (the vampires drink it).
  private stream(x: number, y: number, tx: number, ty: number, tint: number) {
    for (let k = 0; k < 8; k++) {
      const d = this.add.image(x, y, 'bt_dot').setTint(tint).setScale(0.6).setDepth(9.6e5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: d, x: tx, y: ty + Phaser.Math.Between(-20, 20), scale: 0.2, delay: k * 50, duration: 600, ease: 'Sine.easeIn', onComplete: () => d.destroy() });
    }
  }

  // ---------- wolves ----------
  private spawn(id: WolfId, lane: number, j = COLS + 1) {
    if (id === 'pups' && !this.textures.exists('wolf_pups')) { for (let k = 0; k < 3; k++) this.spawn('pup', lane, j + k * 0.4); return; }
    const base = WOLVES[id];
    const tex = this.texFor(base), tint = this.tintFor(base);
    const c = cellPos(lane, j);
    const scale = US * (base.scale ?? 1);
    const spr = this.add.sprite(c.x, c.y, tex, 0).setOrigin(0.5, 1).setScale(scale).setFlipX(true).setDepth(c.y);
    if (tint) spr.setTint(tint);
    spr.play(this.anim(`${tex}_walk`, tex, [0, 1, 2, 3], base.speed > 0.8 ? 10 : 7));
    const hp = base.hp * (1 + (this.cfg.raid.night - 1) * 0.06) * (this.weather === 'fullmoon' ? 1.25 : 1) * (base.boss || id === 'alpha' ? this.cfg.bossHp ?? 1 : 1);
    const w: Wolf = { def: { ...base, hp }, id, tex, lane, j, spr, hp, bite: 0, slowUntil: 0, buffUntil: 0, jumped: false, skill: 4000, busy: false, dead: false,
      hidden: false, phase: 0, bob: Math.random() * 6 };
    this.wolves.push(w);
    this.placeWolf(w);
    if (id === 'alpha') {
      this.toast(this.cfg.alphaName ? L(`${this.cfg.alphaName} entrou na trilha. Os outros lobos abrem caminho.`, `${this.cfg.alphaName} is on the trail. The other wolves make way.`)
        : L('Um alfa da matilha entrou na trilha. Ele atordoa os defensores perto dele.', 'A pack alpha is on the trail. It stuns the defenders near it.'));
      sfx.howl(); voice('ulf');
    }
    if (id === 'mother') { this.toast(L('A Mãe da Matilha chegou. A floresta inteira uivou junto. Ela tem olhos âmbar… e parece conhecer você.', 'The Pack Mother has arrived. The whole forest howled with her. She has amber eyes… and seems to know you.'), 6000); this.cameras.main.shake(500, 0.01); sfx.howl(); voice('mother'); }
  }

  private hurt(w: Wolf, dmg: number, quiet = false) {
    if (w.dead || w.hidden) return;
    dmg = Math.max(1, dmg - (w.def.armor ?? 0) * (quiet ? 0.2 : 1)); // armour blunts every blow (less against burns and fog)
    w.hp -= dmg;
    if (!quiet) {
      w.spr.setTintFill(0xffffff);
      this.time.delayedCall(60, () => { if (!w.dead && w.spr.active) { w.spr.clearTint(); const t = this.tintFor(w.def); if (t) w.spr.setTint(t); } });
    }
    // The Pack Mother roars at 2/3 and 1/3 of her life: stuns nearby defenders and speeds up.
    if (w.id === 'mother' && w.phase < 2 && w.hp < w.def.hp * (w.phase === 0 ? 0.66 : 0.33)) {
      w.phase++;
      w.def.speed *= 1.15;
      this.cameras.main.shake(450, 0.012);
      this.toast(L(`A Mãe da Matilha ruge (fase ${w.phase + 1})!`, `The Pack Mother roars (phase ${w.phase + 1})!`));
      for (const u of this.units) if (Math.abs(u.lane - w.lane) <= 1) u.stunUntil = this.t + 2500;
      this.summonPups(w);
    }
    if (w.hp > 0) { if (dmg >= 15 && !quiet) { this.burst(w.spr.x, w.spr.y - 34, 0xff6a4a, 4, 90, 300); sfx.hit(); } return; }
    w.dead = true;
    this.kills++;
    const hit = this.add.sprite(w.spr.x, w.spr.y - 20, 'fx_hit', 0).setScale(S).setDepth(9e5);
    hit.play(this.anim('hit', 'fx_hit', [0, 1, 2, 3], 14, 0)).once('animationcomplete', () => hit.destroy());
    const big = w.def.boss || w.id === 'alpha';
    if (big) this.bossKilled = true;
    this.burst(w.spr.x, w.spr.y - 30, 0xd8122a, big ? 40 : w.id === 'brute' || w.id === 'armored' ? 24 : 14, big ? 260 : 170);
    if (w.id === 'brute' || w.id === 'armored' || big) this.cameras.main.shake(big ? 450 : 200, big ? 0.012 : 0.005);
    if (big || w.id === 'brute' || w.id === 'armored') sfx.hitHeavy(); else sfx.thud();
    if (fx('defense') && this.mode === 'raid') state.resources.essence += 2;
    this.tweens.add({ targets: w.spr, alpha: 0, y: w.spr.y + 6, duration: 450, onComplete: () => w.spr.destroy() });
    this.refreshUi();
  }

  private summonPups(w: Wolf) {
    for (let k = -1; k <= 1; k++) {
      const lane = Phaser.Math.Clamp(w.lane + k, 0, this.L - 1);
      this.spawn('pup', lane, Math.min(COLS + 1, w.j + 0.8));
    }
  }

  private updateWolves(dt: number) {
    const s = dt / 1000;
    for (const w of this.wolves) {
      if (w.dead || w.busy) continue;
      // Special skills
      w.skill -= dt;
      if (w.skill <= 0 && (w.id === 'howler' || w.id === 'alpha' || w.def.heal || w.def.storm || w.def.summon)) {
        w.skill = w.id === 'alpha' ? 8000 : w.def.heal ? 5000 : w.def.storm ? 7000 : w.def.summon ? 9000 : 6000;
        w.busy = true;
        w.spr.play(this.anim(`${w.tex}_skill`, w.tex, [8, 9, 10, 11], 8, 0)).once('animationcomplete', () => { w.busy = false; if (w.spr.active) w.spr.play(`${w.tex}_walk`); });
        if (w.id === 'howler') for (const o of this.wolves) if (Math.abs(o.lane - w.lane) <= 1 && Math.abs(o.j - w.j) < 2.5) o.buffUntil = this.t + 3500;
        if (w.id === 'alpha') for (const u of this.units) if (Math.abs(u.lane - w.lane) <= 1 && Math.abs(u.col + 0.5 - w.j) < 2.5) u.stunUntil = this.t + 2200;
        if (w.def.heal) {
          this.burst(w.spr.x, w.spr.y - 40, 0x7aff9a, 16, 110, 600);
          for (const o of this.wolves) if (!o.dead && o !== w && Math.abs(o.lane - w.lane) <= 1 && Math.abs(o.j - w.j) < 2.2) {
            o.hp = Math.min(o.def.hp, o.hp + 40);
            this.burst(o.spr.x, o.spr.y - 30, 0x7aff9a, 5, 60, 400);
          }
        }
        if (w.def.storm) {
          const near = this.units.filter(u => Math.abs(u.lane - w.lane) <= 1);
          const u = Phaser.Utils.Array.GetRandom(near);
          if (u) this.lightning(u.lane, u.col, 0, 60);
        }
        if (w.def.summon) this.summonPups(w);
        continue;
      }
      // Blocked by a defender? (fliers go over everyone; mines don't block)
      const blocker = w.def.fly ? undefined : this.units.find(u => u.def.kind !== 'mine' && u.lane === w.lane && w.j > u.col + 0.5 && w.j - (u.col + 0.5) < 0.75);
      if (blocker) {
        if ((w.id === 'leaper' || w.def.dig) && !w.jumped) {
          w.jumped = true; w.busy = true;
          if (w.def.dig) {
            // Digger: vanishes into the ground and comes out behind the first defender.
            w.hidden = true;
            this.burst(w.spr.x, w.spr.y - 6, 0x8a6a4a, 14, 90, 500);
            this.tweens.add({ targets: w.spr, alpha: 0.15, duration: 250 });
            this.tweens.addCounter({ from: w.j, to: blocker.col - 0.45, duration: 1500, onUpdate: tw => { w.j = tw.getValue() ?? w.j; this.placeWolf(w); },
              onComplete: () => { w.busy = false; w.hidden = false; w.spr.setAlpha(1); this.burst(w.spr.x, w.spr.y - 6, 0x8a6a4a, 14, 90, 500); } });
          } else {
            w.spr.play(this.anim(`${w.tex}_jump`, w.tex, [8, 9, 10, 11], 7, 0));
            this.tweens.addCounter({ from: w.j, to: blocker.col - 0.5, duration: 700, onUpdate: tw => { w.j = tw.getValue() ?? w.j; this.placeWolf(w); },
              onComplete: () => { w.busy = false; w.spr.play(`${w.tex}_walk`); } });
          }
          continue;
        }
        w.bite -= dt;
        if (w.bite <= 0) {
          w.bite = 1000;
          this.tweens.add({ targets: w.spr, x: w.spr.x - 8, duration: 90, yoyo: true });
          this.hitUnit(blocker, w.def.dmg);
        }
        continue;
      }
      const water = (this.arena.water ?? []).includes(w.lane) && !w.def.fly ? 0.6 : 1;
      const speed = w.def.speed * 0.85 * (this.t < w.slowUntil ? 0.55 : 1) * (this.t < w.buffUntil ? 1.35 : 1) * water
        * (this.weather === 'fullmoon' ? 1.25 : this.weather === 'snow' ? 0.8 : 1);
      w.j -= speed * s;
      this.placeWolf(w);
      if (w.j <= -0.35) this.grab(w);
    }
    this.wolves = this.wolves.filter(w => !w.dead || w.spr.active);
  }

  private placeWolf(w: Wolf) {
    const c = cellPos(w.lane, w.j);
    const fly = w.def.fly ? -34 + Math.sin(this.t / 180 + w.bob) * 6 : 0;
    w.spr.setPosition(c.x, c.y + fly).setDepth(c.y + (w.def.fly ? 500 : 0));
    if (this.weather === 'fog' && !w.hidden) w.spr.setAlpha(Phaser.Math.Clamp((COLS - 3 - w.j) / 1.5 + 0.1, 0, 1));
  }

  // A wolf reached the fence: it takes someone and runs back to the forest.
  // Last line of defense: the lane's torch burns every wolf in it, once per battle.
  private burnLane(lane: number) {
    this.torches[lane] = false;
    const img = this.torchImgs[lane];
    this.tweens.killTweensOf(img);
    img.setTint(0x3a3a3a).setAlpha(0.5);
    const y = lane * CH + CH * 0.6;
    const fire = this.add.particles(0, 0, 'bt_dot', { x: { min: -20, max: 60 }, y: { min: y - 20, max: y + 10 }, speedX: { min: 700, max: 1000 }, speedY: { min: -60, max: 20 },
      scale: { start: 1.4, end: 0.2 }, lifespan: 1100, tint: [0xff7a1a, 0xffc040, 0xd8122a], quantity: 6, frequency: 16, blendMode: 'ADD' }).setDepth(9.7e5);
    this.time.delayedCall(700, () => fire.stop());
    this.time.delayedCall(1900, () => fire.destroy());
    this.cameras.main.shake(350, 0.008);
    sfx.hitHeavy(); sfx.bong();
    this.toast(L('Aureliano: A tocha da cerca! Essa raia está limpa, mas não teremos outra ali.', 'Aureliano: The fence torch! That lane is clear, but we won\'t get another one there.'));
    for (const o of this.wolves) {
      if (o.dead || o.lane !== lane) continue;
      const kill = () => { o.hidden = false; this.hurt(o, 99999, true); };
      if (o.j < 0.6) kill(); else this.time.delayedCall((o.j + 0.3) * 110, kill); // the fire sweeps the lane from the fence outwards
    }
  }

  private grab(w: Wolf) {
    if (this.torches[w.lane]) { this.burnLane(w.lane); return; }
    w.dead = true;
    if (this.mode !== 'raid') { this.lives--; if (this.lives <= 0) this.time.delayedCall(600, () => this.finish(false)); }
    else this.grabbed++;
    const victim = this.folk.shift();
    if (victim) {
      const fear = this.add.sprite(victim.x, victim.y - 50, 'fx_fear', 0).setScale(S).setDepth(9e5);
      fear.play(this.anim('fear', 'fx_fear', [0, 1, 2, 3], 8, 0)).once('animationcomplete', () => fear.destroy());
      this.tweens.add({ targets: victim, alpha: 0, duration: 500, onComplete: () => victim.destroy() });
    }
    this.cameras.main.flash(250, 90, 0, 0);
    sfx.bad(); voice('human_f');
    // Only farm raids take farm humans; the Hunt loses volunteers and the Blood Moon is practice.
    this.toast(this.mode === 'raid' ? `${L('Humano', 'Human')}: ${Phaser.Utils.Array.GetRandom(BATTLE_LINES.grab)}`
      : this.mode === 'hunt' ? L('Aureliano: Perdemos um voluntário. Segurem a linha!', 'Aureliano: We lost a volunteer. Hold the line!')
      : L('Aureliano: A cerca cedeu. Mais algumas dessas e o treino acaba.', 'Aureliano: The fence gave way. A few more of those and practice is over.'));
    w.spr.setFlipX(false);
    this.tweens.add({ targets: w.spr, alpha: 0, x: w.spr.x + 140, duration: 900, onComplete: () => w.spr.destroy() });
    this.refreshUi();
  }

  // ---------- loop ----------
  update(_time: number, delta: number) {
    if (this.ended) return;
    // Waiting for the player to rotate the phone: the battle doesn't start without them.
    if (this.ui.classList.contains('portrait') && !this.ui.classList.contains('stay')) return;
    const dt = Math.min(delta, 50);
    this.t += dt;
    const raid = this.cfg.raid;
    while (this.spawnIdx < raid.spawns.length && raid.spawns[this.spawnIdx].at <= this.t) {
      const sp = raid.spawns[this.spawnIdx++];
      this.spawn(sp.wolf, Math.min(sp.lane, this.L - 1));
    }
    // The farm keeps collecting while you defend: a slow Blood trickle (the hunt and the Blood Moon get a small stipend).
    this.trickle += dt;
    const every = this.mode !== 'raid' ? 3000 : 2500 / Math.max(1, this.cfg.collectLevel);
    if (this.trickle >= every) { this.trickle -= every; this.blood += 2; this.refreshUi(); }
    this.updateUnits(dt);
    this.updateWolves(dt);
    this.updateHazards(dt);
    this.drawBars();
    this.drawHover();
    this.uiTick -= dt;
    if (this.uiTick <= 0) { this.uiTick = 150; this.refreshUi(); }
    if (this.spawnIdx >= raid.spawns.length && this.wolves.every(w => w.dead)) {
      if (!this.endless) this.finish(true);
      else {
        // Blood Moon: the next, bigger wave; a Blood bonus for surviving.
        this.wave++;
        this.bank += 40 + this.wave * 10;
        raid.spawns.push(...endlessWave(this.wave, this.t + 5000, this.L));
        sfx.bell();
        this.toast(L(`Aureliano: Onda ${this.wave}! +${40 + this.wave * 10} Sangue de reforço.`, `Aureliano: Wave ${this.wave}! +${40 + this.wave * 10} Blood in reinforcements.`));
      }
    }
  }

  private drawBars() {
    // Chalice charge ring: fills up until the next orb. Lanterns pulse.
    const r = this.ring.clear();
    for (const u of this.units) {
      if (u.def.kind === 'gen') {
        const pct = Phaser.Math.Clamp(1 - u.cd / this.rateOf(u), 0, 1);
        const x = u.spr.x, y = u.spr.y - u.spr.displayHeight - 12;
        r.lineStyle(5, 0x2a1016, 0.9).strokeCircle(x, y, 9);
        r.lineStyle(5, 0xff3348, 1).beginPath().arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2).strokePath();
      } else if (u.def.kind === 'aura') {
        const c = cellPos(u.lane, u.col), a = 0.18 + Math.sin(this.t / 300) * 0.08;
        r.lineStyle(3, 0xffa040, a * 2).strokeRect((u.col - 1) * CW + 4, (u.lane - 1) * CH + 4, CW * 3 - 8, CH * 3 - 8);
        r.fillStyle(0xffa040, a * 0.4).fillCircle(c.x, c.y - 30, 40);
      }
    }
    const g = this.bars.clear();
    for (const w of this.wolves) {
      if (w.dead || w.hp >= w.def.hp || !this.seen(w)) continue;
      const wd = w.def.boss ? 70 : 32, x = w.spr.x - wd / 2, y = w.spr.y - w.spr.displayHeight - 6;
      g.fillStyle(0x140a10, 0.9).fillRect(x - 1, y - 1, wd + 2, 6).fillStyle(w.def.boss ? 0xff7a1a : 0xd8122a, 1).fillRect(x, y, wd * Math.max(0, w.hp / w.def.hp), 4);
    }
    for (const u of this.units) {
      if (u.hp >= u.def.hp || u.def.kind === 'mine') continue;
      const x = u.spr.x - 16, y = u.spr.y - u.spr.displayHeight - 6;
      g.fillStyle(0x140a10, 0.9).fillRect(x - 1, y - 1, 34, 6).fillStyle(0x6fbf73, 1).fillRect(x, y, 32 * Math.max(0, u.hp / u.def.hp), 4);
    }
  }

  // Selected card: free cells, the aimed cell (green = ok, red = no) and a ghost of the unit.
  private drawHover() {
    const g = this.hover.clear();
    if (!this.armed) { this.ghost?.setVisible(false); return; }
    if (this.selected && !UNITS[this.selected].spell) {
      g.lineStyle(2, 0xe8b54a, 0.35);
      for (let i = 0; i < this.L; i++) for (let j = 0; j < COLS; j++) if (this.cellFree(i, j)) g.strokeRect(j * CW + 3, i * CH + 3, CW - 6, CH - 6);
    }
    const a = this.aim;
    if (!a) { this.ghost?.setVisible(false); return; }
    const ok = this.canPlace(a.lane, a.col), col = ok ? 0x6fe07a : 0xff4a5a;
    const area = this.spell === 'rain' ? { x: 0, y: a.lane * CH, w: COLS * CW, h: CH }
      : this.spell === 'mist' ? { x: 0, y: 0, w: COLS * CW, h: this.L * CH }
      : this.spell === 'drain' || this.selected === 'bats' ? { x: (a.col - 1) * CW, y: (a.lane - 1) * CH, w: CW * 3, h: CH * 3 }
      : { x: a.col * CW, y: a.lane * CH, w: CW, h: CH };
    g.fillStyle(col, 0.18).fillRect(area.x, area.y, area.w, area.h).lineStyle(3, col, 0.9).strokeRect(area.x + 2, area.y + 2, area.w - 4, area.h - 4);
    if (this.selected && !UNITS[this.selected].spell) {
      const def = UNITS[this.selected], c = cellPos(a.lane, a.col), tex = this.texFor(def);
      g.fillStyle(col, 0.06).fillRect(0, a.lane * CH, COLS * CW, CH);
      // Reach of ranged units, so it's clear what they'll cover.
      if (def.range) g.fillStyle(col, 0.1).fillRect((a.col + 1) * CW, a.lane * CH, CW * def.range, CH);
      if (def.kind === 'aura') g.lineStyle(2, 0xffa040, 0.7).strokeRect((a.col - 1) * CW + 4, (a.lane - 1) * CH + 4, CW * 3 - 8, CH * 3 - 8);
      if (!this.ghost) this.ghost = this.add.sprite(0, 0, tex, 0).setOrigin(0.5, 1).setDepth(9.7e5);
      if (this.ghost.texture.key !== tex) this.ghost.setTexture(tex, 0);
      this.ghost.setFrame(this.framesFor(def).idle[0]).setScale(US * (def.scale ?? 1)).setPosition(c.x, c.y).setAlpha(ok ? 0.7 : 0.35).setTint(ok ? this.tintFor(def) ?? 0xffffff : 0xff6070).setVisible(true);
    } else this.ghost?.setVisible(false);
  }

  private finish(won: boolean, retreated = false) {
    if (this.ended) return;
    this.ended = true;
    // Retreating a farm raid: every wolf still in the field takes someone (capped). Other modes never take farm humans.
    if (retreated && this.mode === 'raid') this.grabbed += Math.min(3, this.wolves.filter(w => !w.dead).length + (this.cfg.raid.spawns.length - this.spawnIdx > 0 ? 1 : 0));
    const waves = this.endless ? this.wave - 1 : 0;
    // Stars (3 = nobody taken) become hunt marks for the Arsenal. Full moon pays double.
    // The row shows how well you did (3 = nobody taken); the full moon doubles the marks paid, not the rating.
    const rating = this.endless ? Math.min(3, Math.floor(waves / 3)) : this.mode === 'hunt' ? 0 : won ? (this.grabbed === 0 ? 3 : this.grabbed <= 1 ? 2 : 1) : 0;
    const stars = this.weather === 'fullmoon' && this.mode === 'raid' ? rating * 2 : rating;
    meta.marks = (meta.marks ?? 0) + stars;
    if (this.endless && waves > (meta.bestWave ?? 0)) meta.bestWave = waves;
    saveMeta();
    const res = this.ui.querySelector('.res')!;
    const shown = rating;
    const starRow = this.mode === 'hunt' ? '' : `<div style="font-size:30px;letter-spacing:6px;color:#f6d9a0;text-shadow:0 0 10px #a07818">${'★'.repeat(shown)}<span style="color:#4a3a38">${'★'.repeat(3 - shown)}</span></div>`;
    res.querySelector('h3')!.innerHTML = (this.endless ? L(`Lua de Sangue: ${waves} onda${waves === 1 ? '' : 's'}`, `Blood Moon: ${waves} wave${waves === 1 ? '' : 's'}`)
      : this.mode === 'hunt' ? (won ? L('Vitória na Caçada!', 'Hunt victory!') : L('A Caçada termina aqui', 'The Hunt ends here'))
      : this.bossKilled && this.cfg.alphaName ? L(`${this.cfg.alphaName} caiu!`, `${this.cfg.alphaName} has fallen!`)
      : won && this.grabbed === 0 ? L('Vitória!', 'Victory!') : won ? L('Ataque repelido', 'Attack repelled') : L('Recuada', 'Retreat')) + starRow;
    res.querySelector('.rt')!.textContent = this.endless
      ? L(`${this.kills} lobisomens derrotados · recorde: ${meta.bestWave} ondas · +${stars} marca${stars === 1 ? '' : 's'} de caça. Aureliano: ${waves >= 5 ? 'Isso foi quase elegante.' : 'Voltem amanhã. Eles voltam.'}`,
        `${this.kills} werewolves defeated · record: ${meta.bestWave} waves · +${stars} hunt mark${stars === 1 ? '' : 's'}. Aureliano: ${waves >= 5 ? 'That was almost elegant.' : 'Come back tomorrow. They will.'}`)
      : this.mode === 'hunt' ? L(`${this.kills} lobisomens derrotados · ${this.lives} voluntário${this.lives === 1 ? '' : 's'} restante${this.lives === 1 ? '' : 's'}.`, `${this.kills} werewolves defeated · ${this.lives} volunteer${this.lives === 1 ? '' : 's'} left.`)
      : L(`${this.kills} lobisomens derrotados · ${this.grabbed} humano${this.grabbed === 1 ? '' : 's'} levado${this.grabbed === 1 ? '' : 's'} · ` +
        `${this.spent} de Sangue gasto · +${stars} marca${stars === 1 ? '' : 's'} de caça${this.weather === 'fullmoon' ? ' (Lua Cheia: em dobro)' : ''}.`,
        `${this.kills} werewolves defeated · ${this.grabbed} human${this.grabbed === 1 ? '' : 's'} taken · ` +
        `${this.spent} Blood spent · +${stars} hunt mark${stars === 1 ? '' : 's'}${this.weather === 'fullmoon' ? ' (Full Moon: doubled)' : ''}.`) + ` ${won && this.grabbed === 0 ? `Aureliano: ${BATTLE_LINES.win}` : `Aureliano: ${BATTLE_LINES.lose}`}`;
    res.classList.add('on');
    if (won) sfx.chime(); else sfx.bad();
    res.querySelector('button')!.onclick = () => {
      this.ui.remove();
      document.body.classList.remove('in-battle');
      this.scale.off('resize', this.fitCamera, this);
      this.scale.off('resize', this.refitLater, this);
      window.removeEventListener('pointermove', this.onCardMove);
      window.removeEventListener('pointerup', this.onCardUp);
      window.removeEventListener('pointercancel', this.onCardCancel);
      window.removeEventListener('keydown', this.onKey);
      this.ghost = undefined;
      this.cfg.onEnd({ bossKilled: this.bossKilled, won, grabbed: this.grabbed, bloodSpent: this.spent, kills: this.kills, retreated, stars, waves, livesLeft: this.lives, weather: this.weather });
    };
  }
}
