// Battle: "Vampiros vs. Lobisomens" (GDD_ADENDO A6). Separate scene; the farm's real humans wait behind the fence.
// Lanes run along the isometric j axis: wolves come from the forest (bottom-left) up towards the palisade (top-right).
import Phaser from 'phaser';
import { state } from '../core/state';
import { BATTLE_LINES, COLS, LANES, Raid, UNITS, UnitDef, UnitId, WOLVES, WolfDef, WolfId, endlessWave } from '../data/battle';
import { has } from '../data/research';
import { fx, less } from '../core/bonus';
import { meta, saveMeta } from '../core/meta';

const S = 0.5;
const US = S * 1.35; // units and wolves read bigger than farm props: they're the focus here
export interface BattleResult { won: boolean; grabbed: number; bloodSpent: number; kills: number; retreated: boolean; stars: number; waves: number }
export interface BattleData { raid: Raid; collectLevel: number; looks: string[]; onEnd: (r: BattleResult) => void }

interface Unit { def: UnitDef; id: UnitId; lane: number; col: number; spr: Phaser.GameObjects.Sprite; hp: number; cd: number; stunUntil: number; stoneUntil: number }
interface Wolf { def: WolfDef; id: WolfId; lane: number; j: number; spr: Phaser.GameObjects.Sprite; hp: number; bite: number; slowUntil: number;
  buffUntil: number; jumped: boolean; skill: number; busy: boolean; dead: boolean }

// Horizontal lanes like PvZ: the fence is on the left, wolves enter from the forest on the right.
const CW = 96, CH = 72;                       // cell size in world units
const cellPos = (lane: number, j: number) => ({ x: (j + 0.5) * CW, y: (lane + 0.72) * CH });
const PREP_MS = 20000;                        // preparation time before the first wolf

// Vampire spells: always available, paid in Blood, long cooldowns. Tap the spell, then the field.
type SpellId = 'rain' | 'mist' | 'drain';
const SPELLS: Record<SpellId, { name: string; cost: number; cd: number; desc: string; icon: string; color: number; css: string }> = {
  rain: { name: 'Chuva Rubra', cost: 60, cd: 25000, icon: 'icon_blood', color: 0xd8122a, css: '#e0283c', desc: 'toque numa raia: 120 de dano em todos os lobos dela' },
  mist: { name: 'Névoa Hipnótica', cost: 40, cd: 30000, icon: 'mk_sleep', color: 0x9a6aff, css: '#9a6aff', desc: 'toque no campo: todos os lobos ficam lentos por 6 s' },
  drain: { name: 'Beijo Sombrio', cost: 30, cd: 18000, icon: 'icon_vitality', color: 0xff3a7a, css: '#ff4a8a', desc: 'toque numa área 3×3: 80 de dano e +10 Sangue por lobo atingido' },
};

