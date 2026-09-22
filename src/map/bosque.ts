// Map 1 — Bosque Cinzento. Procedural-but-deterministic layout built from tiles and objects.
import { iso, tileCenter, mulberry32 } from './iso';
import type { BuildingKind } from '../data/buildings';

export type TileKind = 'grass' | 'forest' | 'cobble' | 'road' | 'soil' | 'water';
export interface Tile { i: number; j: number; kind: TileKind }
export interface MapObject { id?: string; key: string; x: number; y: number; depth: number; flipX?: boolean; scale?: number }
// (x, y) is the lit ground point; h is the flame height above it; owner is the object it belongs to
export interface Light { x: number; y: number; h: number; radius: number; color: number; intensity: number; flicker: number; owner?: string }
export interface Slot { id: string; i: number; j: number; size: number; kind: BuildingKind }

export interface FarmMap {
  tiles: Tile[];
  decals: MapObject[];
  objects: MapObject[];
  lights: Light[];
  slots: Slot[];
  walkable: Set<string>;               // tiles humans may walk on ("i,j")
  paths: Set<string>;                  // cobblestone tiles (cheaper to walk)
  entries: Record<string, [number, number]>; // slot id -> walkable tile at its door
  social: [number, number][];          // spots where humans gather
  pens: (Pen & { work: [number, number][] })[]; // vegetable plots + walkable tiles along their fence
  bounds: { x: number; y: number; w: number; h: number };
}

// Property (inside the palisade), inclusive tile range on both axes
const P0 = 10, P1 = 33;
const AVENUE = [21, 22];      // i columns of the avenue from the gate (runs along j)
const CROSS = [21, 22];       // j rows of the cross street (runs along i)
const RIVER = [9, 11];        // i + j band
const DMIN = 4, DMAX = 94, EMAX = 38;
export const BOUNDS = { x: -2300, y: -300, w: 4600, h: 3250 };

export interface Pen { id: string; i0: number; i1: number; j0: number; j1: number }
const PENS: Pen[] = [
  { id: 'pen_a', i0: 12, i1: 15, j0: 24, j1: 27 },
  { id: 'pen_b', i0: 12, i1: 15, j0: 29, j1: 31 },
];

export const SLOTS: Slot[] = [
  { id: 'house_a', i: 12, j: 12, size: 2, kind: 'housing' },
  { id: 'house_b', i: 16, j: 11, size: 2, kind: 'housing' },
  { id: 'house_c', i: 12, j: 16, size: 2, kind: 'housing' },
  { id: 'house_d', i: 29, j: 16, size: 2, kind: 'housing' },
  { id: 'collect', i: 25, j: 12, size: 3, kind: 'collect' },
  { id: 'food', i: 17, j: 25, size: 2, kind: 'food' },
  { id: 'food_b', i: 17, j: 16, size: 2, kind: 'food' },
  { id: 'boarding', i: 25, j: 25, size: 3, kind: 'boarding' },
  { id: 'watch', i: 31, j: 30, size: 1, kind: 'watch' },
];

const inside = (i: number, j: number) => i >= P0 && i <= P1 && j >= P0 && j <= P1;
const inPen = (i: number, j: number) => PENS.some(p => i >= p.i0 && i <= p.i1 && j >= p.j0 && j <= p.j1);
const distToProperty = (i: number, j: number) =>
  Math.max(P0 - i, i - P1, P0 - j, j - P1, 0);
const isRoad = (i: number, j: number) => AVENUE.includes(i) && j > P1;
const isPath = (i: number, j: number) => inside(i, j) && (AVENUE.includes(i) || CROSS.includes(j));

function kindAt(i: number, j: number, rnd: () => number): TileKind {
  const d = i + j;
  if (d >= RIVER[0] && d <= RIVER[1]) return 'water';
  if (isRoad(i, j)) return 'road';
  if (inside(i, j)) {
    if (isPath(i, j)) return 'cobble';
    if (inPen(i, j)) return 'soil';
    return 'grass';
  }
  const dist = distToProperty(i, j);
  if (dist <= 2) return 'grass';
  if (dist <= 4) return rnd() < 0.5 ? 'grass' : 'forest';
  return 'forest';
}

const depthOf = (y: number) => y;

