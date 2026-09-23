// Nightly tithe (GDD_ADENDO A1): the castle carriage arrives near the end of every night and collects
// the Blood quota. If it's short, it takes random humans instead.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state, quotaFor, takenFor, titheGold, NIGHT_MS, CARRIAGE_LEAD_MS, MAX_STRIKES } from '../core/state';
import { tileCenter } from '../map/iso';
import type { Humans } from './Humans';
import type { Hud } from '../ui/Hud';

const GATE: [number, number] = [21, 33];     // inside tile at the main gate
const STOP = tileCenter(21, 36);             // where the carriage waits on the road
const COLLECTOR_SPOT = tileCenter(21, 34);   // the castle's clerk waits just outside the gate

interface FxHost { fx(key: string, x: number, y: number, scale?: number): void }

export class Tithe {
  private carriage?: Phaser.GameObjects.Image;
  private arrived = false;
  private settling = false;
  private clerk?: Phaser.GameObjects.Sprite;
  private departing = false;

  constructor(private scene: Phaser.Scene & FxHost, private humans: Humans, private hud: Hud) {
    const a = scene.anims;
    if (scene.textures.exists('vampire_buyer') && !a.exists('vb_back')) {
      a.create({ key: 'vb_front', frames: a.generateFrameNumbers('vampire_buyer', { frames: [0, 1, 2, 3] }), frameRate: 7, repeat: -1 });
      a.create({ key: 'vb_back', frames: a.generateFrameNumbers('vampire_buyer', { frames: [4, 5, 6, 7] }), frameRate: 7, repeat: -1 });
      a.create({ key: 'vb_idle', frames: a.generateFrameNumbers('vampire_buyer', { frames: [8, 9] }), frameRate: 2, repeat: -1 });
      a.create({ key: 'vb_tap', frames: a.generateFrameNumbers('vampire_buyer', { frames: [14, 15] }), frameRate: 3, repeat: -1 });
    }
  }

  update(dt: number) {
    if (this.settling) return;
    const n = state.night;
    n.elapsed += dt;
    if (!this.arrived && n.elapsed >= NIGHT_MS - CARRIAGE_LEAD_MS) this.arrive();
    if (n.elapsed >= NIGHT_MS) this.settle();
  }

  // Quota already met: call the carriage now instead of waiting for the night to end.
  payNow() {
    const n = state.night;
    if (this.settling || state.resources.blood < quotaFor(n.night)) return;
    if (!this.arrived) this.arrive();
    n.elapsed = Math.max(n.elapsed, NIGHT_MS - 6000);
  }

  private arrive() {
    this.arrived = true;
    const c = this.scene.add.image(STOP.x + 60, STOP.y + 30, 'carriage').setOrigin(0.5, 1).setScale(0.5)
      .setAlpha(0).setDepth(STOP.y);
    this.carriage = c;
    this.scene.tweens.add({ targets: c, x: STOP.x, y: STOP.y, alpha: 1, duration: 2500, ease: 'Sine.easeOut', onComplete: () => this.clerkOut() });
    bus.emit('CARRIAGE_ARRIVED', { night: state.night.night });
    this.hud.toast(`A carruagem do castelo chegou. Dízimo: ${quotaFor(state.night.night)} de Sangue.`);
    this.humans.react('carriage', 2);
  }

  private settle() {
    this.settling = true;
    const n = state.night, r = state.resources, quota = quotaFor(n.night);
    if (r.blood >= quota) {
      const prestige = 5 + n.night;
      r.blood -= quota;
      r.prestige += prestige;
      const gold = titheGold(quota);
      r.gold += gold;
      bus.emit('TITHE_PAID', { night: n.night, amount: quota, prestige });
      this.hud.toast(`Dízimo pago: ${quota} de Sangue. O castelo pagou ${gold} Ouro. +${prestige} Prestígio.`, 'good');
      this.scene.fx('fx_coins', COLLECTOR_SPOT.x, COLLECTOR_SPOT.y - 60, 1.6);
      this.humans.react('tithe_paid', 2);
      this.scene.time.delayedCall(2500, () => this.depart());
      return;
    }
    // Short: the castle takes all the Blood there is, plus people.
    const deficit = quota - r.blood;
    r.blood = 0;
    n.strikes++;
    const want = takenFor(deficit, quota);
    let pending = 0;
    const done = () => { if (--pending <= 0) this.depart(); };
    pending = this.humans.summon(want, GATE, { x: STOP.x, y: STOP.y - 20 }, done);
    bus.emit('TITHE_FAILED', { night: n.night, deficit, taken: pending, strikes: n.strikes });
    this.hud.toast(`Cota falhou (faltaram ${deficit}). O castelo levou ${pending} humano${pending === 1 ? '' : 's'}. Advertência ${n.strikes}/${MAX_STRIKES}.`, 'bad', 7000);
    if (n.strikes >= MAX_STRIKES) {
      bus.emit('MANDATE_REVOKED', { night: n.night });
      this.hud.toast('O Conde Vesper confiscaria a propriedade agora. (Fim de mandato chega na Fase 12.)', 'bad', 9000);
    }
    this.scene.time.delayedCall(1500, () => this.humans.react('tithe_failed', 2));
    if (pending === 0) this.scene.time.delayedCall(2500, () => this.depart());
    else this.scene.time.delayedCall(60000, () => { if (this.settling) this.depart(); }); // safety net if someone gets stuck
  }

  // The castle's clerk steps down and waits at the gate with visible impatience.
  private clerkOut() {
    if (!this.scene.anims.exists('vb_back') || this.clerk) return;
    const k = this.scene.add.sprite(STOP.x + 30, STOP.y - 10, 'vampire_buyer', 4).setOrigin(0.5, 1).setScale(0.5).play('vb_back');
    this.clerk = k;
    this.scene.tweens.add({
      targets: k, x: COLLECTOR_SPOT.x + 20, y: COLLECTOR_SPOT.y, duration: 2200,
      onUpdate: () => k.setDepth(k.y), onComplete: () => k.play('vb_tap'),
    });
  }

  private clerkBack(done: () => void) {
    const k = this.clerk;
    if (!k) return done();
    this.clerk = undefined;
    this.scene.tweens.killTweensOf(k);
    k.play('vb_front').setFlipX(true);
    this.scene.tweens.add({
      targets: k, x: STOP.x + 30, y: STOP.y - 10, alpha: 0, duration: 1800,
      onUpdate: () => k.setDepth(k.y), onComplete: () => { k.destroy(); done(); },
    });
  }

  private depart() {
    if (!this.settling || this.departing) return;
    this.departing = true;
    this.clerkBack(() => this.driveOff());
  }

  private driveOff() {
    const c = this.carriage;
    if (c) {
      this.scene.tweens.add({
        targets: c, x: c.x - 320, y: c.y + 160, alpha: 0, duration: 4000, ease: 'Sine.easeIn',
        onUpdate: () => c.setDepth(c.y), onComplete: () => c.destroy(),
      });
    }
    this.carriage = undefined;
    this.arrived = false;
    this.settling = false;
    this.departing = false;
    const n = state.night;
    n.night++;
    n.elapsed = 0;
    bus.emit('NIGHT_STARTED', { night: n.night, quota: quotaFor(n.night) });
    this.hud.toast(`Noite ${n.night} começou. Nova cota: ${quotaFor(n.night)} de Sangue.`);
  }
}
