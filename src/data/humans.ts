import { L } from '../core/i18n';
// Human attributes (GDD §6.1). All values are fictional — never tied to real-world traits (GDD §3).
export type BloodType = 'rubra' | 'lunar' | 'ambar' | 'umbra' | 'carmesim';
export type Quality = 'comum' | 'especial' | 'raro' | 'excepcional';
export type Temper = 'calmo' | 'cinico' | 'dramatico' | 'lider' | 'curioso';
export type Trait = 'lunar' | 'especiado' | 'mente';

export const BLOOD: Record<BloodType, { name: string; weight: number }> = {
  rubra: { name: L('Rubra', 'Rubra'), weight: 40 },
  lunar: { name: L('Lunar', 'Lunar'), weight: 25 },
  ambar: { name: L('Âmbar', 'Amber'), weight: 20 },
  umbra: { name: L('Umbra', 'Umbra'), weight: 12 },
  carmesim: { name: L('Carmesim', 'Crimson'), weight: 3 },
};

// mult: Blood per collection · value: base Gold when sold
export const QUALITY: Record<Quality, { name: string; weight: number; mult: number; rank: number }> = {
  comum: { name: L('Comum', 'Common'), weight: 60, mult: 1, rank: 0 },
  especial: { name: L('Especial', 'Special'), weight: 28, mult: 1.2, rank: 1 },
  raro: { name: L('Raro', 'Rare'), weight: 10, mult: 1.5, rank: 2 },
  excepcional: { name: L('Excepcional', 'Exceptional'), weight: 2, mult: 2, rank: 3 },
};

export const TEMPER: Record<Temper, { name: string; desc: string }> = {
  calmo: { name: L('Calmo', 'Calm'), desc: L('Reclama baixo. Às vezes nem reclama.', 'Complains quietly. Sometimes not at all.') },
  cinico: { name: L('Cínico', 'Cynical'), desc: L('Entende tudo. Aprova nada.', 'Understands everything. Approves of nothing.') },
  dramatico: { name: L('Dramático', 'Dramatic'), desc: L('Cada coleta é um terceiro ato.', 'Every collection is a third act.') },
  lider: { name: L('Líder', 'Leader'), desc: L('Os outros escutam. Isso pode ser um problema.', 'The others listen. That could be a problem.') },
  curioso: { name: L('Curioso', 'Curious'), desc: L('Pergunta demais sobre o castelo.', 'Asks too much about the castle.') },
};

export const TRAIT: Record<Trait, { name: string; desc: string; chance: number }> = {
  lunar: { name: L('Ressonância Lunar', 'Lunar Resonance'), desc: L('O sangue brilha levemente na lua cheia. Pesquisadores adoram.', 'The blood glows faintly at the full moon. Researchers love it.'), chance: 0.05 },
  especiado: { name: L('Sangue Especiado', 'Spiced Blood'), desc: L('Notas de canela e pimenta. Socialites pagam caro.', 'Notes of cinnamon and pepper. Socialites pay dearly.'), chance: 0.05 },
  mente: { name: L('Mente Brilhante', 'Brilliant Mind'), desc: L('Resolve problemas. Inclusive os que você preferia que não resolvesse.', 'Solves problems. Including the ones you\'d rather stay unsolved.'), chance: 0.04 },
};

export interface HumanTraits { blood: BloodType; quality: Quality; temper: Temper; trait?: Trait; code: string }

function weighted<K extends string>(table: Record<K, { weight: number }>, rnd = Math.random): K {
  const keys = Object.keys(table) as K[];
  let r = rnd() * keys.reduce((a, k) => a + table[k].weight, 0);
  for (const k of keys) { r -= table[k].weight; if (r <= 0) return k; }
  return keys[0];
}

const LETTERS = 'ABCDEFGHJKLMNPRSTUVZ';
export function randomCode() {
  return `${String(Math.floor(Math.random() * 90) + 10)}-${LETTERS[Math.floor(Math.random() * LETTERS.length)]}`;
}

export function randomTraits(overrides: Partial<HumanTraits> = {}): HumanTraits {
  const temps = Object.keys(TEMPER) as Temper[];
  const trait = (Object.keys(TRAIT) as Trait[]).find(t => Math.random() < TRAIT[t].chance);
  return {
    blood: weighted(BLOOD), quality: weighted(QUALITY), temper: temps[Math.floor(Math.random() * temps.length)],
    trait, code: randomCode(), ...overrides,
  };
}

// Fixed traits for the recurring humans (GDD §7)
export const NAMED_TRAITS: Record<string, Partial<HumanTraits>> = {
  'Davi 17-B': { blood: 'rubra', quality: 'especial', temper: 'cinico', trait: 'mente', code: '17-B' },
  'Lia 04-A': { blood: 'ambar', quality: 'especial', temper: 'curioso', code: '04-A' },
};

export const SOLD_LINES = [
  L('Se perguntarem, sempre quis conhecer o castelo.', 'If anyone asks, I always wanted to see the castle.'),
  L('Acho que fui promovido. Para fora da fazenda.', 'I think I got promoted. Off the farm.'),
  L('Fui escolhido. Ainda não sei se é elogio.', 'I was chosen. Not sure yet if it\'s a compliment.'),
];
