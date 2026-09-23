import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { BattleScene } from './scenes/BattleScene';
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
  input: { mouse: { preventDefaultWheel: true } },
  disableContextMenu: true, // long-press on phones shouldn't open the browser menu
  scene: [FarmScene, BattleScene],
});

// Dev-only handle for inspecting state from the browser console.
if (import.meta.env.DEV) Object.assign(window as any, { game, hemo: { state } });

// Installable PWA: cache the game so it opens instantly and works offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* not critical */ }));
}
