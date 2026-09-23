// "Vampiros vs. Lobisomens" (GDD_ADENDO A6/A7): lane defense, Blood is the currency.
// Units and wolves are data-driven by `kind`; new ones without their own art use an existing sheet + tint (`art` takes over once it exists).
export type UnitId = 'chalice' | 'sentinel' | 'wall' | 'gargoyle' | 'alchemist' | 'bats'
  | 'maid' | 'crossbow' | 'lancer' | 'witch' | 'coffin' | 'lantern' | 'batwatch' | 'count';
export type WolfId = 'scout' | 'hunter' | 'brute' | 'leaper' | 'howler' | 'alpha'
  | 'digger' | 'shaman' | 'armored' | 'pups' | 'pup' | 'raven' | 'storm' | 'mother';
export type UnitKind = 'gen' | 'shoot' | 'wall' | 'garg' | 'alch' | 'spell' | 'mine' | 'aura' | 'pierce' | 'fog' | 'air' | 'hero';

export interface UnitDef {
  name: string; tex: string; cost: number; hp: number; desc: string; kind: UnitKind;
  dmg?: number; rate?: number;          // ms between attacks
  gen?: number;                         // generators: Blood per pulse
  range?: number;                       // cells ahead (pierce / fog / air)
  research?: string;                    // node that unlocks it (farm defenses)
  hunt?: boolean;                       // unlocked by the Caçada (farm defenses need meta.cards)
  spell?: boolean;                      // one-shot, no cell occupied
  recharge: number;                     // ms before the card can be used again (PvZ-style)
  art?: string; tint?: number; scale?: number;
  fr?: { idle: number[]; act: number[] }; // frames of the sheet used for idle / action
}

const SENT = { idle: [8, 9], act: [10, 11] }, CHAL = { idle: [0, 1, 2, 3], act: [4, 5, 6, 7] }, ALCH = { idle: [12, 13], act: [8, 9, 10, 11] };

