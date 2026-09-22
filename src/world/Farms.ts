// Vegetable plots (GDD_ADENDO A3): plant → grow → harvest, worked by humans who then don't queue for collection.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { CROPS, CropId, WORK_MS } from '../data/crops';
import type { FarmMap, Pen } from '../map/bosque';
import { iso, tileCenter } from '../map/iso';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';

type P = [number, number];
export interface FloatHost { floatText(x: number, y: number, msg: string, color: string): void; fx(key: string, x: number, y: number, scale?: number): void }
export interface FarmJob { penId: string; type: 'plant' | 'harvest'; spot: P }

const CLAIM_TIMEOUT = 60000;
const TAP_SLOP = 8;
// Until the crop art (asset block 19) exists, stages borrow existing sprites.
const PLACEHOLDER: Record<number, { tex: string; scale: number }> = {
  1: { tex: 'decal_1', scale: 0.5 }, 2: { tex: 'bush_b', scale: 0.3 }, 3: { tex: 'bush_a', scale: 0.36 },
};

interface PlotView { pen: Pen & { work: P[] }; sprites: Phaser.GameObjects.Image[]; stage: number; crop: string }

export class Farms {
  private views: PlotView[] = [];
  private claims = new Map<string, number>();
  private downAt?: { x: number; y: number };

