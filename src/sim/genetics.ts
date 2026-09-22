// Heirs (GDD_ADENDO A2): a bonded couple sends for an adult relative who inherits from both.
// Better parents → better odds of rare results. Pure functions, no Phaser.
import { BloodType, HumanTraits, QUALITY, Quality, Temper, TEMPER, Trait, TRAIT, randomCode } from '../data/humans';

const QUALITIES: Quality[] = ['comum', 'especial', 'raro', 'excepcional'];

// Some profile pairs can produce something neither parent has.
const COMBOS: { a: BloodType; b: BloodType; out: BloodType; chance: number }[] = [
  { a: 'rubra', b: 'lunar', out: 'carmesim', chance: 0.12 },
  { a: 'lunar', b: 'umbra', out: 'carmesim', chance: 0.18 },
  { a: 'ambar', b: 'umbra', out: 'lunar', chance: 0.2 },
  { a: 'rubra', b: 'ambar', out: 'umbra', chance: 0.12 },
];

const pick = <T,>(a: T, b: T) => (Math.random() < 0.5 ? a : b);

export function heirOf(p: HumanTraits, q: HumanTraits): HumanTraits {
  // Blood: special combination first, otherwise one of the parents (rarely a random drift).
  const combo = COMBOS.find(c => (c.a === p.blood && c.b === q.blood) || (c.a === q.blood && c.b === p.blood));
  let blood: BloodType = pick(p.blood, q.blood);
  if (combo && Math.random() < combo.chance) blood = combo.out;
  else if (Math.random() < 0.05) blood = (['rubra', 'lunar', 'ambar', 'umbra'] as BloodType[])[Math.floor(Math.random() * 4)];

  // Quality: around the parents' average, with a real chance to climb one step (and a smaller one to drop).
  const avg = (QUALITY[p.quality].rank + QUALITY[q.quality].rank) / 2;
  const r = Math.random();
  let rank = Math.floor(avg) + (avg % 1 >= 0.5 && Math.random() < 0.5 ? 1 : 0);
  if (r < 0.28 + avg * 0.06) rank++;
  else if (r > 0.88) rank--;
  const quality = QUALITIES[Math.max(0, Math.min(3, rank))];

  // Rare traits run in families.
  const parentTraits = [p.trait, q.trait].filter(Boolean) as Trait[];
  let trait: Trait | undefined;
  if (parentTraits.length && Math.random() < 0.4 + 0.15 * (parentTraits.length - 1)) trait = parentTraits[Math.floor(Math.random() * parentTraits.length)];
  else if (Math.random() < 0.03) trait = (Object.keys(TRAIT) as Trait[])[Math.floor(Math.random() * 3)];

  const temps = Object.keys(TEMPER) as Temper[];
  const temper = Math.random() < 0.7 ? pick(p.temper, q.temper) : temps[Math.floor(Math.random() * temps.length)];

  return { blood, quality, temper, trait, code: randomCode() };
}

// Odds shown to the player on the couple's sheet (rough, for decision-making).
export function heirOdds(p: HumanTraits, q: HumanTraits) {
  const avg = (QUALITY[p.quality].rank + QUALITY[q.quality].rank) / 2;
  const combo = COMBOS.find(c => (c.a === p.blood && c.b === q.blood) || (c.a === q.blood && c.b === p.blood));
  return { upgrade: Math.round((0.28 + avg * 0.06) * 100), combo: combo ? { out: combo.out, pct: Math.round(combo.chance * 100) } : undefined };
}
