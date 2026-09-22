// F2 map editor: drag objects to fine-tune the layout; Shift+click hides an object.
// Changes persist in localStorage; "Copiar JSON" exports them for src/map/overrides.json.
import Phaser from 'phaser';
import type { FarmMap, MapObject } from '../map/bosque';
import type { FarmScene, Glow } from '../scenes/FarmScene';
import bundled from '../map/overrides.json';

type Override = { dx: number; dy: number; hide?: boolean };
type Overrides = Record<string, Override>;
export interface Placed { img: Phaser.GameObjects.Image; obj: MapObject }

const STORE = 'hemo.overrides';

function loadOverrides(): Overrides {
  let local: Overrides = {};
  try { local = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { /* storage unavailable */ }
  return { ...(bundled as Overrides), ...local };
}

export function applyOverrides(map: FarmMap): FarmMap {
  const ov = loadOverrides();
  map.objects = map.objects.filter(o => !(o.id && ov[o.id]?.hide));
  for (const o of map.objects) {
    const d = o.id && ov[o.id];
    if (d) { o.x += d.dx; o.y += d.dy; o.depth += d.dy; }
  }
  for (const l of map.lights) {
    const d = l.owner && ov[l.owner];
    if (d) { l.x += d.dx; l.y += d.dy; }
  }
  return map;
}

export class MapEditor {
  dragging = false;
  private active = false;
  get isActive() { return this.active; }
  private ready = false;
  private panel?: HTMLDivElement;
  private overrides = loadOverrides();

  constructor(private scene: FarmScene, private placed: Placed[], private glows: Glow[]) {
    scene.input.keyboard?.on('keydown-F2', () => this.toggle());
  }

  private toggle() {
    this.active = !this.active;
    if (this.active && !this.ready) this.enable();
    for (const p of this.placed) {
      if (!p.obj.id) continue;
      if (this.active) p.img.setInteractive(); else p.img.disableInteractive();
    }
    this.showPanel(this.active);
  }

  private enable() {
    this.ready = true;
    const input = this.scene.input;
    for (const p of this.placed) {
      if (!p.obj.id) continue;
      p.img.setInteractive({ pixelPerfect: true, alphaTolerance: 40, draggable: true });
      p.img.setData('placed', p);
    }
    input.on('dragstart', () => { this.dragging = true; });
    input.on('drag', (_p: Phaser.Input.Pointer, img: Phaser.GameObjects.Image, x: number, y: number) => {
      const p: Placed = img.getData('placed');
      const ddx = x - img.x, ddy = y - img.y;
      img.setPosition(x, y).setDepth(img.depth + ddy);
      for (const g of this.glows) {
        if (g.light.owner !== p.obj.id) continue;
        g.light.x += ddx; g.light.y += ddy; this.scene.placeGlow(g);
      }
      const o = this.overrides[p.obj.id!] ?? { dx: 0, dy: 0 };
      o.dx = Math.round(o.dx + ddx); o.dy = Math.round(o.dy + ddy);
      this.overrides[p.obj.id!] = o;
    });
    input.on('dragend', () => { this.dragging = false; this.save(); });
    input.on('gameobjectdown', (ptr: Phaser.Input.Pointer, img: Phaser.GameObjects.Image) => {
      if (!this.active || !ptr.event.shiftKey) return;
      const p: Placed = img.getData('placed');
      this.overrides[p.obj.id!] = { ...(this.overrides[p.obj.id!] ?? { dx: 0, dy: 0 }), hide: true };
      img.setVisible(false).disableInteractive();
      this.save();
    });
  }

  private save() {
    try { localStorage.setItem(STORE, JSON.stringify(this.overrides)); } catch { /* storage unavailable */ }
  }

  private showPanel(on: boolean) {
    if (!this.panel) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:10px;left:10px;z-index:10;padding:8px 10px;background:#140a10e6;color:#f3e2c8;' +
        'font:13px system-ui;border:1px solid #6b1d2a;border-radius:6px;display:flex;gap:8px;align-items:center';
      el.innerHTML = '<b>EDITOR</b><span>arraste · Shift+clique esconde</span>' +
        '<button data-a="copy">Copiar JSON</button><button data-a="reset">Resetar</button>';
      el.addEventListener('click', e => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'copy') navigator.clipboard?.writeText(JSON.stringify(this.overrides, null, 1));
        if (a === 'reset' && confirm('Descartar os ajustes locais do editor?')) {
          try { localStorage.removeItem(STORE); } catch { /* storage unavailable */ }
          location.reload();
        }
      });
      document.body.appendChild(el);
      this.panel = el;
    }
    this.panel.style.display = on ? 'flex' : 'none';
  }
}
