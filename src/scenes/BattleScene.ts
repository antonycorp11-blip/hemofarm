// Battle: "Vampiros vs. Lobisomens" (GDD_ADENDO A6). Separate scene; the farm's real humans wait behind the fence.
// Lanes run along the isometric j axis: wolves come from the forest (bottom-left) up towards the palisade (top-right).
import Phaser from 'phaser';
import { state } from '../core/state';
import { BATTLE_LINES, COLS, LANES, Raid, UNITS, UnitDef, UnitId, WOLVES, WolfDef, WolfId } from '../data/battle';
import { has } from '../data/research';
import { iso } from '../map/iso';

const S = 0.5;
export interface BattleResult { won: boolean; grabbed: number; bloodSpent: number; kills: number; retreated: boolean }
export interface BattleData { raid: Raid; collectLevel: number; looks: string[]; onEnd: (r: BattleResult) => void }

interface Unit { def: UnitDef; id: UnitId; lane: number; col: number; spr: Phaser.GameObjects.Sprite; hp: number; cd: number; stunUntil: number; stoneUntil: number }
interface Wolf { def: WolfDef; id: WolfId; lane: number; j: number; spr: Phaser.GameObjects.Sprite; hp: number; bite: number; slowUntil: number;
  buffUntil: number; jumped: boolean; skill: number; busy: boolean; dead: boolean }

const cellPos = (lane: number, j: number) => iso(lane + 0.5, j + 0.5);

