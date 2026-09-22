// Human attributes (GDD §6.1). All values are fictional — never tied to real-world traits (GDD §3).
export type BloodType = 'rubra' | 'lunar' | 'ambar' | 'umbra' | 'carmesim';
export type Quality = 'comum' | 'especial' | 'raro' | 'excepcional';
export type Temper = 'calmo' | 'cinico' | 'dramatico' | 'lider' | 'curioso';
export type Trait = 'lunar' | 'especiado' | 'mente';

export const BLOOD: Record<BloodType, { name: string; weight: number }> = {
  rubra: { name: 'Rubra', weight: 40 },
  lunar: { name: 'Lunar', weight: 25 },
  ambar: { name: 'Âmbar', weight: 20 },
  umbra: { name: 'Umbra', weight: 12 },
  carmesim: { name: 'Carmesim', weight: 3 },
};

// mult: Blood per collection · value: base Gold when sold
export const QUALITY: Record<Quality, { name: string; weight: number; mult: number; rank: number }> = {
  comum: { name: 'Comum', weight: 60, mult: 1, rank: 0 },
  especial: { name: 'Especial', weight: 28, mult: 1.2, rank: 1 },
  raro: { name: 'Raro', weight: 10, mult: 1.5, rank: 2 },
  excepcional: { name: 'Excepcional', weight: 2, mult: 2, rank: 3 },
};

export const TEMPER: Record<Temper, { name: string; desc: string }> = {
  calmo: { name: 'Calmo', desc: 'Reclama baixo. Às vezes nem reclama.' },
  cinico: { name: 'Cínico', desc: 'Entende tudo. Aprova nada.' },
  dramatico: { name: 'Dramático', desc: 'Cada coleta é um terceiro ato.' },
  lider: { name: 'Líder', desc: 'Os outros escutam. Isso pode ser um problema.' },
  curioso: { name: 'Curioso', desc: 'Pergunta demais sobre o castelo.' },
};

export const TRAIT: Record<Trait, { name: string; desc: string; chance: number }> = {
  lunar: { name: 'Ressonância Lunar', desc: 'O sangue brilha levemente na lua cheia. Pesquisadores adoram.', chance: 0.05 },
  especiado: { name: 'Sangue Especiado', desc: 'Notas de canela e pimenta. Socialites pagam caro.', chance: 0.05 },
  mente: { name: 'Mente Brilhante', desc: 'Resolve problemas. Inclusive os que você preferia que não resolvesse.', chance: 0.04 },
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
  'Se perguntarem, sempre quis conhecer o castelo.',
  'Acho que fui promovido. Para fora da fazenda.',
  'Fui escolhido. Ainda não sei se é elogio.',
];
