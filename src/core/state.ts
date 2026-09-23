// Game state + persistence. Pure data: no Phaser here, so UI, quests and simulation can all read it.
import { bus } from './events';

export interface Resources { blood: number; gold: number; prestige: number; food: number; essence: number }
export interface ContractState { offers: string[]; active?: { id: string; night: number }; done: string[] }
export interface ResearchState { lv: Record<string, number> }   // node id → level bought
export interface Order { kind: string; target: number; progress: number; claimed: boolean }
export interface ConquestState { bestRate: number; cleanWins: number; alphaDown: boolean; introSeen: boolean; bossNight: number; regent?: { name: string; look: string }; beats?: string[] }
export interface OrdersState { night: number; list: Order[]; bonus: boolean }
export interface WorldState {
  tension: number;                                   // 0..100, partly hidden (GDD §5)
  pause: { collect: number; food: number; build: number }; // ms left
  nextEvent: number;                                 // ms until the next decision event
  recent: string[];
  rebellion: boolean;
  overtime?: number;      // ms of 'hora extra' left at the collection station
  resentment?: number;    // ms left of resentment after a repressed rebellion (tension creeps up)
  demands?: { kind: string; cost: number }[]; // the current rebellion's demands
  unrest?: number;        // ms until the next act of vandalism during a rebellion
  cooldown?: Record<string, number>; // ms until a manual action can be used again
  raid?: { night: number; kind: 'none' | 'small' | 'big'; status: 'waiting' | 'warned' | 'done'; warnLeft: number };
}
export interface TutorialState { step: number; count: number; done: boolean }
export interface PlotState { crop: string; growth: number; phase: 'plant' | 'growing' | 'harvest' }
export interface HumanSave { hunger: number; energy: number; morale: number; vitality: number; home: string; tile: [number, number]; look?: string; name?: string;
  traits?: import('../data/humans').HumanTraits; contract?: string; uid?: number; partner?: number; kin?: number }
export interface NightState { night: number; elapsed: number; strikes: number }
export interface BuildingState { level: number; buildLeft?: number }  // buildLeft: ms until the next level is done
export interface SaveData { v: 2; resources: Resources; humans: HumanSave[]; night: NightState; buildings?: Record<string, BuildingState>; plots?: Record<string, PlotState>; tutorial?: TutorialState; contracts?: ContractState; nextUid?: number; research?: ResearchState; world?: WorldState; region?: string; savedAt: number;
  upg?: Record<string, number>; orders?: OrdersState; conquest?: ConquestState; relics?: string[]; relicPick?: string[]; endlessNight?: number }

const KEY = 'hemo.save';

// Nights & tithe (GDD_ADENDO A1)
export const NIGHT_MS = 5 * 60 * 1000;
export const CARRIAGE_LEAD_MS = 25 * 1000;   // carriage arrives this long before the night ends
export const MAX_STRIKES = 3;
export const quotaFor = (night: number) => Math.round(40 * Math.pow(1.2, night - 1) * state.mods.quota * Math.max(0.5, 1 - state.quotaCut) / 5) * 5;
export const titheGold = (quota: number) => Math.round(quota * 2 * (1 + state.titheBonus)); // the castle pays for what it takes
export const START_HUMANS = 8;
// Humans taken on a failed tithe: 1 per started third of the quota missing, max 3
export const takenFor = (deficit: number, quota: number) => Math.min(3, Math.max(1, Math.ceil((deficit / quota) * 3)));

