// One place that adds up every bonus: research levels, building upgrade tracks, relics and the lineage album.
// Systems ask fx('blood') and get the summed value (e.g. 0.24 = +24%). Cached; invalidate() after anything changes.
import { state } from './state';
import { meta } from './meta';
import { NODES, Fx } from '../data/research';
import { RELICS } from '../data/relics';
import { TRACKS } from '../data/buildings';

let cache: Partial<Record<Fx, number>> | null = null;

export function invalidate() {
  cache = null;
  state.titheBonus = fx('titheGold');
  state.quotaCut = fx('quota');
}

function compute() {
  const c: Partial<Record<Fx, number>> = {};
  const add = (k: Fx, v: number) => { c[k] = (c[k] ?? 0) + v; };
  for (const n of NODES) {
    const l = state.research.lv[n.id] ?? 0;
    if (l && n.fx) for (const [k, v] of n.fx) add(k, v * l);
  }
  for (const [kind, t] of Object.entries(TRACKS)) {
    const l = state.upg[kind] ?? 0;
    if (l && t) add(t.fx[0], t.fx[1] * l);
  }
  for (const id of state.relics) for (const [k, v] of RELICS[id]?.fx ?? []) add(k, v);
  add('blood', (meta.album?.length ?? 0) * 0.01);   // every lineage discovered: +1% Blood forever
  add('blood', Object.keys(meta.domains ?? {}).length * 0.05); // every Domain of the House: +5% Blood
  return c;
}

export function fx(k: Fx): number {
  cache ??= compute();
  return cache[k] ?? 0;
}

// "+12/min → +18/min": what a Blood bonus change would do to the measured production.
export function ratePreview(extra: number) {
  const now = state.bloodRate;
  if (!now || !extra) return '';
  const base = 1 + fx('blood');
  return `Sangue: +${now}/min → +${Math.round(now * (base + extra) / base)}/min`;
}

// Multiplier helpers for the common cases.
export const more = (k: Fx) => 1 + fx(k);                        // +x%
export const less = (k: Fx, floor = 0.3) => Math.max(floor, 1 - fx(k)); // −x%, never below the floor
