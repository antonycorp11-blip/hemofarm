// A tap on the map only counts if it started and ended on the canvas. Phaser also listens on the whole window, so a
// press on an HTML button (a letter, a panel) that sits over a lot or a human would otherwise "click" the map below it.
// Filtering here, instead of stopping the DOM events, keeps Phaser's own pointer bookkeeping intact (stopping touchend
// left touch pointers stuck and froze the map on phones).
import type Phaser from 'phaser';

export const onCanvas = (p: Phaser.Input.Pointer) => {
  const canvas = p.manager.game.canvas;
  return p.downElement === canvas && (!p.upElement || p.upElement === canvas);
};