export const UNITS: Record<UnitId, UnitDef> = {
  chalice: { name: 'Cálice', kind: 'gen', tex: 'blood_chalice', cost: 30, hp: 60, gen: 15, rate: 7000, recharge: 5000, fr: CHAL, desc: 'Gera Sangue durante a batalha.' },
  sentinel: { name: 'Sentinela', kind: 'shoot', tex: 'sentinel_vampire', cost: 50, hp: 100, dmg: 22, rate: 1300, recharge: 5000, fr: SENT, desc: 'Atira na raia inteira à frente.' },
  wall: { name: 'Muralha', kind: 'wall', tex: 'ghoul_wall', cost: 40, hp: 520, recharge: 12000, fr: { idle: [0, 1], act: [0, 1] }, desc: 'Ghoul com escudo. Segura o avanço.' },
  gargoyle: { name: 'Gárgula', kind: 'garg', tex: 'gargoyle', cost: 110, hp: 140, dmg: 160, rate: 20000, recharge: 18000, research: 'n1', fr: { idle: [0, 1, 2, 3], act: [8, 9, 10, 11] },
    desc: 'Abate o primeiro lobisomem que chegar perto e vira pedra por um tempo.' },
  alchemist: { name: 'Alquimista', kind: 'alch', tex: 'alchemist_unit', cost: 90, hp: 70, dmg: 26, rate: 2600, recharge: 10000, research: 'n4', fr: ALCH,
    desc: 'Frascos que atingem em área e deixam lento.' },
  bats: { name: 'Morcegos', kind: 'spell', tex: 'fx_bat_swarm', cost: 140, hp: 0, dmg: 220, recharge: 30000, research: 'n6', spell: true, desc: 'Nuvem de uso único: arrasa uma área 3×3.' },
  // A7 — new cards (Caçada unlocks them for the farm)
  maid: { name: 'Criada de Sangue', kind: 'gen', tex: 'blood_chalice', art: 'unit_maid', tint: 0xffb8d0, scale: 0.85, cost: 20, hp: 50, gen: 8, rate: 8000, recharge: 6000, hunt: true, fr: CHAL,
    desc: 'Gerador barato: pouco Sangue, mas custa quase nada.' },
  crossbow: { name: 'Besteira de Prata', kind: 'shoot', tex: 'sentinel_vampire', art: 'unit_crossbow', tint: 0xc8dcff, cost: 75, hp: 90, dmg: 16, rate: 1300, recharge: 7000, hunt: true, fr: SENT,
    desc: 'Virotes de prata: dano dobrado em lobos já feridos.' },
  lancer: { name: 'Lanceiro Carmesim', kind: 'pierce', tex: 'sentinel_vampire', art: 'unit_lancer', tint: 0xff8a8a, cost: 90, hp: 180, dmg: 30, rate: 1600, range: 2, recharge: 8000, hunt: true, fr: SENT,
    desc: 'Estocada que atravessa todos os lobos nas 2 casas à frente. Também segura o avanço.' },
  witch: { name: 'Bruxa da Névoa', kind: 'fog', tex: 'alchemist_unit', art: 'unit_witch', tint: 0xc8a8ff, cost: 80, hp: 70, dmg: 6, rate: 1000, range: 3, recharge: 12000, hunt: true, fr: ALCH,
    desc: 'Névoa permanente nas 3 casas à frente: lobos ali ficam lentos e sofrem dano.' },
  coffin: { name: 'Caixão-Armadilha', kind: 'mine', tex: 'ghoul_wall', art: 'unit_coffin_trap', tint: 0x9a7a60, scale: 0.8, cost: 50, hp: 999, dmg: 320, recharge: 20000, hunt: true,
    fr: { idle: [0], act: [0] }, desc: 'Explode quando um lobo pisa na casa: dano enorme na casa e nas vizinhas da raia.' },
  lantern: { name: 'Lanterna de Sangue', kind: 'aura', tex: 'blood_chalice', art: 'unit_lantern', tint: 0xffa040, cost: 60, hp: 80, recharge: 10000, hunt: true, fr: CHAL,
    desc: 'Vampiros nas 8 casas em volta causam +25% de dano.' },
  batwatch: { name: 'Morcego Vigia', kind: 'air', tex: 'gargoyle', art: 'unit_bat_watch', tint: 0xa0a0e0, scale: 0.85, cost: 70, hp: 70, dmg: 22, rate: 1000, range: 4, recharge: 8000, hunt: true,
    fr: { idle: [0, 1, 2, 3], act: [8, 9, 10, 11] }, desc: 'Caça Saltadores e voadores nas 4 casas à frente, e derruba o Corvo de Ulf.' },
  count: { name: 'Conde Valério', kind: 'hero', tex: 'sentinel_vampire', art: 'unit_count', tint: 0xffd870, scale: 1.2, cost: 150, hp: 650, dmg: 45, rate: 900, recharge: 60000, hunt: true, fr: SENT,
    desc: 'Herói (um por batalha): segura a raia e golpeia tudo o que encosta.' },
};

// Wolves that get past a defender on purpose, and how (shown in the horde preview so it never feels like a bug).
export const BYPASS: Partial<Record<WolfId, string>> = { leaper: 'pula a 1ª defesa', digger: 'cava por baixo da 1ª defesa', raven: 'voa por cima de tudo (só tiros o acertam)' };

export interface WolfDef {
  name: string; tex: string; hp: number; speed: number; dmg: number; reward: number; h: number;
  art?: string; tint?: number; scale?: number;
  armor?: number; fly?: boolean; dig?: boolean; heal?: boolean; storm?: boolean; summon?: boolean; boss?: boolean;
}