  constructor(private scene: Phaser.Scene & FloatHost, map: FarmMap, private hud: Hud, private panel: BuildPanel, private editorActive: () => boolean) {
    for (const pen of map.pens) this.createView(pen);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.downAt = { x: p.x, y: p.y }; });
  }

  private tiles(pen: Pen) {
    const out: P[] = [];
    for (let i = pen.i0; i <= pen.i1; i++) for (let j = pen.j0; j <= pen.j1; j++) out.push([i, j]);
    return out;
  }

  private createView(pen: Pen & { work: P[] }) {
    const a = iso(pen.i0, pen.j0), b = iso(pen.i1 + 1, pen.j1 + 1), l = iso(pen.i0, pen.j1 + 1), r = iso(pen.i1 + 1, pen.j0);
    const w = r.x - l.x, h = b.y - a.y;
    // Diamond-shaped hit area so taps on neighbouring plots don't land here.
    const shape = new Phaser.Geom.Polygon([a.x - l.x, 0, w, r.y - a.y, b.x - l.x, h, 0, l.y - a.y]);
    const zone = this.scene.add.zone((l.x + r.x) / 2, (a.y + b.y) / 2, w, h).setInteractive(shape, Phaser.Geom.Polygon.Contains);
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.editorActive()) return;
      if (this.downAt && Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y) > TAP_SLOP) return;
      this.openPanel(pen.id);
    });
    const view: PlotView = { pen, sprites: [], stage: -1, crop: '' };
    this.views.push(view);
    this.redraw(view);
  }

  private stageOf(id: string) {
    const st = state.plots[id];
    if (!st || st.phase === 'plant') return 0;
    if (st.phase === 'harvest') return 3;
    const pct = st.growth / CROPS[st.crop as CropId].growMs;
    return pct < 0.4 ? 1 : 2;
  }

  private redraw(v: PlotView) {
    const stage = this.stageOf(v.pen.id), crop = state.plots[v.pen.id]?.crop ?? '';
    if (stage === v.stage && crop === v.crop) return;
    v.stage = stage; v.crop = crop;
    for (const s of v.sprites) s.destroy();
    v.sprites = [];
    if (!stage) return;
    const real = `crop_${crop}_${stage}`;
    for (const [i, j] of this.tiles(v.pen)) {
      const c = tileCenter(i, j);
      const img = this.scene.textures.exists(real)
        ? this.scene.add.image(c.x, c.y + 4, real).setOrigin(0.5, 0.62).setScale(0.5)
        : this.scene.add.image(c.x, c.y + 10, PLACEHOLDER[stage].tex).setOrigin(0.5, 1).setScale(PLACEHOLDER[stage].scale);
      v.sprites.push(img.setDepth(c.y));
    }
    if (stage === 3) {
      for (const s of v.sprites) this.scene.tweens.add({ targets: s, scaleY: s.scaleY * 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  update(dt: number) {
    for (const v of this.views) {
      const st = state.plots[v.pen.id];
      if (st?.phase === 'growing') {
        st.growth += dt;
        if (st.growth >= CROPS[st.crop as CropId].growMs) st.phase = 'harvest';
      }
      this.redraw(v);
    }
  }

  // ---------- work for humans ----------
  claimJob(): FarmJob | null {
    const now = this.scene.time.now;
    for (const v of Phaser.Utils.Array.Shuffle([...this.views])) {
      const st = state.plots[v.pen.id];
      if (!st || st.phase === 'growing' || !v.pen.work.length) continue;
      if (now - (this.claims.get(v.pen.id) ?? -Infinity) < CLAIM_TIMEOUT) continue;
      this.claims.set(v.pen.id, now);
      return { penId: v.pen.id, type: st.phase, spot: Phaser.Utils.Array.GetRandom(v.pen.work) };
    }
    return null;
  }

  get workMs() { return WORK_MS; }

  complete(job: FarmJob) {
    this.claims.delete(job.penId);
    const st = state.plots[job.penId];
    if (!st || st.phase !== job.type) return;
    if (job.type === 'plant') {
      st.phase = 'growing'; st.growth = 0;
      bus.emit('CROP_PLANTED', { plotId: job.penId, crop: st.crop });
      return;
    }
    const pen = this.views.find(v => v.pen.id === job.penId)!.pen;
    const food = Math.round(this.tiles(pen).length * CROPS[st.crop as CropId].yieldPerTile);
    state.resources.food += food;
    st.phase = 'plant'; st.growth = 0; // same crop is replanted on the next visit
    bus.emit('CROP_HARVESTED', { plotId: job.penId, crop: st.crop, food });
    const c = tileCenter(pen.i0, pen.j0);
    this.scene.floatText(c.x, c.y - 20, `+${food} Comida`, '#9fd86b');
    this.scene.fx('fx_sparkle', c.x, c.y - 10);
  }

  // ---------- panel ----------
  private openPanel(id: string) {
    const st = state.plots[id];
    const pen = this.views.find(v => v.pen.id === id)!.pen;
    const n = this.tiles(pen).length;
    const crop = st ? CROPS[st.crop as CropId] : undefined;
    const phase = !st ? 'Sem cultivo' : st.phase === 'plant' ? 'Aguardando plantio' : st.phase === 'harvest' ? 'Pronta para colher'
      : `Crescendo · ${Math.floor((st.growth / crop!.growMs) * 100)}%`;
    this.panel.open({
      title: 'Horta',
      subtitle: `${crop?.name ?? 'Vazia'} · ${phase}`,
      desc: crop ? `${crop.desc} Humanos plantam e colhem sozinhos; quem está na horta não entra na fila de coleta.`
        : 'Escolha o que plantar. Humanos cuidam do resto.',
      stats: [
        ...(crop ? [`Rende ${Math.round(n * crop.yieldPerTile)} Comida a cada ${Math.round(crop.growMs / 1000)} s`] : []),
        `Estoque de comida: ${Math.floor(state.resources.food)}`,
      ],
      choices: (Object.keys(CROPS) as CropId[]).map(k => ({
        label: `${CROPS[k].name} · ${Math.round(n * CROPS[k].yieldPerTile)}/${Math.round(CROPS[k].growMs / 1000)}s`,
        active: st?.crop === k,
        onClick: () => this.setCrop(id, k),
      })),
    });
  }

  private setCrop(id: string, crop: CropId) {
    const st = state.plots[id];
    if (st?.crop === crop) return;
    if (st && st.phase !== 'plant') this.hud.toast('Bóris: Cultivo anterior descartado. Registrado como "adubo estratégico".');
    state.plots[id] = { crop, growth: 0, phase: 'plant' };
    this.claims.delete(id);
    this.openPanel(id);
  }
}
