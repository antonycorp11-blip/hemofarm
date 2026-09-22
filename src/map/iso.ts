// Isometric 2:1 projection. (i, j) are tile-grid coords; iso(i, j) is the TOP corner of tile (i, j).
// +i goes down-right on screen, +j goes down-left.
export const TILE_W = 128;
export const TILE_H = 64;

export function iso(i: number, j: number) {
  return { x: (i - j) * (TILE_W / 2), y: (i + j) * (TILE_H / 2) };
}

export function tileCenter(i: number, j: number) {
  return iso(i + 0.5, j + 0.5);
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