// speed in cells per second · dmg per bite (~every second)
export const WOLVES: Record<WolfId, WolfDef> = {
  scout: { name: 'Batedor', tex: 'wolf_scout', hp: 70, speed: 0.9, dmg: 10, reward: 4, h: 60 },
  hunter: { name: 'Caçador', tex: 'wolf_hunter', hp: 140, speed: 0.55, dmg: 16, reward: 6, h: 66 },
  brute: { name: 'Bruto', tex: 'wolf_brute', hp: 480, speed: 0.33, dmg: 45, reward: 12, h: 80 },
  leaper: { name: 'Saltador', tex: 'wolf_leaper', hp: 110, speed: 0.8, dmg: 12, reward: 7, h: 62 },
  howler: { name: 'Uivador', tex: 'wolf_howler', hp: 100, speed: 0.5, dmg: 8, reward: 8, h: 60 },
  alpha: { name: 'Ulf Quebra-Cerca', tex: 'wolf_alpha', hp: 1400, speed: 0.28, dmg: 60, reward: 40, h: 88 },
  digger: { name: 'Escavador', tex: 'wolf_scout', art: 'wolf_digger', tint: 0xb89070, hp: 90, speed: 0.8, dmg: 10, reward: 6, h: 60, dig: true },
  shaman: { name: 'Xamã', tex: 'wolf_howler', art: 'wolf_shaman', tint: 0x90ffb0, hp: 110, speed: 0.45, dmg: 6, reward: 9, h: 60, heal: true },
  armored: { name: 'Couraçado', tex: 'wolf_brute', art: 'wolf_armored', tint: 0xb0b8c8, hp: 300, speed: 0.4, dmg: 20, reward: 10, h: 78, armor: 8 },
  pups: { name: 'Filhotes', tex: 'wolf_scout', art: 'wolf_pups', hp: 105, speed: 1.2, dmg: 12, reward: 6, h: 46 }, // with its own art: one trio; without: three `pup`
  pup: { name: 'Filhote', tex: 'wolf_scout', tint: 0xe0d0c0, scale: 0.6, hp: 35, speed: 1.3, dmg: 5, reward: 2, h: 40 },
  raven: { name: 'Corvo de Ulf', tex: 'wolf_leaper', art: 'wolf_raven', tint: 0x50506a, scale: 0.8, hp: 60, speed: 1, dmg: 8, reward: 6, h: 50, fly: true },
  storm: { name: 'Uivador da Tempestade', tex: 'wolf_howler', art: 'wolf_storm', tint: 0x90c8ff, hp: 140, speed: 0.5, dmg: 8, reward: 10, h: 62, storm: true },
  mother: { name: 'Mãe da Matilha', tex: 'wolf_alpha', art: 'wolf_mother', tint: 0xe8e8ff, scale: 1.25, hp: 2600, speed: 0.22, dmg: 70, reward: 80, h: 100, summon: true, boss: true },
};

export const COLS = 9;
export const LANES = 5; // default arena

// ---------- weather (A7): drawn per battle, shown during preparation ----------
export type WeatherId = 'clear' | 'rain' | 'fog' | 'fullmoon' | 'storm' | 'snow' | 'eclipse';
export const WEATHER: Record<WeatherId, { name: string; desc: string; icon: string; weight: number }> = {
  clear: { name: 'Noite limpa', desc: 'Sem efeitos.', icon: '☾', weight: 40 },
  rain: { name: 'Chuva', desc: 'Cálices +25% · Sentinelas atiram 20% mais devagar.', icon: '🌧', weight: 14 },
  fog: { name: 'Névoa', desc: 'Lobos só aparecem nas últimas 5 casas.', icon: '🌫', weight: 12 },
  fullmoon: { name: 'Lua Cheia', desc: 'Lobos +25% de vida e velocidade · recompensa em dobro.', icon: '🌕', weight: 0 },
  storm: { name: 'Tempestade', desc: 'Raios caem em casas aleatórias (lobos e vampiros).', icon: '⛈', weight: 10 },
  snow: { name: 'Neve', desc: 'Todos 20% mais lentos: lobos andam e vampiros atacam devagar.', icon: '❄', weight: 12 },
  eclipse: { name: 'Eclipse', desc: 'Vampiros +30% de dano.', icon: '🌑', weight: 12 },
};
export function rollWeather(big: boolean): WeatherId {
  if (big) return 'fullmoon';
  const ids = Object.keys(WEATHER) as WeatherId[];
  let r = Math.random() * ids.reduce((a, k) => a + WEATHER[k].weight, 0);
  for (const k of ids) { r -= WEATHER[k].weight; if (r <= 0) return k; }
  return 'clear';
}

