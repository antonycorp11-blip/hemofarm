// Game state + persistence. Pure data: no Phaser here, so UI, quests and simulation can all read it.
import { bus } from './events';

export interface Resources { blood: number; gold: number; prestige: number; food: number }
export interface ContractState { offers: string[]; active?: { id: string; night: number }; done: string[] }
export interface ResearchState { done: string[]; current?: { id: string; left: number } }
export interface WorldState {
  tension: number;                                   // 0..100, partly hidden (GDD §5)
  pause: { collect: number; food: number; build: number }; // ms left
  nextEvent: number;                                 // ms until the next decision event
  recent: string[];
  rebellion: boolean;
}
export interface TutorialState { step: number; count: number; done: boolean }
export interface PlotState { crop: string; growth: number; phase: 'plant' | 'growing' | 'harvest' }
export interface HumanSave { hunger: number; energy: number; morale: number; vitality: number; home: string; tile: [number, number]; look?: string; name?: string;
  traits?: import('../data/humans').HumanTraits; contract?: string; uid?: number; partner?: number; kin?: number }
export interface NightState { night: number; elapsed: number; strikes: number }
export interface BuildingState { level: number; buildLeft?: number }  // buildLeft: ms until the next level is done
export interface SaveData { v: 2; resources: Resources; humans: HumanSave[]; night: NightState; buildings?: Record<string, BuildingState>; plots?: Record<string, PlotState>; tutorial?: TutorialState; contracts?: ContractState; nextUid?: number; research?: ResearchState; world?: WorldState; savedAt: number }

const KEY = 'hemo.save';

// Nights & tithe (GDD_ADENDO A1)
export const NIGHT_MS = 5 * 60 * 1000;
export const CARRIAGE_LEAD_MS = 25 * 1000;   // carriage arrives this long before the night ends
export const MAX_STRIKES = 3;
export const quotaFor = (night: number) => Math.round(40 * Math.pow(1.2, night - 1) / 5) * 5;
export const titheGold = (quota: number) => Math.round(quota * 2 * (state.research.done.includes('l1') ? 1.25 : 1)); // the castle pays for what it takes
export const START_HUMANS = 8;
// Humans taken on a failed tithe: 1 per started third of the quota missing, max 3
export const takenFor = (deficit: number, quota: number) => Math.min(3, Math.max(1, Math.ceil((deficit / quota) * 3)));

export const state = {
  resources: { blood: 0, gold: 300, prestige: 0, food: 40 } as Resources,
  plots: { pen_a: { crop: 'potato', growth: 0, phase: 'growing' } } as Record<string, PlotState>,
  night: { night: 1, elapsed: 0, strikes: 0 } as NightState,
  // New game (GDD T0): two shabby houses, a humble table and a small collection station.
  buildings: { house_a: { level: 1 }, house_b: { level: 1 }, food_b: { level: 1 }, collect: { level: 1 } } as Record<string, BuildingState>,
  tutorial: { step: 0, count: 0, done: false } as TutorialState,
  contracts: { offers: ['rub_recepcao'], done: [] } as ContractState,
  research: { done: [] } as ResearchState,
  world: { tension: 10, pause: { collect: 0, food: 0, build: 0 }, nextEvent: 240000, recent: [], rebellion: false } as WorldState,
  nextUid: 1,  // stable human ids across saves (partners reference them)
  loaded: null as SaveData | null,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data?.v === 1 || data?.v === 2) {
      state.loaded = data;
      state.resources = { food: 40, ...data.resources };
      if (data.plots) state.plots = data.plots;
      if (data.tutorial) state.tutorial = data.tutorial;
      if (data.contracts) state.contracts = data.contracts;
      if (data.research) state.research = data.research;
      if (data.world) state.world = data.world;
      state.nextUid = data.nextUid ?? Math.max(0, ...(data.humans ?? []).map((h: HumanSave) => h.uid ?? 0)) + 1;
      if (data.night) state.night = { ...data.night };
      if (data.buildings) state.buildings = data.buildings;
    }
  } catch { /* corrupt save or storage unavailable: start fresh */ }
}

export function save(humans: HumanSave[]) {
  const data: SaveData = { v: 2, resources: state.resources, humans, night: state.night, buildings: state.buildings, plots: state.plots, tutorial: state.tutorial, contracts: state.contracts, nextUid: state.nextUid, research: state.research, world: state.world, savedAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

// Economy reacts to semantic events instead of being called by the simulation.
bus.on('BLOOD_COLLECTED', ({ amount }) => { state.resources.blood += amount; });
