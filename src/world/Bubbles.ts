// Ambient speech bubbles (GDD §6.3): non-blocking, 2.5–4 s, max 3 on screen, per-speaker cooldown.
import Phaser from 'phaser';
import { BubbleState, LINES } from '../data/lines';

const MAX_ACTIVE = 3;
const SPEAKER_COOLDOWN = 20000;
const DEPTH = 2.2e6; // above the night overlay so text stays readable

export interface Speaker { sprite: Phaser.GameObjects.Sprite; lastSpoke: number; name?: string }

interface Active { box: Phaser.GameObjects.Container; speaker: Speaker; until: number; w: number }

export class Bubbles {
  private active: Active[] = [];
  private lastLine = new Map<BubbleState, string>();

  constructor(private scene: Phaser.Scene) {}

  canSpeak(s: Speaker) {
    return this.active.length < MAX_ACTIVE && this.scene.time.now - s.lastSpoke > SPEAKER_COOLDOWN
      && !this.active.some(a => a.speaker === s);
  }

  // force: story beats (e.g. being taken) bypass the cap and cooldown
  say(s: Speaker, state: BubbleState, force = false) {
    if (!force && !this.canSpeak(s)) return false;
    this.active.find(a => a.speaker === s)?.box.destroy();
    this.active = this.active.filter(a => a.speaker !== s);
    const pool = LINES[state].filter(l => l !== this.lastLine.get(state));
    const line = Phaser.Utils.Array.GetRandom(pool.length ? pool : LINES[state]);
    this.lastLine.set(state, line);

    const text = this.scene.add.text(0, 0, line, {
      fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '26px', color: '#2b1a12',
      wordWrap: { width: 380 }, align: 'center', lineSpacing: 2,
    }).setOrigin(0.5, 1).setScale(0.5); // 2x font at half scale stays crisp when zoomed
    // Named characters get a small header so players learn who they are (GDD §6: familiarity).
    const label = s.name ? this.scene.add.text(0, 0, s.name, {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#7a1020', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setScale(0.5) : undefined;
    const w = Math.max(text.displayWidth, label?.displayWidth ?? 0) + 18, h = text.displayHeight + (label ? label.displayHeight + 2 : 0) + 12;
    const g = this.scene.add.graphics();
    g.fillStyle(0xf1e3c4, 0.96).lineStyle(2, 0x3a2418, 1);
    g.fillRoundedRect(-w / 2, -h - 8, w, h, 7).strokeRoundedRect(-w / 2, -h - 8, w, h, 7);
    g.fillTriangle(-6, -9, 6, -9, 0, 0).lineBetween(-6, -8, 0, 0).lineBetween(6, -8, 0, 0);
    text.setPosition(0, -14);
    label?.setPosition(0, -14 - text.displayHeight - 1);
    const box = this.scene.add.container(0, 0, label ? [g, text, label] : [g, text]).setDepth(DEPTH).setAlpha(0);
    this.scene.tweens.add({ targets: box, alpha: 1, duration: 180 });

    const duration = Phaser.Math.Clamp(1800 + line.length * 30, 2500, 4000);
    s.lastSpoke = this.scene.time.now;
    this.active.push({ box, speaker: s, until: this.scene.time.now + duration, w });
    return true;
  }

  update() {
    const cam = this.scene.cameras.main, now = this.scene.time.now, zoom = cam.zoom, view = cam.worldView;
    for (const a of [...this.active]) {
      const sp = a.speaker.sprite;
      // Keep the whole bubble on screen (narrow phones cut bubbles near the edges).
      const half = (a.w / 2 + 6) / zoom;
      const x = view.width > half * 2 ? Phaser.Math.Clamp(sp.x, view.x + half, view.right - half) : sp.x;
      a.box.setPosition(x, sp.y - sp.displayHeight - 4).setScale(1 / zoom);
      if (now < a.until && sp.visible) continue;
      this.active = this.active.filter(x => x !== a);
      this.scene.tweens.add({ targets: a.box, alpha: 0, duration: 200, onComplete: () => a.box.destroy() });
    }
  }
}
