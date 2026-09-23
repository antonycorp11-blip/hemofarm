// Dr. Hemático's research tree (GDD_ADENDO A4, v2). A real tree: the Lab bench in the middle, four branches around it,
// nodes with levels bought instantly with Essência, and one exclusive keystone choice at the end of each branch.
import { state } from '../core/state';
import { L } from '../core/i18n';

export type Branch = 'root' | 'sangue' | 'rebanho' | 'defesa' | 'castelo';

// Effect keys read by the systems through core/bonus.fx(). Values add up per level.
export type Fx = 'blood' | 'vitCost' | 'collectSpeed' | 'regen' | 'sleep' | 'moraleUp' | 'grow' | 'harvest' | 'kin' | 'heirQ' | 'bond' |
  'titheGold' | 'contractGold' | 'offers' | 'quota' | 'unitDmg' | 'unitHp' | 'chalice' | 'unitCost' | 'essence' | 'orb' | 'orbRate' |
  'defense' | 'raidSize' | 'researchCost' | 'vigil' | 'moraleBlood' | 'collectMorale' | 'food';

export interface Node {
  id: string; branch: Branch; name: string; desc: string; icon: string;
  max: number; base: number;          // Essência for level 1; each level costs ×1.7
  x: number; y: number;               // position on the tree screen
  req: string[];                      // every parent needs level ≥ 1
  fx?: [Fx, number][];                // per level
  unlock?: string;                    // battle unit unlocked at level 1
  excl?: string;                      // keystones: only one node of the group can be taken
}

export const BRANCHES: Record<Branch, { name: string; color: string }> = {
  root: { name: L('Laboratório', 'Laboratory'), color: '#b04aff' },
  sangue: { name: L('Sangue', 'Blood'), color: '#e0283c' },
  rebanho: { name: L('Rebanho', 'Herd'), color: '#e8b54a' },
  defesa: { name: L('Defesa', 'Defense'), color: '#8a7aff' },
  castelo: { name: L('Castelo', 'Castle'), color: '#5ab4e8' },
};

