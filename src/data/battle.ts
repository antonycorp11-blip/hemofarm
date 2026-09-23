// "Vampiros vs. Lobisomens" (GDD_ADENDO A6): lane defense, 5 lanes × 9 cells, Blood is the currency.
export type UnitId = 'chalice' | 'sentinel' | 'wall' | 'gargoyle' | 'alchemist' | 'bats';
export type WolfId = 'scout' | 'hunter' | 'brute' | 'leaper' | 'howler' | 'alpha';

export interface UnitDef {
  name: string; tex: string; cost: number; hp: number; desc: string;
  dmg?: number; rate?: number;          // ms between attacks
  gen?: number;                         // chalice: Blood per pulse
  research?: string;                    // node that unlocks it
  spell?: boolean;                      // bats: one-shot area, no cell occupied
  recharge: number;                     // ms before the card can be used again (PvZ-style)
}

export const UNITS: Record<UnitId, UnitDef> = {
  chalice: { name: 'Cálice', tex: 'blood_chalice', cost: 30, hp: 60, gen: 15, rate: 7000, recharge: 5000, desc: 'Gera Sangue durante a batalha.' },
  sentinel: { name: 'Sentinela', tex: 'sentinel_vampire', cost: 50, hp: 90, dmg: 18, rate: 1400, recharge: 5000, desc: 'Atira na raia inteira à frente.' },
  wall: { name: 'Muralha', tex: 'ghoul_wall', cost: 40, hp: 420, recharge: 12000, desc: 'Ghoul com escudo. Segura o avanço.' },
  gargoyle: { name: 'Gárgula', tex: 'gargoyle', cost: 110, hp: 140, dmg: 160, rate: 20000, recharge: 18000, research: 'n1', desc: 'Abate o primeiro lobisomem que chegar perto e vira pedra por um tempo.' },
  alchemist: { name: 'Alquimista', tex: 'alchemist_unit', cost: 90, hp: 70, dmg: 26, rate: 2600, recharge: 10000, research: 'n4', desc: 'Frascos que atingem em área e deixam lento.' },
  bats: { name: 'Morcegos', tex: 'fx_bat_swarm', cost: 140, hp: 0, dmg: 220, recharge: 30000, research: 'n6', spell: true, desc: 'Nuvem de uso único: arrasa uma área 3×3.' },
};

export interface WolfDef { name: string; tex: string; hp: number; speed: number; dmg: number; reward: number; h: number }

// speed in cells per second · dmg per bite (~every second)
export const WOLVES: Record<WolfId, WolfDef> = {
  scout: { name: 'Batedor', tex: 'wolf_scout', hp: 70, speed: 0.9, dmg: 10, reward: 4, h: 60 },
  hunter: { name: 'Caçador', tex: 'wolf_hunter', hp: 140, speed: 0.55, dmg: 16, reward: 6, h: 66 },
  brute: { name: 'Bruto', tex: 'wolf_brute', hp: 480, speed: 0.33, dmg: 45, reward: 12, h: 80 },
  leaper: { name: 'Saltador', tex: 'wolf_leaper', hp: 110, speed: 0.8, dmg: 12, reward: 7, h: 62 },
  howler: { name: 'Uivador', tex: 'wolf_howler', hp: 100, speed: 0.5, dmg: 8, reward: 8, h: 60 },
  alpha: { name: 'Ulf Quebra-Cerca', tex: 'wolf_alpha', hp: 1400, speed: 0.28, dmg: 60, reward: 40, h: 88 },
};

export const LANES = 5;
export const COLS = 9;

export interface Spawn { at: number; wolf: WolfId; lane: number }
export interface Raid { night: number; big: boolean; spawns: Spawn[]; waves: number[]; endless?: boolean }

// Raids grow with the nights; full moons (every 4th night) are big and may bring Ulf.
export function buildRaid(night: number, big: boolean, tutorial = false, shrink = 0): Raid {
  const spawns: Spawn[] = [];
  // First fight is a lesson: four scouts then one hunter, one at a time, only in the three middle lanes.
  if (tutorial) {
    const seq: WolfId[] = ['scout', 'scout', 'scout', 'scout', 'hunter'];
    seq.forEach((wolf, k) => spawns.push({ at: 6000 + k * 9000, wolf, lane: [2, 1, 3, 2, 2][k] }));
    return { night, big, spawns, waves: [6000] };
  }
  const pool: WolfId[] = tutorial ? ['scout', 'scout', 'hunter'] :
    ['scout', 'scout', 'hunter', 'hunter', ...(night >= 3 ? ['leaper' as WolfId] : []), ...(night >= 4 ? ['brute' as WolfId, 'howler' as WolfId] : []),
      ...(night >= 6 ? ['brute' as WolfId, 'leaper' as WolfId] : [])];
  const count = tutorial ? 5 : Math.max(3, Math.round(((big ? 8 : 4) + night * (big ? 2 : 1.2)) * (1 - shrink))); // gentler early nights, same late curve
  const waves = tutorial ? [0] : big ? [0, 0.45, 0.8] : [0, 0.6];
  const span = tutorial ? 30000 : big ? 110000 : 75000;
  const lanes = [0, 1, 2, 3, 4];
  for (let k = 0; k < count; k++) {
    // Enemies bunch up after each wave flag so waves feel like pushes.
    const w = waves[Math.min(waves.length - 1, Math.floor((k / count) * waves.length))];
    const at = 6000 + w * span + Math.random() * span * (1 / waves.length) * 0.9;
    spawns.push({ at, wolf: pool[Math.floor(Math.random() * pool.length)], lane: lanes[Math.floor(Math.random() * LANES)] });
  }
  if (big && night >= 4) spawns.push({ at: 6000 + span * 0.85, wolf: 'alpha', lane: 2 });
  spawns.sort((a, b) => a.at - b.at);
  return { night, big, spawns, waves: waves.map(w => 6000 + w * span) };
}

export const BATTLE_LINES = {
  start: 'Um bando pequeno, um lobo de cada vez, pelas raias do meio. Ponha Sentinelas ali!',
  grab: ['Defendam o estoque! Espera. Eu sou o estoque.', 'Eu nunca pensei que torceria pelos vampiros.'],
  win: 'Eles recuaram. Mande a conta da cerca.',
  lose: 'Tecnicamente, a linha defensiva continua existindo. Em vários lugares.',
};

// Blood Moon (endless challenge): wave k of an ever-growing horde, starting at time `at`.
export function endlessWave(k: number, at: number): Spawn[] {
  const pool: WolfId[] = ['scout', 'scout', 'hunter', ...(k >= 3 ? ['leaper' as WolfId] : []), ...(k >= 4 ? ['brute' as WolfId, 'howler' as WolfId] : []),
    ...(k >= 7 ? ['brute' as WolfId, 'leaper' as WolfId] : [])];
  const count = 3 + k * 2;
  const out: Spawn[] = [];
  for (let i = 0; i < count; i++) out.push({ at: at + i * Math.max(900, 3200 - k * 180) + Math.random() * 800, wolf: pool[Math.floor(Math.random() * pool.length)], lane: Math.floor(Math.random() * LANES) });
  if (k % 5 === 0) out.push({ at: at + count * 1500, wolf: 'alpha', lane: 2 });
  return out.sort((a, b) => a.at - b.at);
}

// Unit levels bought with hunt marks (Arsenal): +15% damage, life and chalice output per level.
export const UNIT_MAX_LV = 5;
export const unitLvCost = (lv: number) => (lv + 1) * 3;