export const state = {
  resources: { blood: 0, gold: 300, prestige: 0, food: 40, essence: 0 } as Resources,
  plots: { pen_a: { crop: 'potato', growth: 0, phase: 'growing' } } as Record<string, PlotState>,
  night: { night: 1, elapsed: 0, strikes: 0 } as NightState,
  // New game (GDD T0): two shabby houses, a humble table and a small collection station.
  buildings: { house_a: { level: 1 }, house_b: { level: 1 }, food_b: { level: 1 }, collect: { level: 1 } } as Record<string, BuildingState>,
  tutorial: { step: 0, count: 0, done: false } as TutorialState,
  contracts: { offers: ['rub_recepcao'], done: [] } as ContractState,
  research: { lv: {} } as ResearchState,
  upg: {} as Record<string, number>,              // building upgrade tracks (data/buildings TRACKS), by building kind
  orders: { night: 0, list: [], bonus: false } as OrdersState,   // Castle orders of this night
  relics: [] as string[],                         // relics picked this mandate
  relicPick: undefined as string[] | undefined,   // offer waiting for the player
  endlessNight: 0,                                // last night the Blood Moon reward was paid
  // Region conquest (GDD_ADENDO A8): production, a vampire Regent, the region's pack defeated.
  conquest: { bestRate: 0, cleanWins: 0, alphaDown: false, introSeen: false, bossNight: 0 } as ConquestState,
  titheBonus: 0,                                  // set by core/bonus (avoids an import cycle)
  quotaCut: 0,
  bloodRate: 0,                                   // Blood/min measured by the HUD (for before → after previews)
  world: { tension: 10, pause: { collect: 0, food: 0, build: 0 }, nextEvent: 240000, recent: [], rebellion: false } as WorldState,
  nextUid: 1,
  region: 'bosque' as import('../data/regions').RegionId,
  ascendOffered: false,
  // Rule modifiers from region + permanent upgrades (core/meta.applyMods); recomputed at start, not saved.
  mods: { quota: 1, blood: 1, regen: 1, hunger: 1, collectTime: 1, researchTime: 1, contractGold: 1, raidChance: 0.45, bigEvery: 4,
    unitCost: 1, qualityBoost: 0 },  // stable human ids across saves (partners reference them)
  loaded: null as SaveData | null,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data?.v === 1 || data?.v === 2) {
      state.loaded = data;
      state.resources = { food: 40, essence: 0, ...data.resources };
      if (data.plots) state.plots = data.plots;
      if (data.tutorial) state.tutorial = data.tutorial;
      if (data.contracts) state.contracts = data.contracts;
      if (data.research) state.research = migrateResearch(data.research);
      if (data.upg) state.upg = data.upg;
      if (data.orders) state.orders = data.orders;
      if (data.relics) state.relics = data.relics;
      state.relicPick = data.relicPick;
      state.endlessNight = data.endlessNight ?? 0;
      if (data.conquest) state.conquest = { ...state.conquest, ...data.conquest };
      if (data.world) state.world = data.world;
      if (data.region) state.region = data.region;
      state.nextUid = data.nextUid ?? Math.max(0, ...(data.humans ?? []).map((h: HumanSave) => h.uid ?? 0)) + 1;
      if (data.night) state.night = { ...data.night };
      if (data.buildings) state.buildings = data.buildings;
    }
  } catch { /* corrupt save or storage unavailable: start fresh */ }
}

export function save(humans: HumanSave[]) {
  const data: SaveData = { v: 2, resources: state.resources, humans, night: state.night, buildings: state.buildings, plots: state.plots, tutorial: state.tutorial, contracts: state.contracts, nextUid: state.nextUid, research: state.research, world: state.world, region: state.region, savedAt: Date.now(),
    upg: state.upg, orders: state.orders, relics: state.relics, relicPick: state.relicPick, endlessNight: state.endlessNight, conquest: state.conquest };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

// Old saves had a flat research list: carry every finished project into the new tree as level 1.
const OLD_IDS: Record<string, string> = { c1: 's1', c2: 's2', c3: 's3', w1: 'r1', w2: 'r2', w3: 'r5', a1: 'r3', a2: 'r4', g1: 'r6', g2: 'r7', g3: 'r8',
  l1: 'n7', l2: 'n8', l3: 'n9', d1: 'n1', d2: 'n4', d3: 'n6' };
function migrateResearch(r: { lv?: Record<string, number>; done?: string[] }): ResearchState {
  if (r.lv) return { lv: r.lv };
  const lv: Record<string, number> = {};
  if (r.done?.length) lv.lab = 1;
  for (const id of r.done ?? []) if (OLD_IDS[id]) lv[OLD_IDS[id]] = 1;
  return { lv };
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

// Economy reacts to semantic events instead of being called by the simulation.
bus.on('BLOOD_COLLECTED', ({ amount }) => { state.resources.blood += amount; });