// ---------- arenas (A7): each region fights on its own ground ----------
export type ArenaId = 'farm' | 'swamp' | 'grave' | 'bridge' | 'fire' | 'castle';
export interface Arena {
  name: string; lanes: number; desc: string;
  ground: string[]; groundTint?: number; back: string; forest: string;
  water?: number[];            // lanes of water: wolves 40% slower
  flooded?: number;            // random flooded cells: no units there
  blocked?: number;            // tombstones: no units there
  fire?: boolean;              // cells ignite now and then
  art?: { ground?: string; water?: string; block?: string };
}
export const ARENAS: Record<ArenaId, Arena> = {
  farm: { name: 'Portão da Fazenda', lanes: 5, desc: 'A cerca de sempre.', ground: ['tile_grass_a', 'tile_grass_b'], back: 'tile_cobble_a', forest: 'tile_forest_floor' },
  swamp: { name: 'Pântano Carmesim', lanes: 5, desc: 'Raias de água deixam os lobos lentos; casas alagadas não aceitam defensores.',
    ground: ['tile_soil'], groundTint: 0x9a8a9a, back: 'tile_cobble_b', forest: 'tile_forest_floor', water: [1, 3], flooded: 5,
    art: { ground: 'tile_swamp_mud', water: 'tile_swamp_water' } },
  grave: { name: 'Cemitério', lanes: 5, desc: 'Lápides ocupam casas: planeje em volta delas.', ground: ['tile_soil', 'tile_grass_b'], groundTint: 0x8a8aa0,
    back: 'tile_cobble_a', forest: 'tile_forest_floor', blocked: 7, art: { ground: 'tile_grave_soil', block: 'tombstone_set' } },
  bridge: { name: 'Ponte do Rio', lanes: 3, desc: 'Só três raias: tudo passa por aqui.', ground: ['tile_dirt_road'], groundTint: 0xb08a60,
    back: 'tile_cobble_a', forest: 'tile_water', art: { ground: 'tile_bridge' } },
  fire: { name: 'Floresta em Chamas', lanes: 5, desc: 'Casas pegam fogo de vez em quando e queimam quem estiver nelas.', ground: ['tile_forest_floor'], groundTint: 0xb07a60,
    back: 'tile_cobble_b', forest: 'tile_forest_floor', fire: true, art: { ground: 'tile_burnt' } },
  castle: { name: 'Muralhas do Castelo', lanes: 7, desc: 'Sete raias largas diante do castelo.', ground: ['tile_cobble_a', 'tile_cobble_b'],
    back: 'tile_cobble_b', forest: 'tile_dirt_road', art: { ground: 'tile_castle_stone' } },
};
export const REGION_ARENA: Record<string, ArenaId> = { bosque: 'farm', pantano: 'swamp', fronteira: 'fire', vale: 'bridge', costa: 'castle', cripta: 'grave' };

export interface Spawn { at: number; wolf: WolfId; lane: number }
export interface Raid { night: number; big: boolean; spawns: Spawn[]; waves: number[]; endless?: boolean; lanes?: number }

// Raids grow with the nights; full moons (every 4th night) are big and may bring Ulf.
export function buildRaid(night: number, big: boolean, tutorial = false, shrink = 0, lanes = LANES): Raid {
  const spawns: Spawn[] = [];
  // First fight is a lesson: four scouts then one hunter, one at a time, only in the three middle lanes.
  if (tutorial) {
    const seq: WolfId[] = ['scout', 'scout', 'scout', 'scout', 'hunter'];
    seq.forEach((wolf, k) => spawns.push({ at: 6000 + k * 9000, wolf, lane: [2, 1, 3, 2, 2][k] }));
    return { night, big, spawns, waves: [6000], lanes: 5 };
  }
  const pool: WolfId[] = ['scout', 'scout', 'hunter', 'hunter', ...(night >= 3 ? ['leaper', 'pups'] as WolfId[] : []),
    ...(night >= 4 ? ['brute', 'howler', 'digger'] as WolfId[] : []), ...(night >= 6 ? ['brute', 'leaper', 'shaman', 'raven'] as WolfId[] : []),
    ...(night >= 8 ? ['armored', 'storm'] as WolfId[] : [])];
  const count = Math.max(3, Math.round(((big ? 8 : 4) + night * (big ? 2 : 1.2)) * (1 - shrink) * (lanes / 5)));
  const waves = big ? [0, 0.45, 0.8] : [0, 0.6];
  const span = big ? 110000 : 75000;
  for (let k = 0; k < count; k++) {
    // Enemies bunch up after each wave flag so waves feel like pushes.
    const w = waves[Math.min(waves.length - 1, Math.floor((k / count) * waves.length))];
    const at = 6000 + w * span + Math.random() * span * (1 / waves.length) * 0.9;
    spawns.push({ at, wolf: pool[Math.floor(Math.random() * pool.length)], lane: Math.floor(Math.random() * lanes) });
  }
  if (big && night >= 4) spawns.push({ at: 6000 + span * 0.85, wolf: 'alpha', lane: Math.floor(lanes / 2) });
  spawns.sort((a, b) => a.at - b.at);
  return { night, big, spawns, waves: waves.map(w => 6000 + w * span), lanes };
}

