// Meta progression across runs (GDD_ADENDO A5): mandates end in Ascension or Confiscation and pay Blood Legacy,
// spent on permanent upgrades of the Vampire House. Stored apart from the run save so "new mandate" keeps it.
import { state } from './state';
import { REGIONS, RegionId } from '../data/regions';

export interface Upgrade { id: string; name: string; desc: string; max: number; cost: (lv: number) => number }

export const UPGRADES: Upgrade[] = [
  { id: 'gold', name: 'Herança Generosa', desc: '+120 Ouro inicial por nível.', max: 5, cost: lv => 6 + lv * 6 },
  { id: 'colonists', name: 'Primeiros Colonos', desc: '+1 humano inicial por nível.', max: 4, cost: lv => 8 + lv * 8 },
  { id: 'stock', name: 'Estoque Selecionado', desc: 'Humanos iniciais têm mais chance de qualidade melhor.', max: 3, cost: lv => 10 + lv * 10 },
  { id: 'tithe', name: 'Dízimo Brando', desc: 'Cota do castelo 8% menor por nível.', max: 3, cost: lv => 12 + lv * 12 },
  { id: 'noble', name: 'Sangue Nobre', desc: '+10% de Sangue por coleta por nível.', max: 3, cost: lv => 12 + lv * 12 },
  { id: 'lab', name: 'Laboratório Pronto', desc: 'Começa com o Laboratório construído.', max: 1, cost: () => 20 },
  { id: 'watch', name: 'Vigília', desc: 'Começa com a Torre de Vigia e o Pátio de Embarque.', max: 1, cost: () => 18 },
];

export interface Meta {
  legacy: number;
  levels: Record<string, number>;
  mandates: number;            // finished mandates
  bestNight: number;
  nextRegion: RegionId;
  mute: boolean;
  album: string[];             // lineages discovered ("rubra:raro", "trait:lunar"), +1% Blood each, forever
  marks: number;               // hunt marks from battle stars, spent on unit levels
  unitLv: Record<string, number>;
  bestWave: number;            // Blood Moon record
}

const KEY = 'hemo.meta';
export const meta: Meta = { legacy: 0, levels: {}, mandates: 0, bestNight: 0, nextRegion: 'bosque', mute: false, album: [], marks: 0, unitLv: {}, bestWave: 0 };

export function loadMeta() {
  try { Object.assign(meta, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh meta */ }
}
export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* storage unavailable */ }
}
export const lv = (id: string) => meta.levels[id] ?? 0;

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
    quota: (1 - 0.08 * lv('tithe')) * (reg.mods.quota ?? 1),
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
  if (lv('lab')) state.buildings.lab = { level: 1 };
  if (lv('watch')) { state.buildings.watch = { level: 1 }; state.buildings.boarding = { level: 1 }; }
  return 8 + lv('colonists') + (reg.mods.startHumans ?? 0);
}
