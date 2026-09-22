import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { state } from './core/state';

// Some embedded browsers report WebGL support but fail to create a context: probe first.
const hasWebGL = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
})();

const game = new Phaser.Game({
  type: hasWebGL ? Phaser.WEBGL : Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#070b14',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, roundPixels: false },
  scene: [FarmScene],
});

// Dev-only handle for inspecting state from the browser console.
if (import.meta.env.DEV) Object.assign(window as any, { game, hemo: { state } });