// Caçada battles: difficulty by floor; elites bring a leader, the last floor is the Pack Mother.
export function huntRaid(floor: number, type: 'battle' | 'elite' | 'boss', lanes: number): Raid {
  const pool: WolfId[] = ['scout', 'scout', 'hunter', ...(floor >= 1 ? ['pups'] as WolfId[] : []), ...(floor >= 2 ? ['leaper', 'digger'] as WolfId[] : []),
    ...(floor >= 3 ? ['raven', 'howler'] as WolfId[] : []), ...(floor >= 4 ? ['shaman', 'brute'] as WolfId[] : []),
    ...(floor >= 6 ? ['armored', 'storm'] as WolfId[] : []), ...(floor >= 8 ? ['brute', 'armored'] as WolfId[] : [])];
  const count = Math.round((5 + floor * 1.6) * (type === 'elite' ? 1.4 : type === 'boss' ? 1.6 : 1) * (lanes / 5));
  const waves = type === 'boss' ? [0, 0.35, 0.7] : [0, 0.55];
  const span = 60000 + floor * 5000;
  const spawns: Spawn[] = [];
  for (let k = 0; k < count; k++) {
    const w = waves[Math.min(waves.length - 1, Math.floor((k / count) * waves.length))];
    spawns.push({ at: 6000 + w * span + Math.random() * span * (1 / waves.length) * 0.9, wolf: pool[Math.floor(Math.random() * pool.length)], lane: Math.floor(Math.random() * lanes) });
  }
  if (type === 'elite') spawns.push({ at: 6000 + span * 0.6, wolf: floor >= 6 ? 'alpha' : floor >= 3 ? 'armored' : 'brute', lane: Math.floor(lanes / 2) });
  if (type === 'boss') spawns.push({ at: 6000 + span * 0.5, wolf: 'mother', lane: Math.floor(lanes / 2) });
  spawns.sort((a, b) => a.at - b.at);
  return { night: 1 + floor * 0.8, big: type !== 'battle', spawns, waves: waves.map(w => 6000 + w * span), lanes };
}

export const BATTLE_LINES = {
  start: 'Um bando pequeno, um lobo de cada vez, pelas raias do meio. Ponha Sentinelas ali!',
  grab: ['Defendam o estoque! Espera. Eu sou o estoque.', 'Eu nunca pensei que torceria pelos vampiros.'],
  win: 'Eles recuaram. Mande a conta da cerca.',
  lose: 'Tecnicamente, a linha defensiva continua existindo. Em vários lugares.',
};

// Blood Moon (endless challenge): wave k of an ever-growing horde, starting at time `at`.
export function endlessWave(k: number, at: number, lanes = LANES): Spawn[] {
  const pool: WolfId[] = ['scout', 'scout', 'hunter', ...(k >= 2 ? ['pups'] as WolfId[] : []), ...(k >= 3 ? ['leaper', 'digger'] as WolfId[] : []),
    ...(k >= 4 ? ['brute', 'howler', 'raven'] as WolfId[] : []), ...(k >= 6 ? ['shaman', 'armored'] as WolfId[] : []), ...(k >= 8 ? ['storm', 'brute', 'leaper'] as WolfId[] : [])];
  const count = 3 + k * 2;
  const out: Spawn[] = [];
  for (let i = 0; i < count; i++) out.push({ at: at + i * Math.max(900, 3200 - k * 180) + Math.random() * 800, wolf: pool[Math.floor(Math.random() * pool.length)], lane: Math.floor(Math.random() * lanes) });
  if (k % 5 === 0) out.push({ at: at + count * 1500, wolf: k % 10 === 0 ? 'mother' : 'alpha', lane: Math.floor(lanes / 2) });
  return out.sort((a, b) => a.at - b.at);
}

// Unit levels bought with hunt marks (Arsenal): +15% damage, life and chalice output per level.
export const UNIT_MAX_LV = 5;
export const unitLvCost = (lv: number) => (lv + 1) * 3;
