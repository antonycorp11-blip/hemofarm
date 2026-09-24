import Phaser from 'phaser';
import { buildBosque, FarmMap, Light, TileKind } from '../map/bosque';
import { tileCenter } from '../map/iso';
import { Humans } from '../world/Humans';
import { Bubbles } from '../world/Bubbles';
import { Hud } from '../ui/Hud';
import { state, load, save, resetSave, NIGHT_MS, CARRIAGE_LEAD_MS } from '../core/state';
import { loadMeta, applyNewGame, applyMods, goalFor, meta, saveMeta, flag } from '../core/meta';
import { REGIONS } from '../data/regions';
import { Mandate } from '../ui/Mandate';
import { sfx, unlockAudio, setMute, setMusic, farmMusic, battleMusic } from '../core/sfx';
import { Buildings } from '../world/Buildings';
import { BuildPanel } from '../ui/BuildPanel';
import { Farms } from '../world/Farms';
import { Contracts } from '../world/Contracts';
import { Research } from '../world/Research';
import { LivingWorld } from '../world/LivingWorld';
import { BloodOrbs } from '../world/BloodOrbs';
import { Raids } from '../world/Raids';
import type { Raid } from '../data/battle';
import type { BattleData, BattleResult } from './BattleScene';
import { BLOOD, QUALITY } from '../data/humans';
const BLOOD_NAME = Object.fromEntries(Object.entries(BLOOD).map(([k, v]) => [k, v.name]));
const QUALITY_NAME = Object.fromEntries(Object.entries(QUALITY).map(([k, v]) => [k, v.name]));
import { Dialogue } from '../ui/Dialogue';
import { applySkin } from '../ui/skin';
import { Tutorial } from '../core/tutorial';
import { SHORT, Step, type Line } from '../data/tutorial';
import { slotGeometry } from '../map/bosque';
import { iso } from '../map/iso';
import { Tithe } from '../world/Tithe';
import { bus } from '../core/events';
import { MapEditor, Placed, applyOverrides } from '../editor/MapEditor';
import { Modal, icon } from '../ui/Modal';
import { Orders } from '../world/Orders';
import { Relics } from '../ui/Relics';
import { openAlbum } from '../ui/Album';
import { openArsenal } from '../ui/Arsenal';
import { ARENAS, ArenaId, endlessWave, rollWeather } from '../data/battle';
import { Hunt } from '../ui/Hunt';
import { Conquest } from '../world/Conquest';
import { CHAPTERS } from '../data/story';
import { REGION_ARENA, buildRaid } from '../data/battle';
import { more } from '../core/bonus';
import { Story } from '../world/Story';
import { L } from '../core/i18n';
import { applyUiScale, isDesktop, toggleFullscreen } from '../ui/display';

const S = 0.5; // assets are stored at 2x world scale
const TILE_KEYS: Record<TileKind, string[]> = {
  grass: ['tile_grass_a', 'tile_grass_b'],
  forest: ['tile_forest_floor'],
  cobble: ['tile_cobble_a', 'tile_cobble_b'],
  road: ['tile_dirt_road'],
  soil: ['tile_soil'],
  water: ['tile_water'],
};
const DEPTH = { sky: -3e6, castle: -2.9e6, ground: -2e6, decal: -1.9e6, fog: 1.8e6, glow: 1.9e6, dark: 2e6, fireflies: 2.1e6 };
const NIGHT = { color: 0x050918, alpha: 0.5 };

interface Manifest { [k: string]: any }
// Art for later systems (battle, dialogue, UI) isn't needed by the farm scene: skipping it keeps mobile loading fast.
const NOT_ON_FARM = /^(unit_|hunt_|tombstone_|tile_(swamp|grave|snow|bridge|castle|burnt)|fx_(spells|weather)|portrait_|icon_|blood_(rubra|lunar|ambar|umbra|carmesim)|quality_|wolf_|prop_|temper_|trait_|pin_|fx_(bolt|bomb|bell_wave|fear|vampire_poof|bat_swarm|flask))|^(wave_flag|ghoul_wall|blood_chalice|sentinel_vampire|gargoyle|alchemist_unit|aureliano|vesper|rubelia|hematico|boris|ghoul_guard|human_actions_2|bld_(market|shelter|bell|guard_post|sentinel_tower)|gate_reinforced|palisade_broken_(ne|nw)|rubble)$/;
export interface Glow { core: Phaser.GameObjects.Image; pool: Phaser.GameObjects.Image; light: Light; phase: number }

export class FarmScene extends Phaser.Scene {
  private map!: FarmMap;
  private glows: Glow[] = [];
  private placed: Placed[] = [];
  editor!: MapEditor;
  private dark?: Phaser.GameObjects.RenderTexture;
  private eraser!: Phaser.GameObjects.Image;
  private humans!: Humans;
  private bubbles!: Bubbles;
  private hud!: Hud;
  private tithe!: Tithe;
  private buildings!: Buildings;
  private farms!: Farms;
  private contracts!: Contracts;
  private research!: Research;
  private world!: LivingWorld;
  private orbs!: BloodOrbs;
  private raids!: Raids;
  private mandate!: Mandate;
  private modal!: Modal;
  private orders!: Orders;
  private relics!: Relics;
  private hunt!: Hunt;
  private conquest!: Conquest;
  private story!: Story;
  private paused = false;
  private held = new Set<string>();
  private dialogue!: Dialogue;
  private secTick = 0;
  private speed = 1;
  private tutorial!: Tutorial;
  private hintObjs: Phaser.GameObjects.GameObject[] = [];
  private pinchDist = 0;
  private touches = new Map<number, { x: number; y: number }>();
  private vel = { x: 0, y: 0 };
  private lastMoveAt = 0;
  private sky!: Phaser.GameObjects.Image;

