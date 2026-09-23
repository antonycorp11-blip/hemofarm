// Building definitions: every level has a visible sprite and a concrete gameplay effect (GDD §14: visible incremental).
export type BuildingKind = 'housing' | 'food' | 'collect' | 'boarding' | 'watch' | 'family' | 'lab';

export interface Level {
  tex: string;
  cost: number;        // Gold
  buildMs: number;
  desc: string;
  capacity?: number;   // housing: residents
  blood?: number;      // collect: Blood per collection
  collectMs?: number;  // collect: time inside the station
  eatMs?: number;      // food: time to eat
  kinRate?: number;    // family: heir progress per second for each couple
  tint?: number;       // placeholder colouring until a dedicated sprite exists
}

export interface LightPreset { h: number; radius: number; color: number; intensity: number; flicker: number; dx?: number }

export interface BuildingDef { name: string; levels: Level[]; light?: LightPreset }

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  housing: {
    name: 'Habitação',
    light: { h: 20, radius: 90, color: 0xffa044, intensity: 0.8, flicker: 0.08 },
    levels: [
      { tex: 'bld_housing_1', cost: 120, buildMs: 8000, capacity: 4, desc: 'Um teto. Tecnicamente.' },
      { tex: 'bld_housing_2', cost: 320, buildMs: 15000, capacity: 8, desc: 'Paredes de pedra e janelas que fecham. Luxo.' },
      { tex: 'bld_housing_3', cost: 750, buildMs: 25000, capacity: 14, desc: 'Dormitório de dois andares. Cabe todo mundo e mais algumas reclamações.' },
    ],
  },
  food: {
    name: 'Alimentação',
    light: { h: 10, radius: 90, color: 0xff8a3a, intensity: 0.8, flicker: 0.15 },
    levels: [
      { tex: 'bld_food_1', cost: 100, buildMs: 7000, eatMs: 7000, desc: 'Mesa, panela e fogo. Humanos alimentados recuperam vitalidade.' },
      { tex: 'bld_food_2', cost: 280, buildMs: 14000, eatMs: 4500, desc: 'Refeitório coberto. Comem mais rápido e reclamam menos.' },
    ],
  },
  collect: {
    name: 'Posto de Coleta',
    light: { h: 40, radius: 120, color: 0xff2a3a, intensity: 0.7, flicker: 0.04 },
    levels: [
      { tex: 'bld_collect_1', cost: 150, buildMs: 9000, blood: 10, collectMs: 4000, desc: 'Um tanque, uma bancada, muita boa vontade.' },
      { tex: 'bld_collect_2', cost: 420, buildMs: 18000, blood: 14, collectMs: 2500, desc: 'Dois tanques e uma válvula muito bonita. Fila mais rápida, mais Sangue.' },
    ],
  },
  boarding: {
    name: 'Pátio de Embarque',
    levels: [
      { tex: 'bld_boarding', cost: 200, buildMs: 12000, desc: 'Onde humanos vendidos aguardam o comprador. Necessário para entregar contratos.' },
    ],
  },
  family: {
    name: 'Casa das Famílias',
    light: { h: 20, radius: 95, color: 0xff8a8a, intensity: 0.8, flicker: 0.08 },
    levels: [
      { tex: 'bld_housing_2', tint: 0xffc8c8, cost: 300, buildMs: 14000, kinRate: 1.2,
        desc: 'Casais registrados mandam buscar parentes adultos que herdam o sangue dos dois. Burocracia afetiva.' },
      { tex: 'bld_housing_3', tint: 0xffc8c8, cost: 700, buildMs: 22000, kinRate: 2,
        desc: 'Mais quartos, mais cartas para a família, mais parentes chegando. E mais formulários.' },
    ],
  },
  lab: {
    name: 'Laboratório',
    light: { h: 40, radius: 110, color: 0xb04aff, intensity: 0.7, flicker: 0.12 },
    levels: [
      { tex: 'bld_lab', cost: 250, buildMs: 12000, desc: 'O domínio do Dr. Hemático. Pesquisas que melhoram a fazenda inteira. Poucos incêndios, por enquanto.' },
    ],
  },
  watch: {
    name: 'Torre de Vigia',
    light: { h: 210, radius: 130, color: 0xffa040, intensity: 1, flicker: 0.18, dx: 20 },
    levels: [
      { tex: 'bld_watchtower', cost: 200, buildMs: 10000, desc: 'Avisa quando os lobisomens vêm. (Defesa em breve.)' },
    ],
  },
};

// Ghoul foreman commentary (GDD §7, §18.1)
export const BORIS_LINES = {
  started: ['Obra iniciada. Prazo estimado: otimista.', 'Os ghouls agradecem a oportunidade de trabalhar sem pulso.'],
  built: ['Excelente. Agora parece intencional.', 'Inventário atualizado. Uma construção a mais, uma desculpa a menos.'],
  poor: ['Ouro insuficiente. Sugiro produzir mais Sangue ou menos ambição.'],
};
