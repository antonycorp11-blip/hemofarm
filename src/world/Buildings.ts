// Buildings on the map: empty plots, construction in progress and finished levels.
// Tap a plot/building to open the build panel; every level change is visible within a second.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { BUILDINGS, BORIS_LINES, BuildingKind, Level } from '../data/buildings';
import { FarmMap, Slot, slotGeometry } from '../map/bosque';
import { iso } from '../map/iso';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';
import type { Light } from '../map/bosque';

const S = 0.5;
const TAP_SLOP = 8; // px a pointer may move and still count as a tap

export interface LightHost { addLight(l: Light): void; fx(key: string, x: number, y: number, scale?: number): void }

interface Site {
  slot: Slot;
  plot: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Zone;
  sprite?: Phaser.GameObjects.Image;
  ghost?: Phaser.GameObjects.Image;
  bar?: Phaser.GameObjects.Graphics;
  site?: Phaser.GameObjects.Image;     // scaffolding while a new building goes up
  worker?: Phaser.GameObjects.Sprite;  // ghoul hammering away
  nextSmoke?: number;
  lit: boolean;
}

export class Buildings {
  private sites = new Map<string, Site>();
  private downAt?: { x: number; y: number };

  constructor(private scene: Phaser.Scene & LightHost, private map: FarmMap, private hud: Hud, private panel: BuildPanel,
    private editorActive: () => boolean) {
    if (scene.textures.exists('ghoul_worker') && !scene.anims.exists('ghoul_work')) {
      scene.anims.create({ key: 'ghoul_work', frames: scene.anims.generateFrameNumbers('ghoul_worker', { frames: [12, 13, 14, 15] }), frameRate: 6, repeat: -1 });
    }
    for (const slot of map.slots) this.createSite(slot);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.downAt = { x: p.x, y: p.y }; });
    // Tapping empty ground closes the panel.
    scene.input.on('pointerup', (p: Phaser.Input.Pointer, over: unknown[]) => { if (!over.length && this.isTap(p)) panel.close(); });
  }

  // ---------- queries used by the simulation ----------
  level(id: string) { return state.buildings[id]?.level ?? 0; }
  levelDef(id: string): Level | undefined {
    const slot = this.map.slots.find(s => s.id === id);
    const lv = this.level(id);
    return slot && lv > 0 ? BUILDINGS[slot.kind].levels[lv - 1] : undefined;
  }
  built(kind: BuildingKind) { return this.map.slots.filter(s => s.kind === kind && this.level(s.id) > 0).map(s => s.id); }
  capacity(id: string) { return this.levelDef(id)?.capacity ?? 0; }
  get totalCapacity() { return this.built('housing').reduce((a, id) => a + this.capacity(id), 0); }

  // ---------- visuals ----------
  private createSite(slot: Slot) {
    const { center } = slotGeometry(slot);
    // Empty plot: darker soil diamond + the stakes-and-rope marker art when available.
    const plot = this.scene.add.graphics().setDepth(-1.85e6);
    const corners = [iso(slot.i, slot.j), iso(slot.i + slot.size, slot.j), iso(slot.i + slot.size, slot.j + slot.size), iso(slot.i, slot.j + slot.size)];
    const hasArt = this.scene.textures.exists('plot_marker');
    plot.fillStyle(0x2a1a10, 0.4).lineStyle(2, 0xe8b54a, hasArt ? 0 : 0.55);
    plot.beginPath(); plot.moveTo(corners[0].x, corners[0].y);
    for (const c of corners.slice(1)) plot.lineTo(c.x, c.y);
    plot.closePath(); plot.fillPath(); plot.strokePath();
    if (hasArt) {
      const mk = this.scene.add.image(center.x, center.y, 'plot_marker').setScale(S * slot.size / 2).setDepth(center.y - 40);
      plot.on('destroy', () => mk.destroy());
      plot.setData('art', mk);
    } else {
      for (const c of corners) plot.fillStyle(0x6b4a2a, 1).fillRect(c.x - 2, c.y - 12, 4, 12); // corner stakes
    }

    // Tap area: the footprint plus the space above it where the building stands.
    const w = slot.size * 128, h = slot.size * 64 + 140;
    const hit = this.scene.add.zone(center.x, center.y - 70 + slot.size * 16, w * 0.8, h).setInteractive();
    hit.on('pointerup', (p: Phaser.Input.Pointer) => this.onTap(p, slot));

    const site: Site = { slot, plot, hit, lit: false };
    this.sites.set(slot.id, site);
    this.refresh(site);
  }

  private refresh(site: Site) {
    const { slot } = site;
    const st = state.buildings[slot.id];
    const lv = st?.level ?? 0;
    const def = BUILDINGS[slot.kind];
    const building = st?.buildLeft !== undefined;
    site.plot.setVisible(lv === 0 && !building);
    (site.plot.getData('art') as Phaser.GameObjects.Image | undefined)?.setVisible(lv === 0 && !building);
    if (lv > 0) {
      const tex = def.levels[lv - 1].tex;
      if (!site.sprite) site.sprite = this.place(slot, tex);
      else site.sprite.setTexture(tex);
      if (!site.lit && def.light) {
        const { center, front } = slotGeometry(slot);
        const L = def.light;
        const base = slot.kind === 'watch' ? front : center;
        this.scene.addLight({ x: base.x + (L.dx ?? 0), y: base.y, h: L.h, radius: L.radius, color: L.color, intensity: L.intensity, flicker: L.flicker });
        site.lit = true;
      }
    }
    // Construction in progress: translucent preview of the next level + progress bar.
    if (building) {
      const next = def.levels[lv];
      const scaffold = slot.size >= 3 ? 'bld_site_large' : 'bld_site_small';
      if (lv === 0 && !site.site && this.scene.textures.exists(scaffold)) {
        site.site = this.place(slot, scaffold).setScale(S * Math.min(1, slot.size / 2));
      } else if (!site.site && !site.ghost) {
        site.ghost = this.place(slot, next.tex).setAlpha(0.35).setTint(0x8899cc);
      }
      if (!site.worker && this.scene.anims.exists('ghoul_work')) {
        const { front } = slotGeometry(slot);
        site.worker = this.scene.add.sprite(front.x - slot.size * 40, front.y - slot.size * 14, 'ghoul_worker', 12)
          .setOrigin(0.5, 1).setScale(S).play('ghoul_work');
        site.worker.setDepth(site.worker.y + 50);
      }
      if (!site.bar) site.bar = this.scene.add.graphics().setDepth(2.25e6);
    } else {
      site.ghost?.destroy(); site.ghost = undefined;
      site.site?.destroy(); site.site = undefined;
      site.worker?.destroy(); site.worker = undefined;
      site.bar?.destroy(); site.bar = undefined;
    }
  }

  private place(slot: Slot, tex: string) {
    const { front, center } = slotGeometry(slot);
    return this.scene.add.image(front.x, front.y + 6, tex).setOrigin(0.5, 1).setScale(S).setDepth(center.y + 2);
  }

  update(dt: number) {
    for (const site of this.sites.values()) {
      const st = state.buildings[site.slot.id];
      if (st?.buildLeft === undefined) continue;
      st.buildLeft -= dt;
      const next = BUILDINGS[site.slot.kind].levels[st.level];
      const pct = Phaser.Math.Clamp(1 - st.buildLeft / next.buildMs, 0, 1);
      if (site.bar) {
        const { center } = slotGeometry(site.slot);
        const z = this.scene.cameras.main.zoom, bw = 70 / z, bh = 7 / z, y = center.y - 120;
        site.bar.clear().fillStyle(0x140a10, 0.9).fillRect(center.x - bw / 2 - 2 / z, y - 2 / z, bw + 4 / z, bh + 4 / z)
          .fillStyle(0xe8b54a, 1).fillRect(center.x - bw / 2, y, bw * pct, bh);
      }
      if (site.ghost) site.ghost.setAlpha(0.3 + pct * 0.4);
      const now = this.scene.time.now;
      if (now > (site.nextSmoke ?? 0)) {
        site.nextSmoke = now + 2200;
        const { center } = slotGeometry(site.slot);
        this.scene.fx('fx_smoke', center.x + Phaser.Math.Between(-30, 30), center.y - 20);
      }
      if (st.buildLeft <= 0) this.finish(site);
    }
  }

  // ---------- actions ----------
  private onTap(p: Phaser.Input.Pointer, slot: Slot) {
    if (this.editorActive() || !this.isTap(p)) return;
    this.openPanel(slot);
  }

  private isTap(p: Phaser.Input.Pointer) {
    return !this.downAt || Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y) <= TAP_SLOP;
  }

  openPanel(slot: Slot) {
    const def = BUILDINGS[slot.kind];
    const st = state.buildings[slot.id];
    const lv = st?.level ?? 0;
    const cur = lv > 0 ? def.levels[lv - 1] : undefined;
    const next = def.levels[lv];
    const building = st?.buildLeft !== undefined;
    this.panel.open({
      title: def.name,
      subtitle: lv === 0 ? 'Lote vazio' : `Nível ${lv}${next ? ` de ${def.levels.length}` : ' (máximo)'}`,
      desc: (building ? next : cur ?? next)?.desc ?? '',
      stats: this.stats(slot.kind, cur, next),
      action: building ? { label: 'Em obras…', disabled: true }
        : next ? { label: `${lv === 0 ? 'Construir' : 'Melhorar'} · ${next.cost} Ouro`, disabled: state.resources.gold < next.cost, onClick: () => this.start(slot) }
        : undefined,
    });
  }

  private stats(kind: BuildingKind, cur?: Level, next?: Level): string[] {
    const fmt = (l?: Level) => {
      if (!l) return '—';
      if (kind === 'housing') return `${l.capacity} moradores`;
      if (kind === 'collect') return `${l.blood} Sangue por coleta · ${(l.collectMs! / 1000).toFixed(1)} s`;
      if (kind === 'food') return `refeição de ${(l.eatMs! / 1000).toFixed(1)} s`;
      return '';
    };
    const out: string[] = [];
    if (cur && fmt(cur)) out.push(`Atual: ${fmt(cur)}`);
    if (next && fmt(next)) out.push(`${cur ? 'Próximo' : 'Ao construir'}: ${fmt(next)}`);
    return out;
  }

  private start(slot: Slot) {
    const lv = this.level(slot.id);
    const next = BUILDINGS[slot.kind].levels[lv];
    if (!next || state.resources.gold < next.cost) { this.hud.toast(`Bóris: ${Phaser.Utils.Array.GetRandom(BORIS_LINES.poor)}`, 'bad'); return; }
    state.resources.gold -= next.cost;
    state.buildings[slot.id] = { level: lv, buildLeft: next.buildMs };
    this.panel.close();
    this.hud.toast(`Bóris: ${Phaser.Utils.Array.GetRandom(BORIS_LINES.started)}`);
    this.refresh(this.sites.get(slot.id)!);
  }

  private finish(site: Site) {
    const st = state.buildings[site.slot.id];
    const oldLevel = st.level;
    st.level++;
    delete st.buildLeft;
    this.refresh(site);
    const spr = site.sprite!;
    const { center } = slotGeometry(site.slot);
    this.scene.fx('fx_sparkle', center.x, center.y - 50, 1.5);
    spr.setScale(S * 0.92);
    this.scene.tweens.add({ targets: spr, scale: S, duration: 450, ease: 'Back.easeOut' });
    const def = BUILDINGS[site.slot.kind];
    if (oldLevel === 0) bus.emit('BUILDING_BUILT', { buildingId: site.slot.id, kind: site.slot.kind, level: st.level });
    else bus.emit('BUILDING_UPGRADED', { buildingId: site.slot.id, kind: site.slot.kind, oldLevel, newLevel: st.level });
    this.hud.toast(`${def.name} ${oldLevel === 0 ? 'construída' : `nível ${st.level}`}. Bóris: ${Phaser.Utils.Array.GetRandom(BORIS_LINES.built)}`, 'good');
  }
}