export class BattleScene extends Phaser.Scene {
  private cfg!: BattleData;
  private units: Unit[] = [];
  private wolves: Wolf[] = [];
  private t = 0;
  private spawnIdx = 0;
  private selected?: UnitId;
  private grabbed = 0;
  private spell?: SpellId;
  private spellReady: Partial<Record<SpellId, number>> = {};
  private bank = 0;        // Blood Moon: its own Blood pool, the farm's is untouched
  private wave = 0;
  private lives = 3;
  private spent = 0;
  private kills = 0;
  private trickle = 0;
  private ended = false;
  private folk: Phaser.GameObjects.Sprite[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ui!: HTMLDivElement;
  private ready: Partial<Record<UnitId, number>> = {};   // card recharge: time when usable again
  private uiTick = 0;
  private ring!: Phaser.GameObjects.Graphics;
  private down?: { x: number; y: number; moved: boolean };
  private pinch = 0;
  private touches = new Map<number, { x: number; y: number }>();
  private fitZoom = 1;

  constructor() { super('Battle'); }

  init(data: BattleData) {
    this.cfg = data;
    Object.assign(this, { spell: undefined, spellReady: {}, bank: 150, wave: 1, lives: 3, units: [], wolves: [], t: 0, spawnIdx: 0, selected: undefined, grabbed: 0, spent: 0, kills: 0, trickle: 0, ended: false, folk: [], wolvesGone: 0, ready: {}, uiTick: 0, touches: new Map(), pinch: 0 });
    this.t = -(data.raid.endless ? 12000 : data.raid.spawns.length <= 5 ? PREP_MS + 5000 : PREP_MS);
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
    if (!this.textures.exists('bt_dot')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      for (let r = 8; r > 0; r--) g.fillStyle(0xffffff, 0.14 + (8 - r) * 0.11).fillCircle(8, 8, r); // soft glow dot for particles
      g.generateTexture('bt_dot', 16, 16);
      g.destroy();
    }
    this.buildField();
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
    this.toast(this.endless ? 'Aureliano: Lua de Sangue. Ondas sem fim, Sangue próprio. Ninguém da fazenda corre perigo, só o seu orgulho.' : `Aureliano: ${BATTLE_LINES.start} Você tem alguns segundos para se preparar.`);
  }

  // ---------- field ----------
  private buildField() {
    const rnd = new Phaser.Math.RandomDataGenerator(['battle']);
    const x0 = -9 * CW, x1 = (COLS + 8) * CW, y0 = -7 * CH, y1 = (LANES + 7) * CH; // generous: panning never shows the edge
    // Isometric ground tiles laid over the rectangle (same art as the farm).
    for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) {
      const x = (i - j) * 64, y = (i + j) * 32;
      if (x < x0 - 64 || x > x1 + 64 || y < y0 - 32 || y > y1 + 32) continue;
      const key = x < -CW * 0.2 ? 'tile_cobble_a' : x > COLS * CW + 20 ? 'tile_forest_floor' : rnd.frac() < 0.5 ? 'tile_grass_a' : 'tile_grass_b';
      this.add.image(x, y, key).setScale(S * 1.03).setDepth(-2e5 + y * 0.001).setFlipX(rnd.frac() < 0.5);
    }
    // Alternate lane shading so rows read at a glance.
    const bands = this.add.graphics().setDepth(-1.6e5);
    for (let l = 0; l < LANES; l++) bands.fillStyle(l % 2 ? 0x000000 : 0x1a2a10, l % 2 ? 0.14 : 0.1).fillRect(0, l * CH, COLS * CW, CH);
    // Palisade: a column of logs between the field and the farm.
    for (let y = -CH * 0.4; y <= LANES * CH + 10; y += 22) {
      this.add.image(-10, y, 'fence_palisade_post').setOrigin(0.5, 1).setScale(S * 0.9).setDepth(y);
    }
    // Forest edge where the wolves come from.
    for (let k = 0; k < 16; k++) {
      const x = (COLS + 0.6 + rnd.frac() * 2.2) * CW, y = rnd.between(-CH, (LANES + 1) * CH);
      this.add.image(x, y, rnd.pick(['pine_a', 'pine_b', 'pine_c', 'dead_tree_b'])).setOrigin(0.5, 1).setScale(S * 0.85).setDepth(y);
    }
    // The farm's own humans, anxiously watching from behind the fence.
    this.cfg.looks.slice(0, 8).forEach((look, k) => {
      const x = -60 - (k % 2) * 55 - rnd.between(0, 20), y = (k / 8) * LANES * CH + 30;
      const tex = look === 'base' ? 'human_walk_front' : look;
      if (!this.textures.exists(tex)) return;
      const spr = this.add.sprite(x, y, tex, look === 'base' ? 0 : 8).setOrigin(0.5, 1).setScale(S * 1.2).setDepth(y);
      this.tweens.add({ targets: spr, y: y - 2, duration: 300 + k * 40, yoyo: true, repeat: -1 });
      this.folk.push(spr);
    });
    for (const y of [-CH * 0.5, LANES * CH + 20]) this.add.image(-10, y, 'torch_stand').setOrigin(0.5, 1).setScale(S).setDepth(y + 1);
  }