export function buildBosque(seed = 7): FarmMap {
  const rnd = mulberry32(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const tiles: Tile[] = [], decals: MapObject[] = [], objects: MapObject[] = [], lights: Light[] = [];
  const walkable = new Set<string>();
  const occupied = new Set<string>();
  const key = (i: number, j: number) => `${i},${j}`;

  const put = (k: string, x: number, y: number, extra: Partial<MapObject> = {}) =>
    objects.push({ id: `${k}@${Math.round(x)},${Math.round(y)}`, key: k, x, y, depth: depthOf(y), ...extra });
  // attaches to the last placed object so the editor can move them together
  const light = (x: number, y: number, h: number, radius: number, color: number, intensity = 1, flicker = 0.08) =>
    lights.push({ x, y, h, radius, color, intensity, flicker, owner: objects[objects.length - 1]?.id });

  // --- building plots: footprints reserved so nature doesn't grow through them (buildings live in state)
  for (const s of SLOTS) {
    for (let a = 0; a < s.size; a++) for (let b = 0; b < s.size; b++) occupied.add(key(s.i + a, s.j + b));
  }

  // --- ground
  for (let d = DMIN; d <= DMAX; d++) {
    for (let e = -EMAX; e <= EMAX; e++) {
      if ((d + e) % 2 !== 0) continue;
      const i = (d + e) / 2, j = (d - e) / 2;
      const kind = kindAt(i, j, rnd);
      tiles.push({ i, j, kind });
      const c = tileCenter(i, j);
      if ((kind === 'grass' || kind === 'forest') && rnd() < (kind === 'grass' ? 0.35 : 0.2)) {
        decals.push({ key: '', x: c.x + (rnd() - 0.5) * 70, y: c.y + (rnd() - 0.5) * 30, depth: 0, flipX: rnd() < 0.5 });
      }
    }
  }

  // --- palisade around the property, gate on the south-west side
  const segNE = (i: number, j: number) => { const m = iso(i, j + 0.5); put('fence_palisade_ne', m.x, m.y + 18, { depth: m.y }); };
  const segNW = (i: number, j: number) => { const m = iso(i + 0.5, j); put('fence_palisade_nw', m.x, m.y + 18, { depth: m.y }); };
  for (let t = P0; t <= P1; t++) {
    segNE(P0, t); segNE(P1 + 1, t); segNW(t, P0);
    if (t < AVENUE[0] - 1 || t > AVENUE[1] + 1) segNW(t, P1 + 1);
  }
  for (const [ci, cj] of [[P0, P0], [P1 + 1, P0], [P0, P1 + 1], [P1 + 1, P1 + 1]]) {
    const p = iso(ci, cj); put('fence_palisade_post', p.x, p.y + 6, { depth: p.y + 1 });
  }
  const gate = iso(AVENUE[1], P1 + 1);
  put('gate_main', gate.x, gate.y + 72, { depth: gate.y + 8 });
  for (const di of [-2.2, 2.2]) {
    const g = iso(AVENUE[1] + di, P1 + 1.9);
    put('torch_stand', g.x, g.y, {}); light(g.x, g.y, 85, 110, 0xff9a3c, 1, 0.2);
  }

  // --- pens: soil + low rail fence + banners
  for (const p of PENS) {
    for (let t = p.j0; t <= p.j1; t++) {
      for (const i of [p.i0, p.i1 + 1]) { const m = iso(i, t + 0.5); put('rail_fence_ne', m.x, m.y + 18, { depth: m.y }); }
    }
    for (let t = p.i0; t <= p.i1; t++) {
      for (const j of [p.j0, p.j1 + 1]) { const m = iso(t + 0.5, j); put('rail_fence_nw', m.x, m.y + 18, { depth: m.y }); }
    }
    for (let a = p.i0; a <= p.i1; a++) for (let b = p.j0; b <= p.j1; b++) occupied.add(key(a, b));
    const b = iso(p.i1 + 1.2, p.j0 - 0.2); put('banner_bat', b.x, b.y);
  }

  // --- street furniture along the cross
  const lampTiles = [[20, 20], [23, 20], [20, 23], [23, 23], [20, 31], [23, 31], [20, 12], [23, 12], [12, 20], [31, 23]];
  for (const [i, j] of lampTiles) {
    const c = tileCenter(i, j); occupied.add(key(i, j));
    put('lamp_post', c.x, c.y + 10); light(c.x + 18, c.y + 10, 80, 95, 0xffae52, 0.9, 0.1);
  }
  const props: [string, number, number][] = [
    ['well', 15, 19], ['bench', 19, 14], ['bench', 19, 29], ['crates', 24, 16], ['crates', 28, 20],
    ['barrel', 29, 13], ['barrel', 29, 14], ['crates', 29, 24], ['barrel', 24, 29], ['banner_bat', 24, 11],
    ['torch_stand', 11, 11], ['torch_stand', 32, 11], ['torch_stand', 11, 32],
    ['fire_pit', 19, 19], ['crate_vials', 28, 15], ['mattress_pile', 11, 14], ['hand_cart', 16, 24], ['harvest_basket', 16, 27],
  ];
  for (const [k, i, j] of props) {
    const c = tileCenter(i, j); occupied.add(key(i, j)); put(k, c.x, c.y + 10);
    if (k === 'torch_stand') light(c.x, c.y + 10, 85, 105, 0xff9a3c, 1, 0.2);
    if (k === 'fire_pit') light(c.x, c.y + 10, 20, 120, 0xff7a2a, 1, 0.25);
  }
  const cart = tileCenter(AVENUE[0] - 1, P1 + 6);
  put('carriage', cart.x, cart.y + 20); light(cart.x + 60, cart.y + 20, 70, 70, 0xff3040, 0.6, 0.1);

  // --- nature
  for (const t of tiles) {
    const { i, j, kind } = t;
    if (occupied.has(key(i, j)) || kind === 'water' || kind === 'road' || kind === 'cobble' || kind === 'soil') continue;
    if (AVENUE.some(a => Math.abs(i - a) <= 1) && j > P1) continue; // keep road shoulders clear
    const c = tileCenter(i, j);
    const x = c.x + (rnd() - 0.5) * 50, y = c.y + (rnd() - 0.5) * 24;
    const dist = distToProperty(i, j);
    const r = rnd();
    if (inside(i, j)) {
      if (r < 0.03) { put(pick(['bush_a', 'bush_b', 'rock_c']), x, y, { flipX: rnd() < 0.5 }); occupied.add(key(i, j)); }
    } else if (dist <= 2) {
      if (r < 0.08) put(pick(['bush_a', 'bush_b', 'rock_b', 'rock_c', 'dead_tree_b']), x, y, { flipX: rnd() < 0.5 });
    } else {
      const d = i + j;
      if (d >= RIVER[0] - 1 && d <= RIVER[1] + 1) continue; // open river banks
      const density = dist <= 4 || (d > RIVER[1] && d < P0 * 2) ? 0.3 : 0.62;
      if (r < density) put(pick(['pine_a', 'pine_a', 'pine_b', 'pine_b', 'pine_c']), x, y, { flipX: rnd() < 0.5, scale: 0.85 + rnd() * 0.3 });
      else if (r < density + 0.04) put(pick(['dead_tree_a', 'dead_tree_b']), x, y, { flipX: rnd() < 0.5 });
      else if (r < density + 0.1) put(pick(['rock_a', 'rock_b', 'rock_c', 'bush_a', 'bush_b']), x, y, { flipX: rnd() < 0.5 });
    }
  }

  // --- navigation: everything inside the palisade that isn't built on
  const paths = new Set<string>();
  for (let i = P0; i <= P1; i++) for (let j = P0; j <= P1; j++) {
    if (occupied.has(key(i, j))) continue;
    walkable.add(key(i, j));
    if (isPath(i, j)) paths.add(key(i, j));
  }
  const nearestWalkable = (cands: [number, number][]) => cands
    .filter(([i, j]) => walkable.has(key(i, j)))
    .sort((a, b) => Math.hypot(a[0] - 21.5, a[1] - 21.5) - Math.hypot(b[0] - 21.5, b[1] - 21.5))[0];
  const entries: Record<string, [number, number]> = {};
  for (const s of SLOTS) {
    const ring: [number, number][] = [];
    for (let t = 0; t < s.size; t++) ring.push([s.i + s.size, s.j + t], [s.i + t, s.j + s.size], [s.i - 1, s.j + t], [s.i + t, s.j - 1]);
    const e = nearestWalkable(ring);
    if (e) entries[s.id] = e;
  }
  const social: [number, number][] = [];
  for (const [, i, j] of props.filter(p => p[0] === 'well' || p[0] === 'bench' || p[0] === 'fire_pit')) {
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (walkable.has(key(i + di, j + dj))) social.push([i + di, j + dj]);
  }
  for (const i of AVENUE) for (const j of CROSS) social.push([i, j]);

  const pens = PENS.map(p => {
    const work: [number, number][] = [];
    for (let j = p.j0; j <= p.j1; j++) for (const i of [p.i0 - 1, p.i1 + 1]) if (walkable.has(key(i, j))) work.push([i, j]);
    for (let i = p.i0; i <= p.i1; i++) for (const j of [p.j0 - 1, p.j1 + 1]) if (walkable.has(key(i, j))) work.push([i, j]);
    return { ...p, work };
  });

  return { tiles, decals, objects, lights, slots: SLOTS, walkable, paths, entries, social, pens, bounds: BOUNDS };
}

// Screen anchors of a plot: front (south) corner for the sprite base, center for depth and lights.
export function slotGeometry(s: Slot) {
  return { front: iso(s.i + s.size, s.j + s.size), center: iso(s.i + s.size / 2, s.j + s.size / 2) };
}