  constructor() { super('Farm'); }

  preload() {
    const fill = document.querySelector<HTMLElement>('#loading .fill');
    this.load.on('progress', (v: number) => { if (fill) fill.style.width = `${Math.round(v * 100)}%`; });
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', (_k: string, _t: string, m: Manifest) => {
      for (const k of Object.keys(m)) {
        if (k.startsWith('_') || k === 'backdrop_sky' || m[k].ui || m[k].jpg || NOT_ON_FARM.test(k)) continue;
        if (m[k].frameW) this.load.spritesheet(k, `assets/${k}.webp`, { frameWidth: m[k].frameW, frameHeight: m[k].frameH });
        else this.load.image(k, `assets/${k}.webp`);
      }
      this.load.image('backdrop_sky', 'assets/backdrop_sky.jpg');
    });
  }

  create() {
    const manifest = this.cache.json.get('manifest') as Manifest;
    this.map = applyOverrides(buildBosque());
    // Run save + meta first: the region tints the ground and the Vampire House changes the starting farm.
    load();
    loadMeta();
    const startHumans = state.loaded ? 0 : applyNewGame();
    applyMods();
    this.glowTexture();
    this.buildBackdrop();
    this.buildGround(manifest._decals);
    this.buildObjects();
    this.buildLighting();
    this.buildAmbience();
    this.setupHud();
    this.editor = new MapEditor(this, this.placed, this.glows);
    const panel = new BuildPanel();
    this.buildings = new Buildings(this, this.map, this.hud, panel, () => this.editor.isActive);
    this.bubbles = new Bubbles(this);
    this.farms = new Farms(this, this.map, this.hud, panel, () => this.editor.isActive);
    this.humans = new Humans(this, this.map, this.bubbles, this.buildings, this.farms);
    this.humans.spawn(startHumans, state.loaded?.humans);
    this.contracts = new Contracts(this, this.map, this.humans, this.buildings, panel, this.hud);
    this.buildings.onBoarding = () => this.contracts.openBoard();
    this.research = new Research(this.hud, () => this.buildings.level('lab') > 0);
    this.modal = new Modal();
    this.orders = new Orders(this.hud, this.modal, kind => this.buildings.built(kind as never).length > 0);
    // Relic offers get their own overlay: a shared one could be replaced by another window and leave the farm paused forever.
    this.relics = new Relics(new Modal(), p => (p ? this.scene.pause() : this.scene.resume()));
    this.hunt = new Hunt(this.modal, {
      battle: (data, done) => this.startBattle(data.raid, done, data),
      pause: p => (p ? this.scene.pause() : this.scene.resume()),
      toast: (m, k) => this.hud.toast(m, k),
      hasArt: k => !!(this.cache.json.get('manifest') as Record<string, unknown>)[k],
    });
    this.buildings.onLab = () => this.research.open();
    this.world = new LivingWorld(this.humans, this.buildings, panel, this.hud, tileCenter(21, 36));
    this.orbs = new BloodOrbs(this, this.map, this.buildings);
    this.buildings.extras = kind => this.world.extras(kind);
    this.raids = new Raids(this.humans, this.buildings, this.hud, (raid, done) => this.startBattle(raid, done));
    this.mandate = new Mandate();
    this.dialogue = new Dialogue();
    this.conquest = new Conquest(this, this.humans, this.hud, this.modal, {
      say: (lines, done) => this.storySay(lines, done),
      fx: (k, x, y, sc) => this.fx(k, x, y, sc),
      bossFight: () => this.bossFight(),
      conquer: () => { this.conquest.recordDomain(); this.mandate.end(true, this.humans.population, undefined, L(`${REGIONS[state.region].name} conquistado!`, `${REGIONS[state.region].name} conquered!`), 40); },
      abandon: () => this.mandate.end(true, this.humans.population, () => undefined, L('Mandato encerrado', 'Mandate ended')),
      finale: () => this.story.finale(),
    }, tileCenter(20, 31));
    this.story = new Story(this.hud, this.modal, {
      say: (lines, done) => this.storySay(lines, done),
    });
    this.contracts.crownHook = { can: h => this.conquest.canCrown(h), crown: h => this.conquest.crown(h) };
    this.setupMandate();
    this.setupSounds();
    this.offlineSummary();
    this.tithe = new Tithe(this, this.humans, this.hud);
    if (import.meta.env.DEV) {
      // Dev shortcut: jump to just before the carriage arrives.
      this.input.keyboard?.on('keydown-N', () => { state.night.elapsed = NIGHT_MS - CARRIAGE_LEAD_MS - 3000; });
    }
    this.setupFeedback();
    this.setupCamera();
    this.scale.on('resize', () => this.onResize());
    this.setupTutorial();
    this.setupKeyboard();
    applySkin(); // after every UI module injected its base styles, so the art frames win
    applyUiScale(meta.uiScale ?? 0);
    // Title screen stays until the player taps "Jogar" (also a natural moment to unlock audio later).
    const loading = document.getElementById('loading');
    // Let the farm show itself first; on the very first launch Aunt Leonor's letter comes before anyone speaks.
    const begin = () => { this.time.delayedCall(1200, () => this.story.letter(() => this.tutorial.start())); this.relics.resume(); this.showReport(); };
    if (loading) {
      loading.classList.add('ready');
      this.scene.pause(); // night clock and simulation wait for the player
      loading.querySelector<HTMLButtonElement>('.play')!.onclick = () => {
        unlockAudio();
        farmMusic();
        loading.style.opacity = '0';
        setTimeout(() => loading.remove(), 500);
        this.scene.resume();
        begin();
      };
    } else begin();
  }

  // ---------- world ----------
  private buildBackdrop() {
    this.sky = this.add.image(0, 0, 'backdrop_sky').setScrollFactor(0).setDepth(DEPTH.sky);
    this.add.image(1250, 330, 'castle_cliff').setOrigin(0.5, 1).setScrollFactor(0.6).setDepth(DEPTH.castle);
  }

  private buildGround(decalKeys: string[]) {
    const rnd = new Phaser.Math.RandomDataGenerator(['ground']);
    // Each region reshapes the wilds around the farm: swamp pools, scorched frontier, crypt ruins, sandy coast...
    const wild: Partial<Record<string, { tile: string; p: number; props: string[]; pp: number }>> = {
      pantano: { tile: 'tile_water', p: 0.4, props: ['dead_tree_a', 'dead_tree_b', 'bush_b'], pp: 0.05 },
      fronteira: { tile: 'tile_dirt_road', p: 0.3, props: ['rock_a', 'rock_b', 'dead_tree_b'], pp: 0.04 },
      vale: { tile: 'tile_grass_b', p: 0.5, props: ['rock_c', 'bush_a'], pp: 0.03 },
      costa: { tile: 'tile_dirt_road', p: 0.35, props: ['barrel', 'crates', 'rock_b'], pp: 0.035 },
      cripta: { tile: 'tile_cobble_b', p: 0.35, props: ['rock_a', 'rock_c', 'dead_tree_a'], pp: 0.05 },
    };
    const w = wild[state.region];
    const prnd = new Phaser.Math.RandomDataGenerator([`wild${state.region}`]);
    for (const t of this.map.tiles) {
      const c = tileCenter(t.i, t.j);
      const swap = w && t.kind === 'forest' && prnd.frac() < w.p && this.textures.exists(w.tile);
      this.add.image(c.x, c.y, swap ? w!.tile : rnd.pick(TILE_KEYS[t.kind]))
        .setScale(S * 1.03).setFlipX(rnd.frac() < 0.5).setDepth(DEPTH.ground + c.y * 0.001).setTint(REGIONS[state.region]?.tint ?? 0xffffff);
      if (w && t.kind === 'forest' && !swap && prnd.frac() < w.pp) {
        const k = prnd.pick(w.props);
        if (this.textures.exists(k)) this.add.image(c.x, c.y + 6, k).setOrigin(0.5, 1).setScale(S * prnd.realInRange(0.8, 1.1)).setDepth(c.y).setTint(REGIONS[state.region]?.tint ?? 0xffffff);
      }
    }
    for (const d of this.map.decals) {
      this.add.image(d.x, d.y, rnd.pick(decalKeys)).setScale(S).setFlipX(!!d.flipX).setDepth(DEPTH.decal);
    }
  }

  private buildObjects() {
    for (const o of this.map.objects) {
      const img = this.add.image(o.x, o.y, o.key).setOrigin(0.5, 1).setScale(S * (o.scale ?? 1)).setFlipX(!!o.flipX).setDepth(o.depth);
      this.placed.push({ img, obj: o });
    }
  }

  // ---------- light ----------
  // Pre-colored radial gradients: tint is not supported by the canvas renderer.
  private glowTexture(color = 0xffffff) {
    const key = `glow_${color.toString(16)}`;
    if (this.textures.exists(key)) return key;
    const size = 256, tex = this.textures.createCanvas(key, size, size)!;
    const ctx = tex.getContext();
    const [r, g, b] = [color >> 16, (color >> 8) & 255, color & 255];
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.15)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
    tex.refresh();
    return key;
  }

  private buildLighting() {
    for (const light of this.map.lights) this.addLight(light);
    // Night overlay with light holes needs WebGL; canvas fallback relies on the night-painted assets.
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    this.dark = this.add.renderTexture(0, 0, this.scale.width, this.scale.height)
      .setScrollFactor(0).setDepth(DEPTH.dark);
    this.eraser = this.make.image({ key: 'glow_ffffff', add: false });
  }

  addLight(light: Light) {
    const tex = this.glowTexture(light.color);
    const pool = this.add.image(0, 0, tex).setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.3 * light.intensity).setDepth(DEPTH.glow - 1);
    const core = this.add.image(0, 0, tex).setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.8 * light.intensity).setDepth(DEPTH.glow);
    const g = { core, pool, light, phase: Math.random() * 10 };
    this.placeGlow(g);
    this.glows.push(g);
  }

  // Small bright halo at the flame + a flattened pool of light on the ground (iso ellipse).
  placeGlow(g: Glow) {
    g.core.setPosition(g.light.x, g.light.y - g.light.h);
    g.pool.setPosition(g.light.x, g.light.y);
  }

  private updateLighting(time: number) {
    const cam = this.cameras.main, view = cam.worldView, z = cam.zoom;
    const dark = this.dark;
    const look = CHAPTERS[state.region]?.look;
    dark?.clear().fill(look?.night ?? NIGHT.color, look?.nightAlpha ?? NIGHT.alpha);
    for (const g of this.glows) {
      const { light } = g;
      const f = 1 + Math.sin(time * 0.012 + g.phase) * light.flicker + Math.sin(time * 0.031 + g.phase * 2) * light.flicker * 0.5;
      const r = light.radius / 128;
      g.core.setScale(r * 0.3 * f);
      g.pool.setScale(r * (1 + (f - 1) * 0.5), r * 0.5 * (1 + (f - 1) * 0.5));
      if (!dark) continue;
      const m = light.radius * 1.3;
      if (light.x + m < view.x || light.x - m > view.right || light.y + m < view.y || light.y - light.h - m > view.bottom) continue;
      this.eraser.setPosition((light.x - view.x) * z, (light.y - view.y) * z)
        .setScale(r * 1.25 * z * f, r * 0.7 * z * f).setAlpha(Math.min(1, 0.85 * light.intensity));
      dark.erase(this.eraser);
      this.eraser.setPosition((light.x - view.x) * z, (light.y - light.h - view.y) * z)
        .setScale(r * 0.45 * z * f).setAlpha(0.7);
      dark.erase(this.eraser);
    }
  }

  private buildAmbience() {
    // fireflies over the property and forest edge
    const look = CHAPTERS[state.region]?.look ?? CHAPTERS.bosque.look; // each region has its own air
    this.add.particles(0, 0, this.glowTexture(look.motes), {
      x: { min: -1500, max: 1500 }, y: { min: 700, max: 2200 },
      lifespan: { min: 3000, max: 6000 }, speed: { min: 4, max: 18 },
      scale: { start: 0.05, end: 0.01 }, alpha: { start: 0, end: 1, ease: (t: number) => Math.sin(t * Math.PI) },
      blendMode: 'ADD', frequency: 90, quantity: 1,
    }).setDepth(DEPTH.fireflies);
    // slow drifting fog banks
    for (let k = 0; k < 14; k++) {
      const x = Phaser.Math.Between(-2200, 2200), y = Phaser.Math.Between(200, 2800);
      const fog = this.add.image(x, y, this.glowTexture(look.fog)).setScale(Phaser.Math.FloatBetween(5, 9), Phaser.Math.FloatBetween(1.6, 2.6))
        .setAlpha(Phaser.Math.FloatBetween(0.04, 0.08)).setDepth(DEPTH.fog);
      this.tweens.add({ targets: fog, x: x + Phaser.Math.Between(250, 500), duration: Phaser.Math.Between(25000, 45000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // Timers, tweens and animations follow the game speed too, so walking and working speed up together.
  // Pause (Space on PC, or the speed button's long press) freezes all of it; the camera still moves.
  private setSpeed(v: number, paused = false) {
    this.speed = v;
    this.paused = paused;
    const t = paused ? 0 : v;
    this.time.timeScale = t;
    this.tweens.timeScale = t;
    this.anims.globalTimeScale = t;
    this.hud.setSpeed(v, paused);
  }

  // ---------- PC: keyboard ----------
  // WASD/arrows pan, +/− zoom, 1–3 speed, Space pause, letters open the panels. DOM listener so it also works
  // while an HTML panel has focus; ignored during battles and while a blocking window (letter, ending) is open.
  private setupKeyboard() {
    const overlay = () => document.querySelector('.mdl.on, .hmenu.on, .bpanel.on, .rtree.on');
    const blocking = () => !!document.querySelector('.mdl.on') && !document.querySelector('.mdl.on .x');
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('keyup', e => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('keydown', e => {
      if (document.body.classList.contains('in-battle') || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (!overlay()) { this.held.add(k); e.preventDefault(); }
        return;
      }
      if (k === 'escape') {
        if (this.hud.menuOpen) this.hud.closeMenu();
        else if (document.querySelector('.mdl.on')) { if (!blocking()) document.querySelector<HTMLButtonElement>('.mdl.on .x')?.click(); }
        else if (!overlay()) this.hud.toggleMenu();
        return; // panels and the research tree close themselves on Escape
      }
      if (blocking() || this.dialogue.open && k === ' ') return; // Space advances dialogue lines
      const cam = this.cameras.main;
      const act: Record<string, () => void> = {
        ' ': () => { this.setSpeed(this.speed, !this.paused); this.hud.toast(this.paused ? L('⏸ Pausado. Espaço continua.', '⏸ Paused. Space resumes.') : L('▶ Continuando.', '▶ Resuming.'), '', 1500); },
        '1': () => this.setSpeed(1), '2': () => this.setSpeed(2), '3': () => this.setSpeed(3),
        '+': () => this.zoomAt(cam.zoom * 1.15, this.scale.width / 2, this.scale.height / 2),
        '=': () => this.zoomAt(cam.zoom * 1.15, this.scale.width / 2, this.scale.height / 2),
        '-': () => this.zoomAt(cam.zoom / 1.15, this.scale.width / 2, this.scale.height / 2),
        c: () => this.contracts.openBoard(), r: () => this.research.open(), o: () => this.orders.open(), t: () => this.world.openTension(),
        j: () => this.story.openDiary(), m: () => this.mandate.map(false, state.region), f: () => toggleFullscreen(),
        k: () => { if (state.tutorial.done) this.conquest.open(); },
      };
      const fn = act[k];
      if (!fn) return;
      e.preventDefault();
      if (this.hud.menuOpen) this.hud.closeMenu();
      fn();
    });
  }

  private updateKeys(delta: number) {
    if (!this.held.size) return;
    const h = this.held, cam = this.cameras.main, v = 0.9 * delta / cam.zoom;
    const x = (h.has('d') || h.has('arrowright') ? 1 : 0) - (h.has('a') || h.has('arrowleft') ? 1 : 0);
    const y = (h.has('s') || h.has('arrowdown') ? 1 : 0) - (h.has('w') || h.has('arrowup') ? 1 : 0);
    cam.scrollX += x * v; cam.scrollY += y * v;
  }

  // ---------- mandates (GDD_ADENDO A5) ----------
  private setupMandate() {
    bus.on('MANDATE_REVOKED', () => this.time.delayedCall(3500, () => this.mandate.end(false, this.humans.population)));
  }

  // Reaching the region's Prestige goal unlocks Ascension (the run can go on if the player prefers).
  // The crown (Domain panel) is always there after the tutorial; it glows when something is waiting in it.
  private checkAscension() {
    this.hud.setAscend(state.tutorial.done, this.conquest.ready || this.conquest.bossReady);
  }

  // The region's alpha: a big raid on the region's ground with the boss in the middle of it.
  private bossFight() {
    const ch = CHAPTERS[state.region] ?? CHAPTERS.bosque;
    const arena = REGION_ARENA[state.region] ?? 'farm', lanes = ARENAS[arena].lanes;
    const raid = buildRaid(state.night.night + 2, true, false, 0, lanes);
    // Consequences (GDD_ADENDO A10): Leonor's island map shows where the Captain anchors; every caravan paid to the
    // Crypt fed the Elders, and the Pack Mother comes to stop them the harder for it.
    let bossHp = 1, why = '';
    if (state.region === 'costa' && flag('cellarOpened')) {
      bossHp = 0.75;
      why = L('Mercador: Com o mapa da sua tia, sei onde o Capitão ancora. Ele vai chegar cansado.', 'Merchant: With your aunt\'s map, I know where the Captain anchors. He\'ll arrive tired.');
    }
    if (ch.boss.wolf === 'mother') {
      bossHp = Phaser.Math.Clamp(1 + 0.15 * flag('caravanPaid') - 0.1 * flag('caravanRefused'), 0.7, 1.6);
      if (bossHp > 1) why = L(`Hemático: Os Anciãos se mexem. Cada caravana que você pagou deixou a Mãe da Matilha mais desesperada. E mais forte.`, `Hematic: The Elders are stirring. Every caravan you paid made the Pack Mother more desperate. And stronger.`);
      else if (bossHp < 1) why = L('Hemático: Os Anciãos estão famintos e fracos. A Mãe da Matilha também sabe disso. Ela vem sem pressa.', 'Hematic: The Elders are hungry and weak. The Pack Mother knows it too. She comes unhurried.');
    }
    raid.spawns = raid.spawns.filter(sp => sp.wolf !== 'alpha' && sp.wolf !== 'mother'); // only the region's boss leads this one
    raid.spawns.push({ at: raid.waves[1] ?? 40000, wolf: ch.boss.wolf, lane: Math.floor(lanes / 2) });
    raid.spawns.sort((a, b) => a.at - b.at);
    this.startBattle(raid, res => {
      const lost = this.humans.takeByRaid(res.grabbed);
      if (lost.length) this.hud.toast(L(`Os lobisomens levaram ${lost.join(', ')}.`, `The werewolves took ${lost.join(', ')}.`), 'bad', 7000);
      this.conquest.bossResult(!!res.bossKilled);
    }, { arena, weather: 'fullmoon', title: ch.boss.name, bossHp, notes: [ch.boss.taunt, ...(why ? [why] : [])] });
  }


  private setupSounds() {
    bus.on('BLOOD_COLLECTED', () => sfx.drop());
    bus.on('TITHE_PAID', () => { sfx.bell(); sfx.coin(); });
    bus.on('TITHE_FAILED', () => sfx.bad());
    bus.on('CARRIAGE_ARRIVED', () => sfx.bell());
    bus.on('BUILDING_BUILT', () => sfx.build());
    bus.on('BUILDING_UPGRADED', () => sfx.build());
    bus.on('RAID_WARNING', () => sfx.howl());
    bus.on('CONTRACT_COMPLETED', () => sfx.coin());
    bus.on('HEIR_ARRIVED', () => sfx.chime());
    bus.on('RESEARCH_DONE', () => sfx.chime());
    bus.on('CROP_HARVESTED', () => sfx.chop());
    bus.on('CROP_PLANTED', () => sfx.pluck());
    bus.on('HUMAN_TAKEN', () => sfx.bad());
    bus.on('ORB_TAPPED', () => sfx.coin());
    bus.on('UPGRADE_BOUGHT', () => sfx.build());
    bus.on('ORDER_DONE', () => sfx.bong());
    bus.on('LINEAGE_DISCOVERED', () => sfx.chime());
    bus.on('CONTRACT_ACCEPTED', () => sfx.page());
    bus.on('EVENT_RAISED', () => sfx.bong());
  }

  // "While you were away…" (GDD §13.1): coarse offline gains, capped at 2 h. The night clock doesn't run offline.
  private report?: { min: number; blood: number; food: number; essence: number; gold: number };

  private offlineSummary() {
    const at = state.loaded?.savedAt;
    if (!at) return;
    const away = Math.min(Date.now() - at, 2 * 3600 * 1000);
    if (away < 60000) return;
    const min = away / 60000;
    const lvl = this.buildings.level('collect');
    const blood = Math.round(Math.min(this.humans.population, 15) * 0.9 * lvl * min * state.mods.blood * more('blood'));
    const plots = Object.values(state.plots).length;
    const food = Math.round(Math.max(0, plots * 12 * min - this.humans.population * 0.35 * min));
    const essence = this.buildings.level('lab') ? Math.round(blood * 0.3 * more('essence')) : 0;
    const gold = Math.round(20 + Math.min(120, min) * 2); // Bóris' "return bonus"
    this.report = { min, blood, food, essence, gold };
  }

  // "While you were away…": Bóris' report with a chest to open (rewards land when it's opened).
  private showReport() {
    const r = this.report;
    if (!r) return;
    this.report = undefined;
    const gains = `<div class="gains"><span>${icon('icon_blood')} +${r.blood} ${L('Sangue', 'Blood')}</span><span>● +${r.food} ${L('Comida', 'Food')}</span>` +
      `${r.essence ? `<span>${icon('icon_research')} +${r.essence} ${L('Essência', 'Essence')}</span>` : ''}<span>${icon('icon_gold')} +${r.gold} ${L('Ouro', 'Gold')}</span></div>`;
    const title = L('Relatório do Bóris', 'Boris\'s Report');
    const box = this.modal.show(`<h2>${title}</h2><div class="sub">${L(`Você esteve fora por ${Math.round(r.min)} min. Ninguém fugiu. Que eu saiba.`, `You were away for ${Math.round(r.min)} min. Nobody ran off. That I know of.`)}</div>
      <button class="chest" aria-label="${L('Abrir baú', 'Open chest')}">🧰</button><div class="sub">${L('Toque no baú', 'Tap the chest')}</div>`, { closable: false });
    box.querySelector<HTMLButtonElement>('.chest')!.onclick = () => {
      const res = state.resources;
      res.blood += r.blood; res.food += r.food; res.essence += r.essence; res.gold += r.gold;
      sfx.coin();
      const b2 = this.modal.show(`<h2>${title}</h2>${gains}<button class="go">${L('Voltar à fazenda', 'Back to the farm')}</button>`);
      b2.querySelector<HTMLButtonElement>('.go')!.onclick = () => this.modal.close();
    };
  }

  // Blood Moon: endless waves in the battle scene; own Blood, nobody from the farm at risk. Rewards once per night.
  private bloodMoon() {
    const arena = Phaser.Utils.Array.GetRandom(Object.keys(ARENAS)) as ArenaId, lanes = ARENAS[arena].lanes;
    const raid = { night: state.night.night, big: false, spawns: endlessWave(1, 6000, lanes), waves: [6000], endless: true, lanes };
    this.startBattle(raid, r => {
      this.bloodMoonDone(r);
    }, { mode: 'endless', arena, weather: rollWeather(false) });
  }

  private bloodMoonDone(r: BattleResult) {
    {
      const paid = state.endlessNight !== state.night.night && r.waves > 0;
      if (paid) {
        state.endlessNight = state.night.night;
        const ess = r.waves * 8;
        state.resources.essence += ess;
        this.hud.toast(L(`Aureliano: ${r.waves} ondas na Lua de Sangue. +${ess} Essência. Recompensa de novo na próxima noite.`, `Aureliano: ${r.waves} waves under the Blood Moon. +${ess} Essence. Another reward next night.`), 'good', 7000);
      } else if (r.waves > 0) this.hud.toast(L('Aureliano: Bom treino. A recompensa da Lua de Sangue já foi paga esta noite.', 'Aureliano: Good practice. Tonight\'s Blood Moon reward was already paid.'));
    }
  }


  // ---------- battle ----------
  // The farm freezes (and hides) while the separate battle scene runs on top of it.
  private startBattle(raid: Raid, done: (r: BattleResult) => void, opts: Partial<BattleData> = {}) {
    this.buildings.closePanel?.();
    this.scene.pause();
    this.scene.setVisible(false);
    battleMusic();
    this.scene.launch('Battle', {
      // Farm raids: a war chest that grows with the farm (collection station + watchtower), separate from the Sangria.
      bank: 130 + 40 * this.buildings.level('collect') + (this.buildings.level('watch') ? 60 : 0),
      ...opts, raid, collectLevel: this.buildings.level('collect'), looks: this.humans.looks,
      onEnd: (r: BattleResult) => {
        this.scene.stop('Battle');
        farmMusic();
        this.scene.setVisible(true);
        this.scene.resume();
        done(r);
      },
    });
  }

  // Story lines wait for any conversation already on screen. Once Davi has left the farm (GDD_ADENDO A10), his lines go too.
  private storySay(lines: Line[], done?: () => void) {
    const left = flag('daviGone') ? lines.filter(l => l.who !== 'davi') : lines;
    if (!left.length) { done?.(); return; }
    const go = () => (this.dialogue.open ? this.time.delayedCall(2500, go) : this.dialogue.say(left, done ?? (() => undefined)));
    go();
  }

  // ---------- tutorial ----------
  private setupTutorial() {
    const dialogue = this.dialogue;
    this.tutorial = new Tutorial({
      say: (lines, done) => dialogue.say(lines, done),
      objective: (text, progress) => this.hud.objective(text, progress),
      hint: (level, step) => {
        if (level === 1 && step.hint) this.hud.toast(`${SHORT[step.hint.who]}: ${step.hint.text}`, '', 7000);
        if (level >= 2) this.pointAt(step, level === 3);
      },
      clearHint: () => { for (const o of this.hintObjs) o.destroy(); this.hintObjs = []; },
      toast: msg => this.hud.toast(msg, 'good', 7000),
    });
  }

  // Adaptive hint in the world: a pulsing ring, then an arrow and a camera pan. Never takes control (GDD §9.1).
  private pointAt(step: Step, arrow: boolean) {
    const t = step.target;
    if (!t) return;
    let pos: { x: number; y: number } | undefined;
    const slot = t.slot && this.map.slots.find(s => s.id === t.slot);
    const pen = t.pen && this.map.pens.find(p => p.id === t.pen);
    if (slot) pos = slotGeometry(slot).center;
    else if (pen) pos = iso((pen.i0 + pen.i1 + 1) / 2, (pen.j0 + pen.j1 + 1) / 2);
    if (!pos) return;
    for (const o of this.hintObjs) o.destroy();
    this.hintObjs = [];
    const ring = this.add.graphics().setDepth(2.05e6).setPosition(pos.x, pos.y);
    ring.lineStyle(4, 0xe8b54a, 0.9).strokeEllipse(0, 0, 200, 100);
    this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    this.hintObjs.push(ring);
    if (!arrow) return;
    const a = this.add.graphics().setDepth(2.05e6).setPosition(pos.x, pos.y - 130).setScale(Math.max(1, 0.6 / this.cameras.main.zoom));
    a.fillStyle(0xe8b54a, 1).lineStyle(3, 0x140a10, 1)
      .fillTriangle(-18, -20, 18, -20, 0, 12).strokeTriangle(-18, -20, 18, -20, 0, 12).fillRect(-6, -48, 12, 30);
    this.tweens.add({ targets: a, y: pos.y - 110, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hintObjs.push(a);
    this.cameras.main.pan(pos.x, pos.y, 900, 'Sine.easeInOut');
  }

  // ---------- persistence & feedback ----------
  private setupHud() {
    let resetting = false;
    const persist = () => { if (!resetting && !(window as unknown as { __hemoResetting?: boolean }).__hemoResetting && this.humans) save(this.humans.export()); };
    this.time.addEvent({ delay: 10000, loop: true, callback: persist });
    window.addEventListener('beforeunload', persist);
    const self = this;
    this.hud = new Hud({
      get population() { return self.humans?.population ?? 0; },
      get avgMorale() { return self.humans?.avgMorale ?? 0; },
      get ordersReady() { return self.orders?.ready ?? 0; },
      get treeReady() { return self.research?.affordable ?? false; },
      get hasLab() { return (self.buildings?.level('lab') ?? 0) > 0; },
      get diaryNew() { return self.story?.unread ?? 0; },
    }, {
      onNewGame: () => { resetting = true; resetSave(); location.reload(); },
      onWipeAll: () => {
        resetting = true;
        (window as unknown as { __hemoResetting?: boolean }).__hemoResetting = true;
        try { for (const k of Object.keys(localStorage)) if (k.startsWith('hemo.') && k !== 'hemo.lang' && k !== 'hemo.wipe') localStorage.removeItem(k); } catch { /* storage blocked */ }
        location.reload();
      },
      onSkipTutorial: () => this.tutorial.skip(),
      tutorialActive: () => !state.tutorial.done,
      onWhere: () => (state.tutorial.done ? this.conquest.open() : this.tutorial.where()),
      onContracts: () => this.contracts.openBoard(),
      onSpeed: () => this.setSpeed(this.paused ? this.speed : this.speed >= 3 ? 1 : this.speed + 1),
      onPayTithe: () => this.tithe.payNow(),
      onMap: () => this.mandate.map(false, state.region),
      onAscend: () => this.conquest.open(),
      onSound: () => setMute(!meta.mute),
      onMusic: () => setMusic(meta.music === false),
      onTension: () => this.world.openTension(),
      onOrders: () => this.orders.open(),
      onTree: () => this.research.open(),
      onRelics: () => this.relics.list(),
      onAlbum: () => openAlbum(this.modal),
      onArsenal: () => openArsenal(this.modal),
      onBloodMoon: () => this.bloodMoon(),
      onHunt: () => this.hunt.open(),
      onDiary: () => this.story.openDiary(),
      onUiScale: v => { meta.uiScale = v; saveMeta(); applyUiScale(v); },
      onFullscreen: () => toggleFullscreen(),
      info: () => ({ goal: goalFor(), region: REGIONS[state.region].name, mute: meta.mute, music: meta.music !== false,
        uiScale: meta.uiScale ?? 0, fullscreen: !!document.fullscreenElement, desktop: isDesktop() }),
    });
  }

  // World feedback for every gain (GDD §15.1): the number rises from where it happened.
  private setupFeedback() {
    const [i, j] = this.humans.collectSpot;
    const c = tileCenter(i, j);
    bus.on('HEIR_ARRIVED', e => this.hud.toast(L(`Lia: Chegou Unidade ${e.code}, parente de ${e.parentNames.join(' e ')}. ${QUALITY_NAME[e.quality] ?? e.quality}, sangue ${BLOOD_NAME[e.blood] ?? e.blood}.`,
      `Lia: Unit ${e.code} arrived, a relative of ${e.parentNames.join(' and ')}. ${QUALITY_NAME[e.quality] ?? e.quality}, ${BLOOD_NAME[e.blood] ?? e.blood} blood.`), 'good', 7000));
    bus.on('HEIR_BLOCKED', () => this.hud.toast(L('Bóris: Um parente quer vir, mas não há camas. Construa ou melhore habitações.', 'Boris: A relative wants to come, but there are no beds. Build or upgrade housing.'), 'bad', 7000));
    bus.on('LINEAGE_DISCOVERED', e => this.hud.toast(L(`Álbum: nova linhagem ${e.name} (${e.total}). +1% de Sangue para sempre.`, `Album: new lineage ${e.name} (${e.total}). +1% Blood forever.`), 'good'));
    bus.on('BOND_FORMED', e => { if (!e.arranged) this.hud.toast(L('Lia: Temos um casal novo na fazenda. Não conte ao Bóris, ele vai querer registrar.', 'Lia: We have a new couple on the farm. Don\'t tell Boris, he\'ll want to file it.')); });
    bus.on('BLOOD_COLLECTED', ({ amount }) => {
      this.floatText(c.x, c.y - 40, L(`+${amount} Sangue`, `+${amount} Blood`), '#ff3348');
      this.fx('fx_blood_drop', c.x + 20, c.y - 70, 1.2);
    });
  }

  // One-shot 4-frame effect from the fx sheets (no-op if the art is missing).
  fx(key: string, x: number, y: number, scale = 1) {
    if (!this.textures.exists(key)) return;
    if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, {}), frameRate: 9 });
    const spr = this.add.sprite(x, y, key).setScale(0.5 * scale).setDepth(2.05e6).play(key);
    spr.once('animationcomplete', () => spr.destroy());
  }

  floatText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, { fontFamily: 'Georgia, serif', fontSize: '28px', color, fontStyle: 'bold', stroke: '#1a0508', strokeThickness: 5 })
      .setOrigin(0.5).setScale(0.5 / this.cameras.main.zoom).setDepth(2.3e6); // constant size on screen
    this.tweens.add({ targets: t, y: y - 40 / this.cameras.main.zoom, alpha: 0, duration: 1600, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------- camera ----------
  private setupCamera() {
    const cam = this.cameras.main, b = this.map.bounds;
    cam.setBounds(b.x, b.y, b.w, b.h).setBackgroundColor('#070b14');
    // Portrait phones start closer (the property is wider than tall), desktops see more of the farm.
    const { width: w, height: h } = this.scale;
    this.clampZoom(Phaser.Math.Clamp(w < h ? w / 800 : w / 1500, 0.3, 0.6));
    cam.centerOn(0, 1350);
    this.input.addPointer(2);

    // Own finger tracking: robust to lost touchend/touchcancel, which can leave Phaser's pointers "stuck down".
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.touches.set(p.id, { x: p.x, y: p.y });
      this.vel.x = this.vel.y = 0;
      this.pinchDist = 0;
    });
    const release = (p: Phaser.Input.Pointer) => {
      this.touches.delete(p.id);
      this.pinchDist = 0;
      if (performance.now() - this.lastMoveAt > 80) this.vel.x = this.vel.y = 0; // finger rested before lifting: no fling
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => this.touches.clear());
    window.addEventListener('blur', () => this.touches.clear());

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const t = this.touches.get(p.id);
      if (!t) return; // mouse hover without a button
      const dx = p.x - t.x, dy = p.y - t.y;
      t.x = p.x; t.y = p.y;
      if (this.editor.dragging) return;
      if (this.touches.size >= 2) {
        const [a, c] = [...this.touches.values()];
        const d = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);
        if (this.pinchDist) this.zoomAt(cam.zoom * d / this.pinchDist, (a.x + c.x) / 2, (a.y + c.y) / 2);
        this.pinchDist = d;
        cam.scrollX -= dx / 2 / cam.zoom; cam.scrollY -= dy / 2 / cam.zoom; // two-finger pan
        return;
      }
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      const now = performance.now(), dt = Math.max(8, now - this.lastMoveAt);
      this.vel.x = Phaser.Math.Linear(this.vel.x, -dx / cam.zoom / dt, 0.5);
      this.vel.y = Phaser.Math.Linear(this.vel.y, -dy / cam.zoom / dt, 0.5);
      this.lastMoveAt = now;
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(cam.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y);
    });
  }

  // Fling: keep gliding after a quick swipe, easing out.
  private updateInertia(delta: number) {
    if (this.touches.size || (Math.abs(this.vel.x) < 0.005 && Math.abs(this.vel.y) < 0.005)) return;
    const cam = this.cameras.main;
    cam.scrollX += this.vel.x * delta;
    cam.scrollY += this.vel.y * delta;
    const k = Math.exp(-delta / 260);
    this.vel.x *= k; this.vel.y *= k;
  }

  private minZoom() {
    const b = this.map.bounds;
    return Math.max(this.scale.width / b.w, this.scale.height / b.h);
  }

  private clampZoom(z: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(z, this.minZoom(), 2));
  }

  private zoomAt(z: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(sx, sy);
    this.clampZoom(z);
    cam.preRender();
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  // Rotation / iOS viewport changes: rebuild the night overlay at the new size. Resizing it in place left a band of
  // the old size on some phones (half the screen darker than the other — the "two filters" bug).
  private onResize() {
    if (this.dark) {
      const w = Math.ceil(this.scale.width), h = Math.ceil(this.scale.height);
      if (this.dark.width !== w || this.dark.height !== h) {
        this.dark.destroy();
        this.dark = this.add.renderTexture(0, 0, w, h).setScrollFactor(0).setDepth(DEPTH.dark);
      }
    }
    this.clampZoom(this.cameras.main.zoom);
    this.pinScreenLayers();
  }

  // Camera zoom also scales scrollFactor(0) objects around the screen center: counter-scale them.
  private pinScreenLayers() {
    const { width: w, height: h } = this.scale, z = this.cameras.main.zoom;
    this.sky.setPosition(w / 2, h / 2).setScale(Math.max(w / this.sky.width, h / this.sky.height) / z);
    this.dark?.setPosition(w / 2, h / 2).setScale(1 / z);
  }

  update(time: number, delta: number) {
    if (this.dark && (this.dark.width !== Math.ceil(this.scale.width) || this.dark.height !== Math.ceil(this.scale.height))) this.onResize(); // missed resize event
    this.pinScreenLayers();
    this.updateInertia(delta);
    this.updateKeys(delta);
    const sim = this.paused ? 0 : delta * this.speed; // ⏩ game speed: the simulation runs faster, the camera doesn't
    this.humans.update(sim);
    this.tithe.update(sim);
    this.buildings.update(sim);
    this.farms.update(sim);
    this.contracts.update();
    this.research.update(sim);
    this.world.update(sim);
    this.conquest.update(delta);
    this.story.update(delta);
    this.orbs.update(sim);
    this.raids.update(sim);
    this.secTick -= delta;
    if (this.secTick <= 0) { this.secTick = 1000; this.checkAscension(); }
    this.tutorial.update(delta);
    this.bubbles.update();
    this.updateLighting(time);
  }
}
