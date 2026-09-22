import Phaser from 'phaser';
import { buildBosque, FarmMap, Light, TileKind } from '../map/bosque';
import { tileCenter } from '../map/iso';
import { Humans } from '../world/Humans';
import { Bubbles } from '../world/Bubbles';
import { Hud } from '../ui/Hud';
import { state, load, save, resetSave, NIGHT_MS, CARRIAGE_LEAD_MS, START_HUMANS } from '../core/state';
import { Buildings } from '../world/Buildings';
import { BuildPanel } from '../ui/BuildPanel';
import { Farms } from '../world/Farms';
import { Dialogue } from '../ui/Dialogue';
import { Tutorial } from '../core/tutorial';
import { SHORT, Step } from '../data/tutorial';
import { slotGeometry } from '../map/bosque';
import { iso } from '../map/iso';
import { Tithe } from '../world/Tithe';
import { bus } from '../core/events';
import { MapEditor, Placed, applyOverrides } from '../editor/MapEditor';

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
const NOT_ON_FARM = /^(portrait_|icon_|blood_|quality_|wolf_|prop_|fx_(bolt|bomb|bell_wave|fear))|^(sentinel_vampire|gargoyle|alchemist_unit|aureliano|vesper|rubelia|hematico|boris|ghoul_guard|human_actions_2|bld_(lab|market|shelter|bell|guard_post|sentinel_tower)|gate_reinforced|palisade_broken_(ne|nw)|rubble)$/;
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
  private tutorial!: Tutorial;
  private hintObjs: Phaser.GameObjects.GameObject[] = [];
  private pinchDist = 0;
  private sky!: Phaser.GameObjects.Image;

  constructor() { super('Farm'); }

  preload() {
    const fill = document.querySelector<HTMLElement>('#loading .fill');
    this.load.on('progress', (v: number) => { if (fill) fill.style.width = `${Math.round(v * 100)}%`; });
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', (_k: string, _t: string, m: Manifest) => {
      for (const k of Object.keys(m)) {
        if (k.startsWith('_') || k === 'backdrop_sky' || NOT_ON_FARM.test(k)) continue;
        if (m[k].frameW) this.load.spritesheet(k, `assets/${k}.webp`, { frameWidth: m[k].frameW, frameHeight: m[k].frameH });
        else this.load.image(k, `assets/${k}.webp`);
      }
      this.load.image('backdrop_sky', 'assets/backdrop_sky.jpg');
    });
  }

  create() {
    const manifest = this.cache.json.get('manifest') as Manifest;
    this.map = applyOverrides(buildBosque());
    this.glowTexture();
    this.buildBackdrop();
    this.buildGround(manifest._decals);
    this.buildObjects();
    this.buildLighting();
    this.buildAmbience();
    load();
    this.setupHud();
    this.editor = new MapEditor(this, this.placed, this.glows);
    const panel = new BuildPanel();
    this.buildings = new Buildings(this, this.map, this.hud, panel, () => this.editor.isActive);
    this.bubbles = new Bubbles(this);
    this.farms = new Farms(this, this.map, this.hud, panel, () => this.editor.isActive);
    this.humans = new Humans(this, this.map, this.bubbles, this.buildings, this.farms);
    this.humans.spawn(state.loaded ? 0 : START_HUMANS, state.loaded?.humans);
    this.tithe = new Tithe(this, this.humans, this.hud);
    if (import.meta.env.DEV) {
      // Dev shortcut: jump to just before the carriage arrives.
      this.input.keyboard?.on('keydown-N', () => { state.night.elapsed = NIGHT_MS - CARRIAGE_LEAD_MS - 3000; });
    }
    this.setupFeedback();
    this.setupCamera();
    this.scale.on('resize', () => this.onResize());
    this.setupTutorial();
    const loading = document.getElementById('loading');
    if (loading) { loading.style.opacity = '0'; setTimeout(() => loading.remove(), 450); }
  }

  // ---------- world ----------
  private buildBackdrop() {
    this.sky = this.add.image(0, 0, 'backdrop_sky').setScrollFactor(0).setDepth(DEPTH.sky);
    this.add.image(1250, 330, 'castle_cliff').setOrigin(0.5, 1).setScrollFactor(0.6).setDepth(DEPTH.castle);
  }

  private buildGround(decalKeys: string[]) {
    const rnd = new Phaser.Math.RandomDataGenerator(['ground']);
    for (const t of this.map.tiles) {
      const c = tileCenter(t.i, t.j);
      this.add.image(c.x, c.y, rnd.pick(TILE_KEYS[t.kind]))
        .setScale(S * 1.03).setFlipX(rnd.frac() < 0.5).setDepth(DEPTH.ground + c.y * 0.001);
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
    dark?.clear().fill(NIGHT.color, NIGHT.alpha);
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
    this.add.particles(0, 0, this.glowTexture(0xd8ff8a), {
      x: { min: -1500, max: 1500 }, y: { min: 700, max: 2200 },
      lifespan: { min: 3000, max: 6000 }, speed: { min: 4, max: 18 },
      scale: { start: 0.05, end: 0.01 }, alpha: { start: 0, end: 1, ease: (t: number) => Math.sin(t * Math.PI) },
      blendMode: 'ADD', frequency: 90, quantity: 1,
    }).setDepth(DEPTH.fireflies);
    // slow drifting fog banks
    for (let k = 0; k < 14; k++) {
      const x = Phaser.Math.Between(-2200, 2200), y = Phaser.Math.Between(200, 2800);
      const fog = this.add.image(x, y, this.glowTexture(0x8ea6d8)).setScale(Phaser.Math.FloatBetween(5, 9), Phaser.Math.FloatBetween(1.6, 2.6))
        .setAlpha(Phaser.Math.FloatBetween(0.04, 0.08)).setDepth(DEPTH.fog);
      this.tweens.add({ targets: fog, x: x + Phaser.Math.Between(250, 500), duration: Phaser.Math.Between(25000, 45000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ---------- tutorial ----------
  private setupTutorial() {
    const dialogue = new Dialogue(() => this.tutorial.skip());
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
    this.time.delayedCall(1200, () => this.tutorial.start()); // let the farm show itself first
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
    const persist = () => { if (!resetting && this.humans) save(this.humans.export()); };
    this.time.addEvent({ delay: 10000, loop: true, callback: persist });
    window.addEventListener('beforeunload', persist);
    const self = this;
    this.hud = new Hud({
      get population() { return self.humans?.population ?? 0; },
      get avgMorale() { return self.humans?.avgMorale ?? 0; },
    }, () => { resetting = true; resetSave(); location.reload(); });
  }

  // World feedback for every gain (GDD §15.1): the number rises from where it happened.
  private setupFeedback() {
    const [i, j] = this.humans.collectSpot;
    const c = tileCenter(i, j);
    bus.on('BLOOD_COLLECTED', ({ amount }) => {
      this.floatText(c.x, c.y - 40, `+${amount} Sangue`, '#ff3348');
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
    // Phones start closer to fit the property's width; desktops see more of the farm.
    this.clampZoom(Phaser.Math.Clamp(this.scale.width / 1500, 0.3, 0.55));
    cam.centerOn(0, 1350);
    this.input.addPointer(1);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const [a, c] = [this.input.pointer1, this.input.pointer2];
      if (a.isDown && c.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);
        if (this.pinchDist) this.zoomAt(cam.zoom * d / this.pinchDist, (a.x + c.x) / 2, (a.y + c.y) / 2);
        this.pinchDist = d;
        return;
      }
      this.pinchDist = 0;
      if (!p.isDown || this.editor.dragging) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('pointerup', () => { this.pinchDist = 0; });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(cam.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y);
    });
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

  private onResize() {
    this.dark?.setSize(this.scale.width, this.scale.height);
    this.clampZoom(this.cameras.main.zoom);
  }

  // Camera zoom also scales scrollFactor(0) objects around the screen center: counter-scale them.
  private pinScreenLayers() {
    const { width: w, height: h } = this.scale, z = this.cameras.main.zoom;
    this.sky.setPosition(w / 2, h / 2).setScale(Math.max(w / this.sky.width, h / this.sky.height) / z);
    this.dark?.setPosition(w / 2, h / 2).setScale(1 / z);
  }

  update(time: number, delta: number) {
    this.pinScreenLayers();
    this.humans.update(delta);
    this.tithe.update(delta);
    this.buildings.update(delta);
    this.farms.update(delta);
    this.tutorial.update(delta);
    this.bubbles.update();
    this.updateLighting(time);
  }
}