  // Frame the lanes (plus the fence and the forest edge) between the horde bar and the cards.
  private fitCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width, H = this.scale.height;
    const land = W > H;
    // Standing phone: frame only the lanes so cells stay tappable (fence/forest are a drag away).
    const left = land ? -190 : -24, right = COLS * CW + (land ? 70 : 12), topY = -CH * 0.9, bottomY = LANES * CH + 30;
    this.ui?.classList.toggle('portrait', !land);
    this.ui?.classList.toggle('land', land);
    // Measure what the HTML UI actually covers and fit the field into the rest of the screen.
    const horde = this.ui?.querySelector('.horde')?.getBoundingClientRect();
    const panel = this.ui?.querySelector('.bottom')?.getBoundingClientRect();
    const top = (horde?.bottom ?? 60) + 4;
    const bottom = land ? 6 : H - (panel?.top ?? H - 190) + 4;
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

  // Drag to pan, pinch / wheel to zoom; a tap (no drag) places the selected card.
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
      this.touches.set(p.id, { x: p.x, y: p.y });
      this.pinch = 0;
      this.down = this.touches.size === 1 ? { x: p.x, y: p.y, moved: false } : undefined;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const t = this.touches.get(p.id);
      if (!t) return;
      const dx = p.x - t.x, dy = p.y - t.y;
      t.x = p.x; t.y = p.y;
      if (this.touches.size >= 2) {
        const [a, b] = [...this.touches.values()];
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.pinch) zoomAt(cam.zoom * d / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = d;
        return;
      }
      if (this.down && Phaser.Math.Distance.Between(this.down.x, this.down.y, p.x, p.y) > 10) this.down.moved = true;
      if (this.down?.moved) { cam.scrollX -= dx / cam.zoom; cam.scrollY -= dy / cam.zoom; }
    });
    const up = (p: Phaser.Input.Pointer) => {
      this.touches.delete(p.id);
      if (this.down && !this.down.moved && this.touches.size === 0) this.onTap(p);
      if (!this.touches.size) this.down = undefined;
      this.pinch = 0;
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => zoomAt(cam.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
  }

  // Faint lane grid, always visible, so it's obvious where defenders go.
  private drawGrid() {
    const g = this.add.graphics().setDepth(-1.5e5);
    g.lineStyle(1.5, 0xe8d8a8, 0.2);
    for (let l = 0; l <= LANES; l++) g.lineBetween(0, l * CH, COLS * CW, l * CH);
    for (let j = 0; j <= COLS; j++) g.lineBetween(j * CW, 0, j * CW, LANES * CH);
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
        `<span class="cn">${u.name}</span><span class="cc">${this.costOf(id)}</span><span class="cd"></span></button>`;
    };
    el.innerHTML = `<style>
      .bt{font:600 13px Georgia,serif;color:#f3e2c8}
      .bt .horde{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:9;width:min(460px,calc(100vw - 20px));
        box-sizing:border-box;padding:6px 12px 8px;border:8px solid transparent;border-image:url(assets/frame_tooltip.webp) 18 fill / 8px stretch}
      .bt .horde .lbl{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
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
      .bt .bc{position:relative;flex:none;width:74px;height:100px;border:0;background:url(assets/card_unit.webp) center/100% 100% no-repeat;cursor:pointer;padding:0;color:#f3e2c8;overflow:hidden}
      .bt .bc .pic{position:absolute;left:14px;right:14px;top:10px;height:56px;background-repeat:no-repeat}
      .bt .bc .cn{position:absolute;left:0;right:0;top:66px;font-size:10px;text-align:center}
      .bt .bc .cc{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);font-size:12px;color:#ffd0d4;font-weight:700}
      .bt .bc .cd{position:absolute;left:0;right:0;bottom:0;height:0;background:#000a;pointer-events:none}
      .bt .bc.sel{filter:drop-shadow(0 0 8px #e8b54a);transform:translateY(-6px)}.bt .bc.off{filter:grayscale(1) brightness(.55)}
      .bt .res{position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:#000b}
      .bt .res.on{display:flex}.bt .res .box{width:min(340px,calc(100vw - 32px));padding:14px;text-align:center;border:12px solid transparent;
        border-image:url(assets/frame_panel.webp) 22 fill / 12px stretch}.bt .res h3{margin:0 0 6px;color:#f6d9a0;font-size:20px}
      .bt .res button{margin-top:10px;width:100%;min-height:44px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:700 15px Georgia,serif}
      .bt .btoast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 170px);transform:translateX(-50%);z-index:9;max-width:min(460px,70vw);padding:4px 10px;
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
      .bt.land .horde{left:calc(50% + 44px);width:min(440px,calc(100vw - 110px));padding:2px 10px 5px;border-width:6px}
      .bt.land .horde .lbl{margin-bottom:2px}
      .bt .spells{position:fixed;right:max(8px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:9;display:flex;flex-direction:column;gap:8px}
      .bt.land .spells{bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
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
      .bt.land .go-now{left:calc(50% + 44px);top:calc(env(safe-area-inset-top,0px) + 50px)}.bt.land .btoast{left:calc(50% + 44px);bottom:calc(env(safe-area-inset-bottom,0px) + 8px)}
    </style>
    <div class="horde"><div class="lbl"><span class="wl">Horda</span><span class="wk"></span></div>
      <div class="track"><div class="fill"></div>${this.cfg.raid.waves.map(w => `<i class="flag" style="left:${(w / this.lastSpawn) * 100}%"></i>`).join('')}<i class="head"></i></div></div>
    <button class="go-now"></button><div class="btoast"></div><div class="rotate">↻ Melhor com o celular deitado</div>
    <div class="turn"><div><div class="ic">📱↻</div><b>Gire o celular</b><p>A batalha foi feita para jogar deitado.</p><button>Continuar assim mesmo</button></div></div>
    <div class="bottom"><div class="top"><div class="blood"><img src="assets/icon_blood.webp" alt=""><b class="bv">0</b></div><button class="retreat">Recuar</button></div>
      <div class="hint"></div>
      <div class="cards">${this.unlocked().map(card).join('')}</div></div>
    <div class="spells">${(Object.keys(SPELLS) as SpellId[]).map(id => `<button class="sp" data-s="${id}" style="--c:${SPELLS[id].css}" title="${SPELLS[id].name}: ${SPELLS[id].desc}">` +
      `<img src="assets/${SPELLS[id].icon}.webp" alt=""><span class="sc">${SPELLS[id].cost}</span><span class="scd"></span></button>`).join('')}</div>
    <div class="res"><div class="box"><h3></h3><p class="rt"></p><button>Voltar à fazenda</button></div></div>`;
    document.body.appendChild(el);
    document.body.classList.add('in-battle');
    this.ui = el;
    el.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.u as UnitId;
      this.selected = this.selected === id ? undefined : id;
      this.spell = undefined;
      this.refreshUi();
    }));
    el.querySelectorAll<HTMLButtonElement>('.sp').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.s as SpellId;
      this.spell = this.spell === id ? undefined : id;
      this.selected = undefined;
      this.refreshUi();
    }));
    el.querySelector<HTMLButtonElement>('.go-now')!.onclick = () => { if (this.t < 0) this.t = 0; };
    el.querySelector<HTMLButtonElement>('.turn button')!.onclick = () => { el.classList.add('stay'); this.fitCamera(); };
    el.querySelector<HTMLButtonElement>('.retreat')!.onclick = () => {
      if (confirm(this.endless ? 'Encerrar a Lua de Sangue?' : 'Recuar? Os lobisomens que restarem levam humanos.')) this.finish(false, true);
    };
    this.refreshUi();
  }

  private get lastSpawn() { const sp = this.cfg.raid.spawns; return Math.max(1, sp[sp.length - 1]?.at ?? 1); }

  private refreshUi() {
    const blood = Math.floor(this.blood);
    this.ui.querySelector('.bv')!.textContent = String(blood);
    this.ui.querySelectorAll<HTMLButtonElement>('.bc').forEach(b => {
      const id = b.dataset.u as UnitId, u = UNITS[id];
      const left = Math.max(0, (this.ready[id] ?? -Infinity) - this.t);
      b.classList.toggle('off', blood < this.costOf(id) || left > 0);
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
    const prog = this.endless ? Phaser.Math.Clamp((this.spawnIdx) / Math.max(1, total), 0, 1) : Phaser.Math.Clamp(this.t / this.lastSpawn, 0, 1);
    const prep = this.t < 0;
    this.ui.querySelector<HTMLElement>('.go-now')!.style.display = prep ? 'block' : 'none';
    if (prep) this.ui.querySelector('.go-now')!.textContent = `Preparação · ${Math.ceil(-this.t / 1000)} s · Começar já ▸`;
    this.ui.querySelector<HTMLElement>('.horde .fill')!.style.width = `${prog * 100}%`;
    this.ui.querySelector<HTMLElement>('.horde .head')!.style.left = `${prog * 100}%`;
    const wave = this.cfg.raid.waves.filter(w => this.t >= w).length;
    this.ui.querySelector('.wl')!.textContent = this.endless ? `Lua de Sangue · onda ${this.wave} · ${'♥'.repeat(this.lives)}${'♡'.repeat(3 - this.lives)}`
      : `${this.cfg.raid.big ? 'Lua cheia' : 'Horda'} · onda ${Math.max(1, wave)}/${this.cfg.raid.waves.length}`;
    this.ui.querySelector('.wk')!.textContent = this.endless ? `${this.kills} abatidos · recorde ${meta.bestWave ?? 0}` : `${this.kills}/${total} abatidos`;
    this.ui.querySelector('.hint')!.textContent = this.spell ? `${SPELLS[this.spell].name}: ${SPELLS[this.spell].desc}` : this.selected
      ? `${UNITS[this.selected].name}: toque numa casa da grade · ${UNITS[this.selected].desc}` : 'Escolha uma carta e toque na grade. Arraste para mover, pinça para zoom.';
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
    return { lane: Math.floor(w.y / CH), col: Math.floor(w.x / CW) };
  }

  private onTap(p: Phaser.Input.Pointer) {
    if (this.ended || (!this.selected && !this.spell)) return;
    const { lane, col } = this.cellAt(p);
    if (lane < 0 || lane >= LANES || col < 0 || col > COLS) return;
    if (this.spell) { this.cast(this.spell, lane, Math.min(col, COLS - 1)); return; }
    if (col >= COLS || !this.selected) return;
    const def = { ...UNITS[this.selected], cost: this.costOf(this.selected) };
    if (this.blood < def.cost) { this.toast('Sangue insuficiente. A fazenda continua coletando.'); return; }
    if ((this.ready[this.selected] ?? -Infinity) > this.t) { this.toast('Carta recarregando.'); return; }
    if (def.spell) { this.pay(def.cost); this.castBats(lane, col); this.ready.bats = this.t + def.recharge; this.selected = undefined; this.refreshUi(); return; }
    if (this.units.some(u => u.lane === lane && u.col === col)) return;
    this.pay(def.cost);
    this.place(this.selected, lane, col);
    this.refreshUi();
  }

  private costOf(id: UnitId) { return Math.round(UNITS[id].cost * state.mods.unitCost * less('unitCost', 0.5)); }

  private get endless() { return !!this.cfg.raid.endless; }
  private get blood() { return this.endless ? this.bank : state.resources.blood; }
  private set blood(v: number) { if (this.endless) this.bank = v; else state.resources.blood = v; }
  private pay(n: number) { this.blood -= n; this.spent += n; }

  // Unit strength: Arsenal level (hunt marks) + research + relics.
  private scaled(id: UnitId): UnitDef {
    const d = UNITS[id], lv = 1 + 0.15 * (meta.unitLv?.[id] ?? 0);
    return { ...d, hp: Math.round(d.hp * lv * (1 + fx('unitHp'))), dmg: d.dmg && Math.round(d.dmg * lv * (1 + fx('unitDmg'))),
      gen: d.gen && Math.round(d.gen * lv * (1 + fx('chalice'))) };
  }

  // ---------- units ----------
  private anim(key: string, tex: string, frames: number[], rate: number, repeat = -1) {
    if (!this.anims.exists(key) && this.textures.exists(tex)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
    return key;
  }

  private place(id: UnitId, lane: number, col: number) {
    const def = this.scaled(id);
    const c = cellPos(lane, col);
    const spr = this.add.sprite(c.x, c.y, def.tex, 0).setOrigin(0.5, 1).setScale(US).setDepth(c.y);
    const idle = id === 'chalice' ? this.anim('chalice_idle', def.tex, [0, 1, 2, 3], 5)
      : id === 'wall' ? this.anim('wall_idle', def.tex, [0, 1], 2)
      : id === 'gargoyle' ? this.anim('garg_idle', def.tex, [0, 1, 2, 3], 6)
      : id === 'alchemist' ? this.anim('alch_idle', def.tex, [12, 13], 2)
      : this.anim('sent_idle', def.tex, [8, 9], 2);
    spr.play(idle);
    spr.setScale(US * 0.2);
    this.burst(c.x, c.y - 20, 0xe8b54a, 12, 120, 450);
    this.tweens.add({ targets: spr, scale: US, duration: 250, ease: 'Back.easeOut' });
    // Chalices pour quickly the first time so their value is obvious.
    this.units.push({ def, id, lane, col, spr, hp: def.hp, cd: id === 'chalice' ? 2500 : def.rate ? def.rate * 0.4 : 0, stunUntil: 0, stoneUntil: 0 });
    this.ready[id] = this.t + def.recharge;
  }

  private castBats(lane: number, col: number) {
    const c = cellPos(lane, col);
    const fx = this.add.sprite(c.x, c.y - 30, 'fx_bat_swarm', 0).setScale(S * 1.6).setDepth(9e5);
    fx.play(this.anim('bats_fx', 'fx_bat_swarm', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12, 0)).once('animationcomplete', () => fx.destroy());
    this.time.delayedCall(450, () => {
      for (const w of this.wolves) if (!w.dead && Math.abs(w.lane - lane) <= 1 && Math.abs(w.j - (col + 0.5)) <= 1.6) this.hurt(w, this.scaled('bats').dmg!);
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
    const from = { x: u.spr.x + 10, y: u.spr.y - 34 }, to = { x: w.spr.x, y: w.spr.y - 30 };
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
    const orb = this.add.sprite(u.spr.x, u.spr.y - 80, 'blood_orb', 0).setScale(S * 1.3).setDepth(9.5e5);
    if (this.anims.exists('orb_float')) orb.play('orb_float');
    orb.setInteractive(new Phaser.Geom.Circle(orb.width / 2, orb.height / 2, orb.width), Phaser.Geom.Circle.Contains);
    let done = false;
    const take = () => {
      if (done) return;
      done = true;
      this.blood += u.def.gen!;
      this.floatText(orb.x, orb.y, `+${u.def.gen} Sangue`);
      orb.destroy();
      this.refreshUi();
    };
    orb.once('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); take(); });
    this.tweens.add({ targets: orb, y: orb.y - 30, duration: 2200, onComplete: take });
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
    const spr = this.add.sprite(c.x, c.y, def.tex, 0).setOrigin(0.5, 1).setScale(US).setFlipX(true).setDepth(c.y);
    spr.play(this.anim(`${id}_walk`, def.tex, [0, 1, 2, 3], id === 'scout' ? 10 : 7));
    const hp = def.hp * (1 + (this.cfg.raid.night - 1) * 0.08);
    this.wolves.push({ def: { ...def, hp }, id, lane, j: COLS + 1, spr, hp, bite: 0, slowUntil: 0, buffUntil: 0, jumped: false, skill: 4000, busy: false, dead: false });
    if (id === 'alpha') this.toast('Ulf: Boa noite, vizinho. Vim buscar o que é meu. E o que é seu.');
  }

  // ---------- vampire spells ----------
  private cast(id: SpellId, lane: number, col: number) {
    const sp = SPELLS[id];
    if (this.blood < sp.cost) { this.toast('Sangue insuficiente para a magia.'); return; }
    if ((this.spellReady[id] ?? -Infinity) > this.t) { this.toast('A magia ainda está recarregando.'); return; }
    this.pay(sp.cost);
    this.spellReady[id] = this.t + sp.cd;
    this.spell = undefined;
    const power = 1 + fx('unitDmg');
    const cam = this.cameras.main;
    if (id === 'rain') {
      // Blood rain falling along the whole lane, then the hit.
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
      const fog = this.add.rectangle(COLS * CW / 2, LANES * CH / 2, COLS * CW + 200, LANES * CH + 100, sp.color, 0).setDepth(9.4e5);
      this.tweens.add({ targets: fog, fillAlpha: 0.22, duration: 500, yoyo: true, hold: 5000, onComplete: () => fog.destroy() });
      const wisps = this.add.particles(0, 0, 'bt_dot', { x: { min: 0, max: COLS * CW }, y: { min: 0, max: LANES * CH }, speedX: { min: -20, max: 20 }, speedY: { min: -12, max: 4 },
        scale: { start: 2.5, end: 5 }, alpha: { start: 0.25, end: 0 }, lifespan: 2200, tint: [0x9a6aff, 0xc8b0ff], quantity: 2, frequency: 60, blendMode: 'ADD' }).setDepth(9.45e5);
      this.time.delayedCall(5200, () => wisps.stop());
      this.time.delayedCall(7600, () => wisps.destroy());
      for (const w of this.wolves) if (!w.dead) { w.slowUntil = this.t + 6000; this.burst(w.spr.x, w.spr.y - 30, sp.color, 6, 60); }
      this.mistUntil = this.t + 6000;
    } else {
      const c = cellPos(lane, col);
      const ring = this.add.circle(c.x, c.y - 20, 10, sp.color, 0.5).setDepth(9.5e5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, radius: CW * 1.6, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
      this.burst(c.x, c.y - 20, sp.color, 24, 220, 700);
      let got = 0;
      for (const w of this.wolves) {
        if (w.dead || Math.abs(w.lane - lane) > 1 || Math.abs(w.j - (col + 0.5)) > 1.6) continue;
        got++;
        this.hurt(w, 80 * power);
        this.stream(w.spr.x, w.spr.y - 30, -40, w.spr.y - 30, sp.color);
      }
      if (got) {
        this.blood += got * 10;
        this.floatText(c.x, c.y - 60, `+${got * 10} Sangue`);
      }
    }
    this.refreshUi();
  }

  private mistUntil = 0;

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

  private hurt(w: Wolf, dmg: number) {
    if (w.dead) return;
    w.hp -= dmg;
    w.spr.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (!w.dead) w.spr.clearTint(); });
    if (w.hp > 0) { if (dmg >= 15) this.burst(w.spr.x, w.spr.y - 34, 0xff6a4a, 4, 90, 300); return; }
    w.dead = true;
    this.kills++;
    const hit = this.add.sprite(w.spr.x, w.spr.y - 20, 'fx_hit', 0).setScale(S).setDepth(9e5);
    hit.play(this.anim('hit', 'fx_hit', [0, 1, 2, 3], 14, 0)).once('animationcomplete', () => hit.destroy());
    this.burst(w.spr.x, w.spr.y - 30, 0xd8122a, w.id === 'alpha' ? 40 : w.id === 'brute' ? 24 : 14, w.id === 'alpha' ? 260 : 170);
    if (w.id === 'brute' || w.id === 'alpha') this.cameras.main.shake(w.id === 'alpha' ? 450 : 200, w.id === 'alpha' ? 0.012 : 0.005);
    if (fx('defense') && !this.endless) state.resources.essence += 2;
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
          this.tweens.add({ targets: w.spr, x: w.spr.x - 8, duration: 90, yoyo: true });
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
    w.spr.setPosition(c.x, c.y).setDepth(c.y);
  }

  // A wolf reached the fence: it takes one of the farm's humans and runs back to the forest.
  private grab(w: Wolf) {
    w.dead = true;
    if (this.endless) { this.lives--; if (this.lives <= 0) this.time.delayedCall(600, () => this.finish(false)); }
    else this.grabbed++;
    this.wolvesGone++;
    const victim = this.folk.shift();
    if (victim) {
      const fx = this.add.sprite(victim.x, victim.y - 50, 'fx_fear', 0).setScale(S).setDepth(9e5);
      fx.play(this.anim('fear', 'fx_fear', [0, 1, 2, 3], 8, 0)).once('animationcomplete', () => fx.destroy());
      this.tweens.add({ targets: victim, alpha: 0, duration: 500, onComplete: () => victim.destroy() });
    }
    this.cameras.main.flash(250, 90, 0, 0);
    this.toast(`Humano: ${Phaser.Utils.Array.GetRandom(BATTLE_LINES.grab)}`);
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
      this.spawn(sp.wolf, sp.lane);
    }
    // The farm keeps collecting while you defend: a slow Blood trickle.
    this.trickle += dt;
    const every = 2500 / Math.max(1, this.cfg.collectLevel);
    if (this.trickle >= every) { this.trickle -= every; this.blood += 2; this.refreshUi(); }
    this.updateUnits(dt);
    this.updateWolves(dt);
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
        raid.spawns.push(...endlessWave(this.wave, this.t + 5000));
        this.toast(`Aureliano: Onda ${this.wave}! +${40 + this.wave * 10} Sangue de reforço.`);
      }
    }
  }

  private drawBars() {
    // Chalice charge ring: fills up until the next orb.
    const r = this.ring.clear();
    for (const u of this.units) {
      if (u.id !== 'chalice') continue;
      const pct = Phaser.Math.Clamp(1 - u.cd / u.def.rate!, 0, 1);
      const x = u.spr.x, y = u.spr.y - u.spr.displayHeight - 12;
      r.lineStyle(5, 0x2a1016, 0.9).strokeCircle(x, y, 9);
      r.lineStyle(5, 0xff3348, 1).beginPath().arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2).strokePath();
    }
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
    g.lineStyle(2, 0xe8b54a, 0.55);
    for (let i = 0; i < LANES; i++) for (let j = 0; j < COLS; j++) {
      if (!UNITS[this.selected].spell && this.units.some(u => u.lane === i && u.col === j)) continue;
      g.strokeRect(j * CW + 3, i * CH + 3, CW - 6, CH - 6);
    }
  }

  private finish(won: boolean, retreated = false) {
    if (this.ended) return;
    this.ended = true;
    // Retreating: every wolf still in the field takes someone (capped). The Blood Moon is only a challenge: nobody is taken.
    if (retreated && !this.endless) this.grabbed += Math.min(3, this.wolves.filter(w => !w.dead).length + (this.cfg.raid.spawns.length - this.spawnIdx > 0 ? 1 : 0));
    const waves = this.endless ? this.wave - 1 : 0;
    // Stars (3 = nobody taken) become hunt marks for the Arsenal.
    const stars = this.endless ? Math.min(3, Math.floor(waves / 3)) : won ? (this.grabbed === 0 ? 3 : this.grabbed <= 1 ? 2 : 1) : 0;
    meta.marks = (meta.marks ?? 0) + stars;
    if (this.endless && waves > (meta.bestWave ?? 0)) meta.bestWave = waves;
    saveMeta();
    const res = this.ui.querySelector('.res')!;
    const starRow = `<div style="font-size:30px;letter-spacing:6px;color:#f6d9a0;text-shadow:0 0 10px #a07818">${'★'.repeat(stars)}<span style="color:#4a3a38">${'★'.repeat(3 - stars)}</span></div>`;
    res.querySelector('h3')!.innerHTML = (this.endless ? `Lua de Sangue: ${waves} onda${waves === 1 ? '' : 's'}` : won && this.grabbed === 0 ? 'Vitória!' : won ? 'Ataque repelido' : 'Recuada') + starRow;
    res.querySelector('.rt')!.textContent = this.endless
      ? `${this.kills} lobisomens derrotados · recorde: ${meta.bestWave} ondas · +${stars} marca${stars === 1 ? '' : 's'} de caça. Aureliano: ${waves >= 5 ? 'Isso foi quase elegante.' : 'Voltem amanhã. Eles voltam.'}`
      : `${this.kills} lobisomens derrotados · ${this.grabbed} humano${this.grabbed === 1 ? '' : 's'} levado${this.grabbed === 1 ? '' : 's'} · ` +
        `${this.spent} de Sangue gasto · +${stars} marca${stars === 1 ? '' : 's'} de caça (Arsenal no menu). ${won && this.grabbed === 0 ? `Aureliano: ${BATTLE_LINES.win}` : `Aureliano: ${BATTLE_LINES.lose}`}`;
    res.classList.add('on');
    res.querySelector('button')!.onclick = () => {
      this.ui.remove();
      document.body.classList.remove('in-battle');
      this.scale.off('resize', this.fitCamera, this);
      this.scale.off('resize', this.refitLater, this);
      this.cfg.onEnd({ won, grabbed: this.grabbed, bloodSpent: this.spent, kills: this.kills, retreated, stars, waves });
    };
  }

}
