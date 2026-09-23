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

// An exception inside a frame would stop Phaser's loop for good (the game "freezes"). Log it and keep running instead.
const seen = new Set<string>();
const step = game.step.bind(game);
game.step = (time: number, delta: number) => {
  try { step(time, delta); } catch (e) {
    const msg = String((e as Error)?.stack ?? e);
    if (!seen.has(msg)) { seen.add(msg); console.error(e); }
  }
};

// iOS (especially the installed app) reports a stale size after rotating: re-sync the canvas to the real viewport a few times.
const syncSize = () => {
  const w = Math.round(window.visualViewport?.width ?? window.innerWidth), h = Math.round(window.visualViewport?.height ?? window.innerHeight);
  if (Math.abs(game.scale.width - w) > 1 || Math.abs(game.scale.height - h) > 1) game.scale.resize(w, h);
};
const syncSoon = () => [50, 300, 700, 1500].forEach(ms => setTimeout(syncSize, ms));
window.addEventListener('resize', syncSoon);
window.addEventListener('orientationchange', syncSoon);
window.visualViewport?.addEventListener('resize', syncSoon);
game.events.once('ready', syncSoon);

// Dev-only handle for inspecting state from the browser console.
if (import.meta.env.DEV) Object.assign(window as any, { game, hemo: { state } });

// Installable PWA: cache the game so it opens instantly and works offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Check for a new version on every launch and reload once it takes over, so the installed app never runs stale code.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { /* not critical */ });
  });
}
