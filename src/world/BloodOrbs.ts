// Tap rewards: the collection tanks overflow now and then, releasing a winged blood orb.
// Tapping it before it flies away gives bonus Blood — something to do between the big decisions.
import Phaser from 'phaser';
import { state } from '../core/state';
import { sfx } from '../core/sfx';
import { FarmMap, slotGeometry } from '../map/bosque';
import type { Buildings } from './Buildings';

const EVERY = [14000, 24000];
const LIFE = 12000;
const MAX_ON_SCREEN = 3;

interface Host { floatText(x: number, y: number, msg: string, color: string): void; fx(k: string, x: number, y: number, s?: number): void }

export class BloodOrbs {
  private next = 8000;
  private live: Phaser.GameObjects.Sprite[] = [];

  constructor(private scene: Phaser.Scene & Host, private map: FarmMap, private buildings: Buildings) {
    const a = scene.anims;
    if (scene.textures.exists('blood_orb') && !a.exists('orb_float')) {
      a.create({ key: 'orb_float', frames: a.generateFrameNumbers('blood_orb', { frames: [0, 1, 2, 3] }), frameRate: 6, repeat: -1 });
      a.create({ key: 'orb_pop', frames: a.generateFrameNumbers('blood_orb', { frames: [4, 5, 6, 7] }), frameRate: 12 });
    }
  }

  update(dt: number) {
    const lv = this.buildings.level('collect');
    if (!lv || state.world.rebellion || !this.scene.anims.exists('orb_float')) return;
    this.next -= dt;
    if (this.next > 0 || this.live.length >= MAX_ON_SCREEN) return;
    this.next = Phaser.Math.Between(EVERY[0], EVERY[1]);
    this.spawn(lv);
  }

  private spawn(lv: number) {
    const slot = this.map.slots.find(s => s.id === 'collect')!;
    const { center } = slotGeometry(slot);
    const x = center.x + Phaser.Math.Between(-40, 40), y = center.y - 90;
    const orb = this.scene.add.sprite(x, y, 'blood_orb', 0).setScale(0.5).setDepth(2.2e6).play('orb_float');
    // Big hit area: it's a moving target on a phone.
    orb.setInteractive(new Phaser.Geom.Circle(orb.width / 2, orb.height / 2, orb.width * 0.9), Phaser.Geom.Circle.Contains);
    this.live.push(orb);
    const drift = this.scene.tweens.add({
      targets: orb, x: x + Phaser.Math.Between(-120, 120), y: y - Phaser.Math.Between(90, 160), duration: LIFE, ease: 'Sine.easeInOut',
      onComplete: () => this.remove(orb),
    });
    this.scene.tweens.add({ targets: orb, alpha: { from: 1, to: 0.3 }, delay: LIFE - 2500, duration: 2500 });
    orb.once('pointerdown', () => {
      drift.stop();
      orb.disableInteractive();
      const bonus = 5 + lv * 3;
      state.resources.blood += bonus;
      sfx.drop();
      this.scene.floatText(orb.x, orb.y - 10, `+${bonus} Sangue`, '#ff3348');
      orb.play('orb_pop').once('animationcomplete', () => this.remove(orb));
    });
  }

  private remove(orb: Phaser.GameObjects.Sprite) {
    this.live = this.live.filter(o => o !== orb);
    orb.destroy();
  }
}