export class BattleScene extends Phaser.Scene {
  private cfg!: BattleData;
  private units: Unit[] = [];
  private wolves: Wolf[] = [];
  private t = 0;
  private spawnIdx = 0;
  private selected?: UnitId;
  private grabbed = 0;
  private spent = 0;
  private kills = 0;
  private trickle = 0;
  private ended = false;
  private folk: Phaser.GameObjects.Sprite[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ui!: HTMLDivElement;

  constructor() { super('Battle'); }

  init(data: BattleData) {
    this.cfg = data;
    Object.assign(this, { units: [], wolves: [], t: 0, spawnIdx: 0, selected: undefined, grabbed: 0, spent: 0, kills: 0, trickle: 0, ended: false, folk: [], wolvesGone: 0 });
  }

  preload() {
    const m = this.cache.json.get('manifest');
    const keys = [...Object.values(UNITS).map(u => u.tex), ...Object.values(WOLVES).map(w => w.tex),
      'fx_bolt', 'fx_flask', 'fx_vampire_poof', 'fx_hit', 'fx_fear', 'wave_flag'];
    for (const k of keys) {
      if (this.textures.exists(k) || !m[k]) continue;
      this.load.spritesheet(k, `assets/${k}.webp`, { frameWidth: m[k].frameW, frameHeight: m[k].frameH });
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a1410');
    this.buildField();
    this.bars = this.add.graphics().setDepth(1e6);
    this.hover = this.add.graphics().setDepth(-1e5);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.buildUi();
    this.toast(`Aureliano: ${BATTLE_LINES.start}`);
  }

  // ---------- field ----------
  private buildField() {
    const rnd = new Phaser.Math.RandomDataGenerator(['battle']);
    for (let i = -2; i <= LANES + 1; i++) for (let j = -3; j <= COLS + 2; j++) {
      const c = iso(i + 0.5, j + 0.5);
      const inField = i >= 0 && i < LANES && j >= 0 && j < COLS;
      const key = j >= COLS + 1 ? 'tile_forest_floor' : inField ? (((i + j) & 1) ? 'tile_grass_a' : 'tile_grass_b') : j < 0 ? 'tile_cobble_a' : 'tile_forest_floor';
      this.add.image(c.x, c.y, key).setScale(S * 1.03).setDepth(-2e5 + c.y * 0.001).setFlipX(rnd.frac() < 0.5)
        .setTint(inField && ((i + j) & 1) ? 0xdde8dd : 0xffffff);
    }
    // Palisade between the field and the farm.
    for (let i = 0; i < LANES; i++) {
      const m = iso(i + 0.5, 0);
      this.add.image(m.x, m.y + 18, 'fence_palisade_nw').setOrigin(0.5, 1).setScale(S).setDepth(m.y);
    }
    // Forest edge where the wolves come from.
    for (let k = 0; k < 18; k++) {
      const c = iso(rnd.between(-2, LANES + 1) + rnd.frac(), COLS + 1.2 + rnd.frac() * 1.5);
      this.add.image(c.x, c.y, rnd.pick(['pine_a', 'pine_b', 'pine_c', 'dead_tree_b'])).setOrigin(0.5, 1).setScale(S * 0.9).setDepth(c.y);
    }
    // The farm's own humans, anxiously watching from behind the fence.
    const looks = this.cfg.looks.slice(0, 7);
    looks.forEach((look, k) => {
      const c = iso(0.3 + k * 0.7, -1.3 - (k % 2) * 0.5);
      const tex = look === 'base' ? 'human_walk_front' : look;
      if (!this.textures.exists(tex)) return;
      const spr = this.add.sprite(c.x, c.y, tex, look === 'base' ? 0 : 8).setOrigin(0.5, 1).setScale(S).setDepth(c.y);
      this.tweens.add({ targets: spr, y: c.y - 2, duration: 300 + k * 40, yoyo: true, repeat: -1 });
      this.folk.push(spr);
    });
    for (const [i, j] of [[-1, -1], [LANES, -1]]) {
      const c = iso(i + 0.5, j + 0.5);
      this.add.image(c.x, c.y + 10, 'torch_stand').setOrigin(0.5, 1).setScale(S).setDepth(c.y);
    }
  }

  private fitCamera() {
    const pts = [iso(-0.5, -2.2), iso(LANES + 0.5, -2.2), iso(-0.5, COLS + 1.5), iso(LANES + 0.5, COLS + 1.5)];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys) + 120;
    const cam = this.cameras.main;
    const uiH = 150;
    cam.setZoom(Math.min(this.scale.width / w, (this.scale.height - uiH) / h));
    cam.centerOn((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2 + uiH / 2 / cam.zoom - 30);
  }

  // ---------- UI (HTML, bottom card bar) ----------
  private unlocked() { return (Object.keys(UNITS) as UnitId[]).filter(id => !UNITS[id].research || has(UNITS[id].research!)); }

  private buildUi() {
    const m = this.cache.json.get('manifest');
    const el = document.createElement('div');
    el.className = 'bt';
    const card = (id: UnitId) => {
      const u = UNITS[id], meta = m[u.tex];
      const frames = meta?.frames ?? 16, f = id === 'bats' ? 4 : id === 'chalice' ? 0 : 8;
      return `<button class="bc" data-u="${id}" title="${u.desc}"><span class="pic" style="background-image:url(assets/${u.tex}.webp);` +
        `background-size:${frames * 100}% 100%;background-position:${(f / (frames - 1)) * 100}% 0"></span>` +
        `<span class="cn">${u.name}</span><span class="cc">${u.cost}</span></button>`;
    };
    el.innerHTML = `<style>
      .bt{position:fixed;left:0;right:0;bottom:0;z-index:9;display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));background:linear-gradient(0deg,#0b0709f2,#0b070900);font:600 13px Georgia,serif;color:#f3e2c8}
      .bt .top{display:flex;gap:10px;align-items:center}
      .bt .wave{display:flex;align-items:center;gap:6px;padding:4px 10px;border:8px solid transparent;border-image:url(assets/frame_tooltip.webp) 18 fill / 8px stretch}
      .bt .wave .bar{width:120px;height:6px;background:#2a1016;border-radius:3px;overflow:hidden}.bt .wave .bar i{display:block;height:100%;background:#d8122a}
      .bt .retreat{padding:6px 12px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:inherit;cursor:pointer}
      .bt .cards{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:2px}
      .bt .bc{position:relative;flex:none;width:68px;height:90px;border:0;background:url(assets/card_unit.webp) center/100% 100% no-repeat;cursor:pointer;padding:0;color:#f3e2c8}
      .bt .bc .pic{position:absolute;left:14px;right:14px;top:10px;height:50px;background-repeat:no-repeat}
      .bt .bc .cn{position:absolute;left:0;right:0;top:60px;font-size:10px;text-align:center}
      .bt .bc .cc{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);font-size:11px;color:#ffd0d4}
      .bt .bc.sel{filter:drop-shadow(0 0 8px #e8b54a);transform:translateY(-4px)}.bt .bc:disabled{filter:grayscale(1) brightness(.6)}
      .bt .res{position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:#000b}
      .bt .res.on{display:flex}.bt .res .box{width:min(340px,calc(100vw - 32px));padding:14px;text-align:center;border:12px solid transparent;
        border-image:url(assets/frame_panel.webp) 22 fill / 12px stretch}.bt .res h3{margin:0 0 6px;color:#f6d9a0;font-size:20px}
      .bt .res button{margin-top:10px;width:100%;min-height:44px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:700 15px Georgia,serif}
      .bt .btoast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);max-width:min(420px,90vw);padding:8px 12px;
        border:8px solid transparent;border-image:url(assets/frame_tooltip.webp) 18 fill / 8px stretch;display:none}
      .bt .btoast.on{display:block}
    </style>
    <div class="top"><div class="wave"><img src="assets/wave_flag.webp" style="height:18px;display:none" alt=""><span class="wl">Ataque</span><div class="bar"><i></i></div></div>
    <button class="retreat">Recuar</button></div>
    <div class="cards">${this.unlocked().map(card).join('')}</div>
    <div class="btoast"></div>
    <div class="res"><div class="box"><h3></h3><p class="rt"></p><button>Voltar à fazenda</button></div></div>`;
    document.body.appendChild(el);
    document.body.classList.add('in-battle');
    this.ui = el;
    el.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.u as UnitId;
      this.selected = this.selected === id ? undefined : id;
      this.refreshUi();
    }));
    el.querySelector<HTMLButtonElement>('.retreat')!.onclick = () => {
      if (confirm('Recuar? Os lobisomens que restarem levam humanos.')) this.finish(false, true);
    };
    this.refreshUi();
  }

  private refreshUi() {
    this.ui.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => {
      const u = UNITS[b.dataset.u as UnitId];
      b.disabled = state.resources.blood < u.cost;
      b.classList.toggle('sel', b.dataset.u === this.selected);
    });
    const total = this.cfg.raid.spawns.length;
    const pct = Math.round(((this.kills + this.wolvesGone) / total) * 100);
    this.ui.querySelector<HTMLElement>('.wave .bar i')!.style.width = `${pct}%`;
    this.ui.querySelector('.wl')!.textContent = `${this.cfg.raid.big ? 'Lua cheia' : 'Ataque'} · ${this.kills}/${total}`;
  }

  private wolvesGone = 0; // escaped with a human

  private toast(msg: string) {
    const t = this.ui?.querySelector<HTMLElement>('.btoast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout((t as any)._h);
    (t as any)._h = setTimeout(() => t.classList.remove('on'), 4200);
  }

  // ---------- input ----------
  private cellAt(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const fi = (w.x / 64 + w.y / 32) / 2, fj = (w.y / 32 - w.x / 64) / 2;
    return { lane: Math.floor(fi), col: Math.floor(fj) };
  }

  private onTap(p: Phaser.Input.Pointer) {
    if (this.ended || !this.selected) return;
    const { lane, col } = this.cellAt(p);
    if (lane < 0 || lane >= LANES || col < 0 || col >= COLS) return;
    const def = UNITS[this.selected];
    if (state.resources.blood < def.cost) { this.toast('Sangue insuficiente. A fazenda continua coletando.'); return; }
    if (def.spell) { this.pay(def.cost); this.castBats(lane, col); this.selected = undefined; this.refreshUi(); return; }
    if (this.units.some(u => u.lane === lane && u.col === col)) return;
    this.pay(def.cost);
    this.place(this.selected, lane, col);
    this.refreshUi();
  }

  private pay(n: number) { state.resources.blood -= n; this.spent += n; }

  // ---------- units ----------
  private anim(key: string, tex: string, frames: number[], rate: number, repeat = -1) {
    if (!this.anims.exists(key) && this.textures.exists(tex)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
    return key;
  }

  private place(id: UnitId, lane: number, col: number) {
    const def = UNITS[id];
    const c = cellPos(lane, col);
    const spr = this.add.sprite(c.x, c.y + 14, def.tex, 0).setOrigin(0.5, 1).setScale(S).setFlipX(true).setDepth(c.y + 14);
    const idle = id === 'chalice' ? this.anim('chalice_idle', def.tex, [0, 1, 2, 3], 5)
      : id === 'wall' ? this.anim('wall_idle', def.tex, [0, 1], 2)
      : id === 'gargoyle' ? this.anim('garg_idle', def.tex, [0, 1, 2, 3], 6)
      : id === 'alchemist' ? this.anim('alch_idle', def.tex, [12, 13], 2)
      : this.anim('sent_idle', def.tex, [8, 9], 2);
    spr.play(idle);
    spr.setScale(S * 0.2);
    this.tweens.add({ targets: spr, scale: S, duration: 250, ease: 'Back.easeOut' });
    this.units.push({ def, id, lane, col, spr, hp: def.hp, cd: def.rate ? def.rate * 0.4 : 0, stunUntil: 0, stoneUntil: 0 });
  }

  private castBats(lane: number, col: number) {
    const c = cellPos(lane, col);
    const fx = this.add.sprite(c.x, c.y - 30, 'fx_bat_swarm', 0).setScale(S * 1.6).setDepth(9e5);
    fx.play(this.anim('bats_fx', 'fx_bat_swarm', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12, 0)).once('animationcomplete', () => fx.destroy());
    this.time.delayedCall(450, () => {
      for (const w of this.wolves) if (!w.dead && Math.abs(w.lane - lane) <= 1 && Math.abs(w.j - (col + 0.5)) <= 1.6) this.hurt(w, UNITS.bats.dmg!);
    });
  }

  private hitUnit(u: Unit, dmg: number) {
    u.hp -= dmg;
    u.spr.setTintFill(0xffffff);
    this.time.delayedCall(70, () => u.spr.clearTint());
    if (u.id === 'wall') {
      const r = u.hp / u.def.hp;
      const key = r > 0.66 ? 'wall_idle' : r > 0.33 ? this.anim('wall_crack', u.def.tex, [4, 5], 2) : this.anim('wall_broken', u.def.tex, [8, 9], 2);
      if (u.spr.anims.currentAnim?.key !== key) u.spr.play(key);
    }
    if (u.hp <= 0) this.killUnit(u);
  }

  private killUnit(u: Unit) {
    this.units = this.units.filter(x => x !== u);
    const spr = u.spr;
    if (u.id === 'sentinel' || u.id === 'alchemist') {
      const fx = this.add.sprite(spr.x, spr.y, 'fx_vampire_poof', 0).setOrigin(0.5, 1).setScale(S).setDepth(spr.depth);
      fx.play(this.anim('poof', 'fx_vampire_poof', [0, 1, 2, 3], 7, 0)).once('animationcomplete', () => fx.destroy());
      spr.destroy();
    } else if (u.id === 'wall' || u.id === 'chalice') {
      spr.play(this.anim(`${u.id}_die`, u.def.tex, [12, 13, 14, 15], 7, 0)).once('animationcomplete', () =>
        this.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() }));
    } else this.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() });
  }

  private updateUnits(dt: number) {
    for (const u of [...this.units]) {
      if (this.t < u.stunUntil) continue;
      u.cd -= dt;
      if (u.id === 'chalice' && u.cd <= 0) {
        u.cd = u.def.rate!;
        u.spr.play(this.anim('chalice_pour', u.def.tex, [4, 5, 6, 7], 8, 0)).once('animationcomplete', () => u.spr.play('chalice_idle'));
        this.spawnOrb(u);
      }
      if (u.id === 'sentinel' && u.cd <= 0) {
        const target = this.frontWolf(u.lane, u.col - 0.2, COLS + 0.6);
        if (target) { u.cd = u.def.rate!; this.shoot(u, target); }
      }
      if (u.id === 'alchemist' && u.cd <= 0) {
        const target = this.frontWolf(u.lane, u.col - 0.2, u.col + 4.5);
        if (target) { u.cd = u.def.rate!; this.throwFlask(u, target); }
      }
      if (u.id === 'gargoyle') {
        if (this.t < u.stoneUntil) continue;
        if (u.spr.anims.currentAnim?.key === 'garg_stone') u.spr.play(this.anim('garg_wake', u.def.tex, [13, 14, 15], 6, 0)).once('animationcomplete', () => u.spr.play('garg_idle'));
        const target = this.frontWolf(u.lane, u.col - 0.3, u.col + 1.7);
        if (target) {
          u.stoneUntil = this.t + u.def.rate!;
          u.spr.play(this.anim('garg_dive', u.def.tex, [8, 9, 10, 11], 12, 0)).once('animationcomplete', () => {
            u.spr.setFrame(12);
            u.spr.anims.stop();
            this.anims.exists('garg_stone') || this.anims.create({ key: 'garg_stone', frames: this.anims.generateFrameNumbers(u.def.tex, { frames: [12] }), frameRate: 1 });
            u.spr.play('garg_stone');
          });
          this.time.delayedCall(250, () => { if (!target.dead) this.hurt(target, u.def.dmg!); });
        }
      }
    }
  }

  private frontWolf(lane: number, from: number, to: number) {
    let best: Wolf | undefined;
    for (const w of this.wolves) if (!w.dead && w.lane === lane && w.j >= from && w.j <= to && w.j < COLS + 0.6 && (!best || w.j < best.j)) best = w;
    return best;
  }

  private shoot(u: Unit, w: Wolf) {
    u.spr.play(this.anim('sent_shoot', u.def.tex, [10, 11], 8, 0)).once('animationcomplete', () => u.spr.play('sent_idle'));
    const from = { x: u.spr.x - 6, y: u.spr.y - 26 }, to = { x: w.spr.x, y: w.spr.y - 24 };
    const bolt = this.add.sprite(from.x, from.y, 'fx_bolt', 0).setScale(S * 0.8).setDepth(9e5)
      .setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
    this.tweens.add({ targets: bolt, x: to.x, y: to.y, duration: 220, onComplete: () => { bolt.destroy(); if (!w.dead) this.hurt(w, u.def.dmg!); } });
  }

  private throwFlask(u: Unit, w: Wolf) {
    u.spr.play(this.anim('alch_throw', u.def.tex, [8, 9, 10, 11], 10, 0)).once('animationcomplete', () => u.spr.play('alch_idle'));
    const fl = this.add.sprite(u.spr.x, u.spr.y - 30, 'fx_flask', 0).setScale(S * 0.7).setDepth(9e5).play(this.anim('flask_spin', 'fx_flask', [0, 1, 2, 3], 12));
    const tx = w.spr.x, ty = w.spr.y - 10;
    this.tweens.add({ targets: fl, x: tx, duration: 500 });
    this.tweens.add({ targets: fl, y: { from: fl.y, to: ty }, duration: 500, ease: 'Quad.easeIn', onComplete: () => {
      fl.play(this.anim('flask_splash', 'fx_flask', [4, 5, 6, 7], 10, 0)).once('animationcomplete', () => fl.destroy());
      for (const o of this.wolves) if (!o.dead && Math.abs(o.lane - w.lane) <= 1 && Math.abs(o.j - w.j) < 0.9) { this.hurt(o, u.def.dmg!); o.slowUntil = this.t + 3000; }
    } });
  }

  // Chalice overflow: tap it, or it flies into the pool on its own.
  private spawnOrb(u: Unit) {
    const orb = this.add.sprite(u.spr.x, u.spr.y - 60, 'blood_orb', 0).setScale(S * 0.8).setDepth(9.5e5);
    if (this.anims.exists('orb_float')) orb.play('orb_float');
    orb.setInteractive(new Phaser.Geom.Circle(orb.width / 2, orb.height / 2, orb.width), Phaser.Geom.Circle.Contains);
    let done = false;
    const take = () => {
      if (done) return;
      done = true;
      state.resources.blood += u.def.gen!;
      this.floatText(orb.x, orb.y, `+${u.def.gen} Sangue`);
      orb.destroy();
      this.refreshUi();
    };
    orb.once('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); take(); });
    this.tweens.add({ targets: orb, y: orb.y - 30, duration: 4000, onComplete: take });
  }

  private floatText(x: number, y: number, msg: string) {
    const t = this.add.text(x, y, msg, { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#ff3348', fontStyle: 'bold', stroke: '#1a0508', strokeThickness: 5 })
      .setOrigin(0.5).setScale(0.5 / this.cameras.main.zoom).setDepth(1.1e6);
    this.tweens.add({ targets: t, y: y - 30 / this.cameras.main.zoom, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  // ---------- wolves ----------
  private spawn(id: WolfId, lane: number) {
    const def = WOLVES[id];
    const c = cellPos(lane, COLS + 1);
    const spr = this.add.sprite(c.x, c.y + 14, def.tex, 4).setOrigin(0.5, 1).setScale(S).setDepth(c.y);
    spr.play(this.anim(`${id}_walk`, def.tex, [4, 5, 6, 7], id === 'scout' ? 10 : 7));
    const hp = def.hp * (1 + (this.cfg.raid.night - 1) * 0.08);
    this.wolves.push({ def: { ...def, hp }, id, lane, j: COLS + 1, spr, hp, bite: 0, slowUntil: 0, buffUntil: 0, jumped: false, skill: 4000, busy: false, dead: false });
    if (id === 'alpha') this.toast('Ulf: Boa noite, vizinho. Vim buscar o que é meu. E o que é seu.');
  }

  private hurt(w: Wolf, dmg: number) {
    if (w.dead) return;
    w.hp -= dmg;
    w.spr.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (!w.dead) w.spr.clearTint(); });
    if (w.hp > 0) return;
    w.dead = true;
    this.kills++;
    const fx = this.add.sprite(w.spr.x, w.spr.y - 20, 'fx_hit', 0).setScale(S).setDepth(9e5);
    fx.play(this.anim('hit', 'fx_hit', [0, 1, 2, 3], 14, 0)).once('animationcomplete', () => fx.destroy());
    this.tweens.add({ targets: w.spr, alpha: 0, y: w.spr.y + 6, duration: 450, onComplete: () => w.spr.destroy() });
    this.refreshUi();
  }

  private updateWolves(dt: number) {
    const s = dt / 1000;
    for (const w of this.wolves) {
      if (w.dead || w.busy) continue;
      // Special skills
      w.skill -= dt;
      if (w.skill <= 0 && (w.id === 'howler' || w.id === 'alpha')) {
        w.skill = w.id === 'alpha' ? 8000 : 6000;
        w.busy = true;
        w.spr.play(this.anim(`${w.id}_skill`, w.def.tex, [8, 9, 10, 11], 8, 0)).once('animationcomplete', () => { w.busy = false; w.spr.play(`${w.id}_walk`); });
        if (w.id === 'howler') for (const o of this.wolves) if (Math.abs(o.lane - w.lane) <= 1 && Math.abs(o.j - w.j) < 2.5) o.buffUntil = this.t + 3500;
        if (w.id === 'alpha') for (const u of this.units) if (Math.abs(u.lane - w.lane) <= 1 && Math.abs(u.col + 0.5 - w.j) < 2.5) u.stunUntil = this.t + 2200;
        continue;
      }
      // Blocked by a defender?
      const blocker = this.units.find(u => u.lane === w.lane && w.j > u.col + 0.5 && w.j - (u.col + 0.5) < 0.75);
      if (blocker) {
        if (w.id === 'leaper' && !w.jumped) {
          w.jumped = true; w.busy = true;
          w.spr.play(this.anim('leaper_jump', w.def.tex, [8, 9, 10, 11], 7, 0));
          this.tweens.addCounter({ from: w.j, to: blocker.col - 0.5, duration: 700, onUpdate: tw => { w.j = tw.getValue() ?? w.j; this.placeWolf(w); },
            onComplete: () => { w.busy = false; w.spr.play('leaper_walk'); } });
          continue;
        }
        w.bite -= dt;
        if (w.bite <= 0) {
          w.bite = 1000;
          this.tweens.add({ targets: w.spr, x: w.spr.x + 6, y: w.spr.y - 3, duration: 90, yoyo: true });
          this.hitUnit(blocker, w.def.dmg);
        }
        continue;
      }
      const speed = w.def.speed * (this.t < w.slowUntil ? 0.55 : 1) * (this.t < w.buffUntil ? 1.35 : 1);
      w.j -= speed * s;
      this.placeWolf(w);
      if (w.j <= -0.35) this.grab(w);
    }
    this.wolves = this.wolves.filter(w => !w.dead || w.spr.active);
  }

  private placeWolf(w: Wolf) {
    const c = cellPos(w.lane, w.j);
    w.spr.setPosition(c.x, c.y + 14).setDepth(c.y + 14);
  }

  // A wolf reached the fence: it takes one of the farm's humans and runs back to the forest.
  private grab(w: Wolf) {
    w.dead = true;
    this.grabbed++;
    this.wolvesGone++;
    const victim = this.folk.shift();
    if (victim) {
      const fx = this.add.sprite(victim.x, victim.y - 50, 'fx_fear', 0).setScale(S).setDepth(9e5);
      fx.play(this.anim('fear', 'fx_fear', [0, 1, 2, 3], 8, 0)).once('animationcomplete', () => fx.destroy());
      this.tweens.add({ targets: victim, alpha: 0, duration: 500, onComplete: () => victim.destroy() });
    }
    this.toast(`Humano: ${Phaser.Utils.Array.GetRandom(BATTLE_LINES.grab)}`);
    this.tweens.add({ targets: w.spr, alpha: 0, x: w.spr.x - 60, y: w.spr.y + 30, duration: 900, onComplete: () => w.spr.destroy() });
    this.refreshUi();
  }

  // ---------- loop ----------
  update(_time: number, delta: number) {
    if (this.ended) return;
    const dt = Math.min(delta, 50);
    this.t += dt;
    const raid = this.cfg.raid;
    while (this.spawnIdx < raid.spawns.length && raid.spawns[this.spawnIdx].at <= this.t) {
      const sp = raid.spawns[this.spawnIdx++];
      this.spawn(sp.wolf, sp.lane);
    }
    // The farm keeps collecting while you defend: a slow Blood trickle.
    this.trickle += dt;
    const every = 2500 / Math.max(1, this.cfg.collectLevel);
    if (this.trickle >= every) { this.trickle -= every; state.resources.blood += 2; this.refreshUi(); }
    this.updateUnits(dt);
    this.updateWolves(dt);
    this.drawBars();
    this.drawHover();
    if (this.spawnIdx >= raid.spawns.length && this.wolves.every(w => w.dead)) this.finish(true);
  }

  private drawBars() {
    const g = this.bars.clear();
    for (const w of this.wolves) {
      if (w.dead || w.hp >= w.def.hp) continue;
      const x = w.spr.x - 16, y = w.spr.y - w.spr.displayHeight - 6;
      g.fillStyle(0x140a10, 0.9).fillRect(x - 1, y - 1, 34, 6).fillStyle(0xd8122a, 1).fillRect(x, y, 32 * Math.max(0, w.hp / w.def.hp), 4);
    }
    for (const u of this.units) {
      if (u.hp >= u.def.hp) continue;
      const x = u.spr.x - 16, y = u.spr.y - u.spr.displayHeight - 6;
      g.fillStyle(0x140a10, 0.9).fillRect(x - 1, y - 1, 34, 6).fillStyle(0x6fbf73, 1).fillRect(x, y, 32 * Math.max(0, u.hp / u.def.hp), 4);
    }
  }

  // Selected card: highlight the free cells.
  private drawHover() {
    const g = this.hover.clear();
    if (!this.selected) return;
    g.lineStyle(2, 0xe8b54a, 0.45);
    for (let i = 0; i < LANES; i++) for (let j = 0; j < COLS; j++) {
      if (!UNITS[this.selected].spell && this.units.some(u => u.lane === i && u.col === j)) continue;
      const a = iso(i, j), b = iso(i + 1, j), c = iso(i + 1, j + 1), d = iso(i, j + 1);
      g.strokePoints([a, b, c, d, a]);
    }
  }

  private finish(won: boolean, retreated = false) {
    if (this.ended) return;
    this.ended = true;
    // Retreating: every wolf still in the field takes someone (capped).
    if (retreated) this.grabbed += Math.min(3, this.wolves.filter(w => !w.dead).length + (this.cfg.raid.spawns.length - this.spawnIdx > 0 ? 1 : 0));
    const res = this.ui.querySelector('.res')!;
    res.querySelector('h3')!.textContent = won && this.grabbed === 0 ? 'Vitória!' : won ? 'Ataque repelido' : 'Recuada';
    res.querySelector('.rt')!.textContent = `${this.kills} lobisomens derrotados · ${this.grabbed} humano${this.grabbed === 1 ? '' : 's'} levado${this.grabbed === 1 ? '' : 's'} · ` +
      `${this.spent} de Sangue gasto. ${won && this.grabbed === 0 ? `Aureliano: ${BATTLE_LINES.win}` : `Aureliano: ${BATTLE_LINES.lose}`}`;
    res.classList.add('on');
    res.querySelector('button')!.onclick = () => {
      this.ui.remove();
      document.body.classList.remove('in-battle');
      this.scale.off('resize', this.fitCamera, this);
      this.cfg.onEnd({ won, grabbed: this.grabbed, bloodSpent: this.spent, kills: this.kills, retreated });
    };
  }
}
