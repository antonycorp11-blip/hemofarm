// Meta progression across runs (GDD_ADENDO A5): mandates end in Ascension or Confiscation and pay Blood Legacy,
// spent on permanent upgrades of the Vampire House. Stored apart from the run save so "new mandate" keeps it.
import { bus } from './events';
import { state } from './state';
import { REGIONS, RegionId } from '../data/regions';
import { L } from './i18n';

export interface Upgrade { id: string; name: string; desc: string; max: number; cost: (lv: number) => number }

export const UPGRADES: Upgrade[] = [
  { id: 'gold', name: L('Herança Generosa', 'Generous Inheritance'), desc: L('+120 Ouro inicial por nível.', '+120 starting Gold per level.'), max: 5, cost: lv => 6 + lv * 6 },
  { id: 'colonists', name: L('Primeiros Colonos', 'First Settlers'), desc: L('+1 humano inicial por nível.', '+1 starting human per level.'), max: 4, cost: lv => 8 + lv * 8 },
  { id: 'stock', name: L('Estoque Selecionado', 'Selected Stock'), desc: L('Humanos iniciais têm mais chance de qualidade melhor.', 'Starting humans have a better chance of higher quality.'), max: 3, cost: lv => 10 + lv * 10 },
  { id: 'tithe', name: L('Sangria Branda', 'Gentle Bloodletting'), desc: L('Cota do castelo 8% menor por nível.', 'Castle quota 8% lower per level.'), max: 3, cost: lv => 12 + lv * 12 },
  { id: 'noble', name: L('Sangue Nobre', 'Noble Blood'), desc: L('+10% de Sangue por coleta por nível.', '+10% Blood per collection per level.'), max: 3, cost: lv => 12 + lv * 12 },
  { id: 'lab', name: L('Laboratório Pronto', 'Ready Laboratory'), desc: L('Começa com o Laboratório construído.', 'Start with the Laboratory built.'), max: 1, cost: () => 20 },
  { id: 'watch', name: L('Vigília', 'Vigilance'), desc: L('Começa com a Torre de Vigia e o Pátio de Embarque.', 'Start with the Watchtower and the Boarding Yard.'), max: 1, cost: () => 18 },
];

export interface Meta {
  legacy: number;
  levels: Record<string, number>;
  mandates: number;            // finished mandates
  bestNight: number;
  nextRegion: RegionId;
  mute: boolean;
  music?: boolean;             // background music on/off (separate from all sound)
  album: string[];             // lineages discovered ("rubra:raro", "trait:lunar"), +1% Blood each, forever
  marks: number;               // hunt marks from battle stars, spent on unit levels
  unitLv: Record<string, number>;
  bestWave: number;            // Blood Moon record
  cards: string[];             // cards won in the Caçada, available in farm defenses
  huntBest: number;            // deepest floor reached in a Caçada
  hunts: number;
  domains: Record<string, { regent: string; at: number }>; // conquered regions (Domains of the House)
  domainClock: number;         // last time Domain income was paid
  // "The Inheritance" (GDD_ADENDO A9): the story lives across mandates.
  letterSeen?: boolean;        // Aunt Leonor's letter was shown
  diary?: string[];            // diary pages found
  diaryNew?: number;           // pages found but not read yet (HUD badge)
  diaryRead?: string[];        // pages actually opened in the diary (the endings count what you READ)
  soul?: number;               // Heart (+) × Fang (−), −100..100
  endings?: string[];          // endings reached
  flags?: Record<string, number>; // story choices remembered across mandates (consequences, epilogue)
  diaryBurned?: string[];      // pages destroyed for good by a choice
  // Settings
  uiScale?: number;            // 0 = automatic
}

const KEY = 'hemo.meta';
export const meta: Meta = { legacy: 0, levels: {}, mandates: 0, bestNight: 0, nextRegion: 'bosque', mute: false, album: [], marks: 0, unitLv: {}, bestWave: 0, cards: [], huntBest: 0, hunts: 0, domains: {}, domainClock: 0 };

export function loadMeta() {
  try { Object.assign(meta, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh meta */ }
}
export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* storage unavailable */ }
}
export const lv = (id: string) => meta.levels[id] ?? 0;

// Story choices the game remembers and brings back later (GDD_ADENDO A10). Numbers so they can count.
export const flag = (k: string) => meta.flags?.[k] ?? 0;
export function setFlag(k: string, d = 1) {
  (meta.flags ??= {})[k] = (meta.flags[k] ?? 0) + d;
  saveMeta();
}
// Soul tiers used by reactions, bonuses and endings.
export const soulTier = () => ((meta.soul ?? 0) >= 25 ? 'heart' : (meta.soul ?? 0) <= -25 ? 'fang' : 'mid');

// Heart (+) × Fang (−): how the administrator treats the herd, across every mandate (GDD_ADENDO A9).
export function addSoul(d: number) {
  if (!d) return;
  meta.soul = Math.max(-100, Math.min(100, (meta.soul ?? 0) + d));
  saveMeta();
  bus.emit('SOUL_CHANGED', { delta: d, soul: meta.soul });
}

// Prestige needed to ascend in the current mandate grows with experience.
export const goalFor = () => 150 + meta.mandates * 60;

export function legacyFor(ascended: boolean) {
  const r = state.resources;
  return Math.max(5, Math.floor(r.prestige / 5) + state.night.night * 3 + state.contracts.done.length * 3 + (ascended ? 30 : 0));
}

// Modifiers from permanent upgrades + the region of this mandate. Recomputed on every start, never saved.
export function applyMods() {
  const reg = REGIONS[state.region] ?? REGIONS.bosque;
  Object.assign(state.mods, {
    // Telling the Count about Leonor's cellar bought his favor: a lighter quota for good.
    quota: (1 - 0.08 * lv('tithe')) * (reg.mods.quota ?? 1) * (flag('cellarToldCount') ? 0.9 : 1),
    blood: (1 + 0.1 * lv('noble')) * (reg.mods.blood ?? 1),
    regen: reg.mods.regen ?? 1,
    hunger: reg.mods.hunger ?? 1,
    collectTime: reg.mods.collectTime ?? 1,
    researchTime: reg.mods.researchTime ?? 1,
    contractGold: reg.mods.contractGold ?? 1,
    raidChance: reg.mods.raidChance ?? 0.45,
    bigEvery: reg.mods.bigEvery ?? 4,
    unitCost: reg.mods.unitCost ?? 1,
    qualityBoost: 0.15 * lv('stock') + (reg.mods.qualityBoost ?? 0),
  });
}

// Fresh mandate: starting bonuses from the Vampire House.
export function applyNewGame() {
  state.region = meta.nextRegion;
  const reg = REGIONS[state.region];
  state.resources.gold += 120 * lv('gold');
  // Veterans skip the tutorial: each new mandate opens with its region's story chapter instead.
  if (meta.mandates > 0 || Object.keys(meta.domains ?? {}).length) state.tutorial.done = true;
  if (lv('lab')) state.buildings.lab = { level: 1 };
  if (lv('watch')) { state.buildings.watch = { level: 1 }; state.buildings.boarding = { level: 1 }; }
  return 8 + lv('colonists') + (reg.mods.startHumans ?? 0);
}
