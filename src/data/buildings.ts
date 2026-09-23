import { L } from '../core/i18n';
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
    name: L('Habitação', 'Housing'),
    light: { h: 20, radius: 90, color: 0xffa044, intensity: 0.8, flicker: 0.08 },
    levels: [
      { tex: 'bld_housing_1', cost: 120, buildMs: 8000, capacity: 4, desc: L('Um teto. Tecnicamente.', 'A roof. Technically.') },
      { tex: 'bld_housing_2', cost: 320, buildMs: 15000, capacity: 8, desc: L('Paredes de pedra e janelas que fecham. Luxo.', 'Stone walls and windows that close. Luxury.') },
      { tex: 'bld_housing_3', cost: 750, buildMs: 25000, capacity: 14, desc: L('Dormitório de dois andares. Cabe todo mundo e mais algumas reclamações.', 'A two-story dormitory. Fits everyone plus a few complaints.') },
    ],
  },
  food: {
    name: L('Alimentação', 'Dining'),
    light: { h: 10, radius: 90, color: 0xff8a3a, intensity: 0.8, flicker: 0.15 },
    levels: [
      { tex: 'bld_food_1', cost: 100, buildMs: 7000, eatMs: 7000, desc: L('Mesa, panela e fogo. Humanos alimentados recuperam vitalidade.', 'Table, pot and fire. Fed humans recover vitality.') },
      { tex: 'bld_food_2', cost: 280, buildMs: 14000, eatMs: 4500, desc: L('Refeitório coberto. Comem mais rápido e reclamam menos.', 'A covered dining hall. They eat faster and complain less.') },
    ],
  },
  collect: {
    name: L('Posto de Coleta', 'Collection Post'),
    light: { h: 40, radius: 120, color: 0xff2a3a, intensity: 0.7, flicker: 0.04 },
    levels: [
      { tex: 'bld_collect_1', cost: 150, buildMs: 9000, blood: 10, collectMs: 4000, desc: L('Um tanque, uma bancada, muita boa vontade.', 'One tank, one bench, lots of goodwill.') },
      { tex: 'bld_collect_2', cost: 420, buildMs: 18000, blood: 14, collectMs: 2500, desc: L('Dois tanques e uma válvula muito bonita. Fila mais rápida, mais Sangue.', 'Two tanks and a very pretty valve. Faster line, more Blood.') },
    ],
  },
  boarding: {
    name: L('Pátio de Embarque', 'Boarding Yard'),
    levels: [
      { tex: 'bld_boarding', cost: 200, buildMs: 12000, desc: L('Onde humanos vendidos aguardam o comprador. Necessário para entregar contratos.', 'Where sold humans wait for the buyer. Needed to deliver contracts.') },
    ],
  },
  family: {
    name: L('Casa das Famílias', 'Family House'),
    light: { h: 20, radius: 95, color: 0xff8a8a, intensity: 0.8, flicker: 0.08 },
    levels: [
      { tex: 'bld_housing_2', tint: 0xffc8c8, cost: 300, buildMs: 14000, kinRate: 1.2,
        desc: L('Casais registrados mandam buscar parentes adultos que herdam o sangue dos dois. Burocracia afetiva.', 'Registered couples send for adult relatives who inherit both their blood. Affectionate bureaucracy.') },
      { tex: 'bld_housing_3', tint: 0xffc8c8, cost: 700, buildMs: 22000, kinRate: 2,
        desc: L('Mais quartos, mais cartas para a família, mais parentes chegando. E mais formulários.', 'More rooms, more letters home, more relatives arriving. And more forms.') },
    ],
  },
  lab: {
    name: L('Laboratório', 'Laboratory'),
    light: { h: 40, radius: 110, color: 0xb04aff, intensity: 0.7, flicker: 0.12 },
    levels: [
      { tex: 'bld_lab', cost: 250, buildMs: 12000, desc: L('O domínio do Dr. Hemático. Pesquisas que melhoram a fazenda inteira. Poucos incêndios, por enquanto.', 'Dr. Hematic\'s domain. Research that improves the whole farm. Few fires, so far.') },
    ],
  },
  watch: {
    name: L('Torre de Vigia', 'Watchtower'),
    light: { h: 210, radius: 130, color: 0xffa040, intensity: 1, flicker: 0.18, dx: 20 },
    levels: [
      { tex: 'bld_watchtower', cost: 200, buildMs: 10000, desc: L('Avisa quando os lobisomens vêm. Aumenta o cofre de guerra.', 'Warns when the werewolves are coming. Makes the war chest bigger.') },
    ],
  },
};

// Upgrade tracks (incremental layer): once a building exists, Gold buys levels of one clear bonus, shared by every
// building of that kind. Cost grows ×1.18 per level, so there's always a next purchase in sight.
export interface Track { name: string; desc: string; max: number; base: number; fx: [import('./research').Fx, number] }
export const TRACKS: Partial<Record<BuildingKind, Track>> = {
  collect: { name: L('Tanques de Coleta', 'Collection Tanks'), desc: L('+6% de Sangue por coleta', '+6% Blood per collection'), max: 25, base: 60, fx: ['blood', 0.06] },
  housing: { name: L('Camas Macias', 'Soft Beds'), desc: L('sono 4% mais curto', 'sleep 4% shorter'), max: 10, base: 50, fx: ['sleep', 0.04] },
  food: { name: L('Cozinha Farta', 'Hearty Kitchen'), desc: L('+6% de recuperação de vitalidade', '+6% vitality recovery'), max: 15, base: 50, fx: ['regen', 0.06] },
  family: { name: L('Correio Familiar', 'Family Mail'), desc: L('parentes 8% mais rápidos', 'relatives 8% faster'), max: 15, base: 80, fx: ['kin', 0.08] },
  lab: { name: L('Alambiques', 'Stills'), desc: L('+8% de Essência', '+8% Essence'), max: 25, base: 80, fx: ['essence', 0.08] },
  watch: { name: L('Arsenal da Torre', 'Tower Armory'), desc: L('defensores 3% mais baratos', 'defenders 3% cheaper'), max: 10, base: 100, fx: ['unitCost', 0.03] },
  boarding: { name: L('Vitrine do Pátio', 'Yard Showcase'), desc: L('+5% de Ouro em contratos', '+5% Gold from contracts'), max: 10, base: 90, fx: ['contractGold', 0.05] },
};
export const trackCost = (t: Track, lv: number) => Math.round(t.base * Math.pow(1.18, lv));

// Ghoul foreman commentary (GDD §7, §18.1)
export const BORIS_LINES = {
  started: [L('Obra iniciada. Prazo estimado: otimista.', 'Construction started. Estimated deadline: optimistic.'), L('Os ghouls agradecem a oportunidade de trabalhar sem pulso.', 'The ghouls appreciate the chance to work without a pulse.')],
  built: [L('Excelente. Agora parece intencional.', 'Excellent. Now it looks intentional.'), L('Inventário atualizado. Uma construção a mais, uma desculpa a menos.', 'Inventory updated. One more building, one less excuse.')],
  poor: [L('Ouro insuficiente. Sugiro produzir mais Sangue ou menos ambição.', 'Not enough Gold. I suggest producing more Blood or less ambition.')],
};