export const NODES: Node[] = [
  { id: 'lab', branch: 'root', name: L('Bancada do Hemático', 'Hematic\'s Bench'), icon: 'icon_research', max: 5, base: 15, x: 600, y: 400, req: [], fx: [['essence', 0.1]],
    desc: L('+10% de Essência por nível. Tudo começa com uma bancada e pouca supervisão.', '+10% Essence per level. Everything starts with a bench and little supervision.') },
  // Sangue — production
  { id: 's1', branch: 'sangue', name: L('Válvulas Afinadas', 'Tuned Valves'), icon: 'icon_blood', max: 5, base: 20, x: 470, y: 400, req: ['lab'], fx: [['blood', 0.08]],
    desc: L('+8% de Sangue por coleta por nível.', '+8% Blood per collection per level.') },
  { id: 's2', branch: 'sangue', name: L('Recuperação Assistida', 'Assisted Recovery'), icon: 'icon_vitality', max: 3, base: 45, x: 360, y: 315, req: ['s1'], fx: [['vitCost', 4]],
    desc: L('Cada coleta tira 4 de vitalidade a menos por nível.', 'Each collection takes 4 less vitality per level.') },
  { id: 's3', branch: 'sangue', name: L('Fila Expressa', 'Express Line'), icon: 'icon_collect', max: 5, base: 40, x: 360, y: 485, req: ['s1'], fx: [['collectSpeed', 0.06]],
    desc: L('Coleta 6% mais rápida por nível.', 'Collection 6% faster per level.') },
  { id: 's4', branch: 'sangue', name: L('Destilaria', 'Distillery'), icon: 'icon_research', max: 5, base: 60, x: 240, y: 265, req: ['s2'], fx: [['essence', 0.15]],
    desc: L('+15% de Essência por nível.', '+15% Essence per level.') },
  { id: 's5', branch: 'sangue', name: L('Orbes Fartos', 'Plump Orbs'), icon: 'icon_blood', max: 3, base: 50, x: 240, y: 535, req: ['s3'], fx: [['orb', 0.5], ['orbRate', 0.15]],
    desc: L('Orbes de sangue valem +50% e aparecem 15% mais vezes por nível.', 'Blood orbs are worth +50% and appear 15% more often per level.') },
  { id: 'x1', branch: 'sangue', name: L('Sinergia Sanguínea', 'Blood Synergy'), icon: 'icon_morale', max: 3, base: 90, x: 440, y: 195, req: ['s2', 'r2'], fx: [['moraleBlood', 0.1]],
    desc: L('Humanos com moral acima de 60 dão +10% de Sangue por nível. Liga os ramos Sangue e Rebanho.', 'Humans with morale above 60 give +10% Blood per level. Links the Blood and Herd branches.') },
  { id: 'sk1', branch: 'sangue', name: L('Coleta em Massa', 'Mass Collection'), icon: 'icon_collect', max: 1, base: 400, x: 110, y: 335, req: ['s4', 's5'], excl: 'sk',
    fx: [['blood', 0.35], ['vitCost', -10]], desc: L('ESCOLHA ÚNICA · +35% de Sangue por coleta, mas cada coleta cansa 10 a mais.', 'ONE CHOICE ONLY · +35% Blood per collection, but each collection tires 10 more.') },
  { id: 'sk2', branch: 'sangue', name: L('Coleta Artesanal', 'Artisanal Collection'), icon: 'icon_morale', max: 1, base: 400, x: 110, y: 465, req: ['s4', 's5'], excl: 'sk',
    fx: [['vitCost', 12], ['collectMorale', 2]], desc: L('ESCOLHA ÚNICA · Coletas cansam 12 a menos e dão +2 de moral. Humanos felizes, fila eterna.', 'ONE CHOICE ONLY · Collections tire 12 less and give +2 morale. Happy humans, endless line.') },
  // Rebanho — humans, food, families
  { id: 'r1', branch: 'rebanho', name: L('Ração Nutritiva', 'Nutritious Rations'), icon: 'icon_vitality', max: 5, base: 20, x: 650, y: 280, req: ['lab'], fx: [['regen', 0.15]],
    desc: L('Vitalidade recupera 15% mais rápido por nível.', 'Vitality recovers 15% faster per level.') },
  { id: 'r2', branch: 'rebanho', name: L('Colchões Decentes', 'Decent Mattresses'), icon: 'icon_morale', max: 3, base: 40, x: 560, y: 170, req: ['r1'], fx: [['sleep', 0.1], ['moraleUp', 1]],
    desc: L('Sono 10% mais curto e +1 de moral ao acordar por nível.', 'Sleep 10% shorter and +1 morale on waking per level.') },
  { id: 'r3', branch: 'rebanho', name: L('Adubo de Ossos', 'Bone Meal'), icon: 'icon_build', max: 5, base: 30, x: 780, y: 240, req: ['r1'], fx: [['grow', 0.1]],
    desc: L('Plantas crescem 10% mais rápido por nível.', 'Crops grow 10% faster per level.') },
  { id: 'r4', branch: 'rebanho', name: L('Irrigação Noturna', 'Night Irrigation'), icon: 'icon_build', max: 5, base: 50, x: 900, y: 170, req: ['r3'], fx: [['harvest', 0.1]],
    desc: L('+10% de Comida por colheita por nível.', '+10% Food per harvest per level.') },
  { id: 'r5', branch: 'rebanho', name: L('Música Ambiente', 'Mood Music'), icon: 'icon_morale', max: 1, base: 90, x: 560, y: 55, req: ['r2'],
    desc: L('A moral sobe devagar sozinha. Salvo a do Davi.', 'Morale slowly rises on its own. Except Davi\'s.') },
  { id: 'r6', branch: 'rebanho', name: L('Cartas Perfumadas', 'Perfumed Letters'), icon: 'icon_population', max: 5, base: 50, x: 690, y: 110, req: ['r2'], fx: [['kin', 0.15]],
    desc: L('Parentes chegam 15% mais rápido por nível.', 'Relatives arrive 15% faster per level.') },
  { id: 'r7', branch: 'rebanho', name: L('Registro de Linhagens', 'Lineage Registry'), icon: 'icon_vitality', max: 3, base: 90, x: 810, y: 45, req: ['r6'], fx: [['heirQ', 0.04]],
    desc: L('+4% de chance do parente subir de qualidade por nível.', '+4% chance per level for a relative to rise in quality.') },
  { id: 'r8', branch: 'rebanho', name: L('Afinidade Induzida', 'Induced Affinity'), icon: 'icon_morale', max: 3, base: 80, x: 960, y: 70, req: ['r6', 'r4'], fx: [['bond', 0.35]],
    desc: L('Casais se formam 35% mais rápido por nível.', 'Couples form 35% faster per level.') },
  { id: 'rk1', branch: 'rebanho', name: L('Eugenia Gótica', 'Gothic Pedigree'), icon: 'icon_prestige', max: 1, base: 400, x: 1100, y: 45, req: ['r7', 'r8'], excl: 'rk', fx: [['heirQ', 0.12]],
    desc: L('ESCOLHA ÚNICA · +12% de chance de parentes melhores. Poucos, mas nobres.', 'ONE CHOICE ONLY · +12% chance of better relatives. Few, but noble.') },
  { id: 'rk2', branch: 'rebanho', name: L('Casa Cheia', 'Full House'), icon: 'icon_population', max: 1, base: 400, x: 1100, y: 165, req: ['r7', 'r8'], excl: 'rk', fx: [['kin', 1]],
    desc: L('ESCOLHA ÚNICA · Parentes chegam duas vezes mais rápido. Muitos, e todos com opinião.', 'ONE CHOICE ONLY · Relatives arrive twice as fast. Many, and all with opinions.') },
  // Defesa — the battle
  { id: 'n1', branch: 'defesa', name: L('Gárgulas', 'Gargoyles'), icon: 'icon_defense', max: 1, base: 40, x: 650, y: 525, req: ['lab'], unlock: 'gargoyle',
    desc: L('Libera a Gárgula na batalha: abate o primeiro lobisomem que se aproxima.', 'Unlocks the Gargoyle in battle: it takes down the first werewolf that gets close.') },
  { id: 'n2', branch: 'defesa', name: L('Presas Afiadas', 'Sharp Fangs'), icon: 'icon_defense', max: 5, base: 40, x: 560, y: 635, req: ['n1'], fx: [['unitDmg', 0.1]],
    desc: L('Defensores causam +10% de dano por nível.', 'Defenders deal +10% damage per level.') },
  { id: 'n3', branch: 'defesa', name: L('Cálices Profundos', 'Deep Chalices'), icon: 'icon_blood', max: 5, base: 35, x: 770, y: 590, req: ['n1'], fx: [['chalice', 0.12]],
    desc: L('Cálices geram +12% de Sangue na batalha por nível.', 'Chalices make +12% Blood in battle per level.') },
  { id: 'n4', branch: 'defesa', name: L('Alquimia de Guerra', 'War Alchemy'), icon: 'icon_research', max: 1, base: 120, x: 480, y: 745, req: ['n2'], unlock: 'alchemist',
    desc: L('Libera o Alquimista: frascos em área que deixam lento.', 'Unlocks the Alchemist: area flasks that slow.') },
  { id: 'n5', branch: 'defesa', name: L('Muralhas de Osso', 'Bone Walls'), icon: 'icon_defense', max: 5, base: 50, x: 880, y: 680, req: ['n3'], fx: [['unitHp', 0.12]],
    desc: L('Defensores têm +12% de vida por nível.', 'Defenders have +12% health per level.') },
  { id: 'n6', branch: 'defesa', name: L('Nuvem de Morcegos', 'Bat Cloud'), icon: 'icon_raid', max: 1, base: 250, x: 690, y: 755, req: ['n4', 'n5'], unlock: 'bats',
    desc: L('Libera a Nuvem de Morcegos: arrasa uma área 3×3.', 'Unlocks the Bat Cloud: wipes out a 3×3 area.') },
  // Castelo — gold, contracts, the tithe
  { id: 'n7', branch: 'castelo', name: L('Carruagens Pontuais', 'Punctual Carriages'), icon: 'icon_gold', max: 5, base: 25, x: 750, y: 400, req: ['lab'], fx: [['titheGold', 0.1]],
    desc: L('O castelo paga +10% de Ouro pela Sangria por nível.', 'The castle pays +10% Gold for the Bloodletting per level.') },
  { id: 'n8', branch: 'castelo', name: L('Contratos Premium', 'Premium Contracts'), icon: 'icon_contracts', max: 5, base: 40, x: 880, y: 400, req: ['n7'], fx: [['contractGold', 0.08]],
    desc: L('+8% de Ouro em todos os contratos por nível.', '+8% Gold on all contracts per level.') },
  { id: 'n9', branch: 'castelo', name: L('Rotas Noturnas', 'Night Routes'), icon: 'icon_contracts', max: 1, base: 120, x: 1010, y: 330, req: ['n8'], fx: [['offers', 1]],
    desc: L('Uma oferta de contrato a mais por noite.', 'One more contract offer per night.') },
  { id: 'n10', branch: 'castelo', name: L('Diplomacia Sombria', 'Shadow Diplomacy'), icon: 'icon_prestige', max: 3, base: 100, x: 1010, y: 480, req: ['n8'], fx: [['quota', 0.04]],
    desc: L('Cota da Sangria 4% menor por nível.', 'Bloodletting quota 4% lower per level.') },
  { id: 'nk1', branch: 'castelo', name: L('Vigília Eterna', 'Eternal Vigil'), icon: 'icon_defense', max: 1, base: 400, x: 1120, y: 560, req: ['n10', 'n5'], excl: 'nk', fx: [['vigil', 1]],
    desc: L('ESCOLHA ÚNICA · Ataques que você não defender nunca levam humanos (só um pouco de Sangue).', 'ONE CHOICE ONLY · Attacks you don\'t defend never take humans (only a little Blood).') },
  { id: 'nk2', branch: 'castelo', name: L('Caçada Real', 'Royal Hunt'), icon: 'icon_raid', max: 1, base: 400, x: 1040, y: 680, req: ['n10', 'n5'], excl: 'nk', fx: [['defense', 1]],
    desc: L('ESCOLHA ÚNICA · Recompensas de defesa em dobro e +Essência por lobisomem abatido.', 'ONE CHOICE ONLY · Double defense rewards and +Essence per werewolf slain.') },
];

export const node = (id: string) => NODES.find(n => n.id === id)!;
export const lvl = (id: string) => state.research.lv[id] ?? 0;
// Systems ask `has('n1')` instead of knowing about the research UI.
export const has = (id: string) => lvl(id) > 0;
