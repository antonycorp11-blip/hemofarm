// Dr. Hemático's research tree (GDD_ADENDO A4, v2). A real tree: the Lab bench in the middle, four branches around it,
// nodes with levels bought instantly with Essência, and one exclusive keystone choice at the end of each branch.
import { state } from '../core/state';

export type Branch = 'root' | 'sangue' | 'rebanho' | 'defesa' | 'castelo' | 'caçada' | 'dominio';

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
  root: { name: 'Laboratório', color: '#b04aff' },
  sangue: { name: 'Sangue', color: '#e0283c' },
  rebanho: { name: 'Rebanho', color: '#e8b54a' },
  defesa: { name: 'Defesa', color: '#8a7aff' },
  castelo: { name: 'Castelo', color: '#5ab4e8' },
  caçada: { name: 'Caçada', color: '#d96b9b' },
  dominio: { name: 'Domínio', color: '#7fd1b9' },
};

export const NODES: Node[] = [
  { id: 'lab', branch: 'root', name: 'Bancada do Hemático', icon: 'icon_research', max: 5, base: 15, x: 600, y: 400, req: [], fx: [['essence', 0.1]],
    desc: '+10% de Essência por nível. Tudo começa com uma bancada e pouca supervisão.' },
  // Sangue — production
  { id: 's1', branch: 'sangue', name: 'Válvulas Afinadas', icon: 'icon_blood', max: 5, base: 20, x: 470, y: 400, req: ['lab'], fx: [['blood', 0.08]],
    desc: '+8% de Sangue por coleta por nível.' },
  { id: 's2', branch: 'sangue', name: 'Recuperação Assistida', icon: 'icon_vitality', max: 3, base: 45, x: 360, y: 315, req: ['s1'], fx: [['vitCost', 4]],
    desc: 'Cada coleta tira 4 de vitalidade a menos por nível.' },
  { id: 's3', branch: 'sangue', name: 'Fila Expressa', icon: 'icon_collect', max: 5, base: 40, x: 360, y: 485, req: ['s1'], fx: [['collectSpeed', 0.06]],
    desc: 'Coleta 6% mais rápida por nível.' },
  { id: 's4', branch: 'sangue', name: 'Destilaria', icon: 'icon_research', max: 5, base: 60, x: 240, y: 265, req: ['s2'], fx: [['essence', 0.15]],
    desc: '+15% de Essência por nível.' },
  { id: 's5', branch: 'sangue', name: 'Orbes Fartos', icon: 'icon_blood', max: 3, base: 50, x: 240, y: 535, req: ['s3'], fx: [['orb', 0.5], ['orbRate', 0.15]],
    desc: 'Orbes de sangue valem +50% e aparecem 15% mais vezes por nível.' },
  { id: 'x1', branch: 'sangue', name: 'Sinergia Sanguínea', icon: 'icon_morale', max: 3, base: 90, x: 440, y: 195, req: ['s2', 'r2'], fx: [['moraleBlood', 0.1]],
    desc: 'Humanos com moral acima de 60 dão +10% de Sangue por nível. Liga os ramos Sangue e Rebanho.' },
  { id: 'sk1', branch: 'sangue', name: 'Coleta em Massa', icon: 'icon_collect', max: 1, base: 400, x: 110, y: 335, req: ['s4', 's5'], excl: 'sk',
    fx: [['blood', 0.35], ['vitCost', -10]], desc: 'ESCOLHA ÚNICA · +35% de Sangue por coleta, mas cada coleta cansa 10 a mais.' },
  { id: 'sk2', branch: 'sangue', name: 'Coleta Artesanal', icon: 'icon_morale', max: 1, base: 400, x: 110, y: 465, req: ['s4', 's5'], excl: 'sk',
    fx: [['vitCost', 12], ['collectMorale', 2]], desc: 'ESCOLHA ÚNICA · Coletas cansam 12 a menos e dão +2 de moral. Humanos felizes, fila eterna.' },
  // Rebanho — humans, food, families
  { id: 'r1', branch: 'rebanho', name: 'Ração Nutritiva', icon: 'icon_vitality', max: 5, base: 20, x: 650, y: 280, req: ['lab'], fx: [['regen', 0.15]],
    desc: 'Vitalidade recupera 15% mais rápido por nível.' },
  { id: 'r2', branch: 'rebanho', name: 'Colchões Decentes', icon: 'icon_morale', max: 3, base: 40, x: 560, y: 170, req: ['r1'], fx: [['sleep', 0.1], ['moraleUp', 1]],
    desc: 'Sono 10% mais curto e +1 de moral ao acordar por nível.' },
  { id: 'r3', branch: 'rebanho', name: 'Adubo de Ossos', icon: 'icon_build', max: 5, base: 30, x: 780, y: 240, req: ['r1'], fx: [['grow', 0.1]],
    desc: 'Plantas crescem 10% mais rápido por nível.' },
  { id: 'r4', branch: 'rebanho', name: 'Irrigação Noturna', icon: 'icon_build', max: 5, base: 50, x: 900, y: 170, req: ['r3'], fx: [['harvest', 0.1]],
    desc: '+10% de Comida por colheita por nível.' },
  { id: 'r5', branch: 'rebanho', name: 'Música Ambiente', icon: 'icon_morale', max: 1, base: 90, x: 560, y: 55, req: ['r2'],
    desc: 'A moral sobe devagar sozinha. Salvo a do Davi.' },
  { id: 'r6', branch: 'rebanho', name: 'Cartas Perfumadas', icon: 'icon_population', max: 5, base: 50, x: 690, y: 110, req: ['r2'], fx: [['kin', 0.15]],
    desc: 'Parentes chegam 15% mais rápido por nível.' },
  { id: 'r7', branch: 'rebanho', name: 'Registro de Linhagens', icon: 'icon_vitality', max: 3, base: 90, x: 810, y: 45, req: ['r6'], fx: [['heirQ', 0.04]],
    desc: '+4% de chance do parente subir de qualidade por nível.' },
  { id: 'r8', branch: 'rebanho', name: 'Afinidade Induzida', icon: 'icon_morale', max: 3, base: 80, x: 960, y: 70, req: ['r6', 'r4'], fx: [['bond', 0.35]],
    desc: 'Casais se formam 35% mais rápido por nível.' },
  { id: 'rk1', branch: 'rebanho', name: 'Eugenia Gótica', icon: 'icon_prestige', max: 1, base: 400, x: 1100, y: 45, req: ['r7', 'r8'], excl: 'rk', fx: [['heirQ', 0.12]],
    desc: 'ESCOLHA ÚNICA · +12% de chance de parentes melhores. Poucos, mas nobres.' },
  { id: 'rk2', branch: 'rebanho', name: 'Casa Cheia', icon: 'icon_population', max: 1, base: 400, x: 1100, y: 165, req: ['r7', 'r8'], excl: 'rk', fx: [['kin', 1]],
    desc: 'ESCOLHA ÚNICA · Parentes chegam duas vezes mais rápido. Muitos, e todos com opinião.' },
  // Defesa — the battle
  { id: 'n1', branch: 'defesa', name: 'Gárgulas', icon: 'icon_defense', max: 1, base: 40, x: 650, y: 525, req: ['lab'], unlock: 'gargoyle',
    desc: 'Libera a Gárgula na batalha: abate o primeiro lobisomem que se aproxima.' },
  { id: 'n2', branch: 'defesa', name: 'Presas Afiadas', icon: 'icon_defense', max: 5, base: 40, x: 560, y: 635, req: ['n1'], fx: [['unitDmg', 0.1]],
    desc: 'Defensores causam +10% de dano por nível.' },
  { id: 'n3', branch: 'defesa', name: 'Cálices Profundos', icon: 'icon_blood', max: 5, base: 35, x: 770, y: 590, req: ['n1'], fx: [['chalice', 0.12]],
    desc: 'Cálices geram +12% de Sangue na batalha por nível.' },
  { id: 'n4', branch: 'defesa', name: 'Alquimia de Guerra', icon: 'icon_research', max: 1, base: 120, x: 480, y: 745, req: ['n2'], unlock: 'alchemist',
    desc: 'Libera o Alquimista: frascos em área que deixam lento.' },
  { id: 'n5', branch: 'defesa', name: 'Muralhas de Osso', icon: 'icon_defense', max: 5, base: 50, x: 880, y: 680, req: ['n3'], fx: [['unitHp', 0.12]],
    desc: 'Defensores têm +12% de vida por nível.' },
  { id: 'n6', branch: 'defesa', name: 'Nuvem de Morcegos', icon: 'icon_raid', max: 1, base: 250, x: 690, y: 755, req: ['n4', 'n5'], unlock: 'bats',
    desc: 'Libera a Nuvem de Morcegos: arrasa uma área 3×3.' },
  // Castelo — gold, contracts, the tithe
  { id: 'n7', branch: 'castelo', name: 'Carruagens Pontuais', icon: 'icon_gold', max: 5, base: 25, x: 750, y: 400, req: ['lab'], fx: [['titheGold', 0.1]],
    desc: 'O castelo paga +10% de Ouro pela Sangria por nível.' },
  { id: 'n8', branch: 'castelo', name: 'Contratos Premium', icon: 'icon_contracts', max: 5, base: 40, x: 880, y: 400, req: ['n7'], fx: [['contractGold', 0.08]],
    desc: '+8% de Ouro em todos os contratos por nível.' },
  { id: 'n9', branch: 'castelo', name: 'Rotas Noturnas', icon: 'icon_contracts', max: 1, base: 120, x: 1010, y: 330, req: ['n8'], fx: [['offers', 1]],
    desc: 'Uma oferta de contrato a mais por noite.' },
  { id: 'n10', branch: 'castelo', name: 'Diplomacia Sombria', icon: 'icon_prestige', max: 3, base: 100, x: 1010, y: 480, req: ['n8'], fx: [['quota', 0.04]],
    desc: 'Cota da Sangria 4% menor por nível.' },
  { id: 'nk1', branch: 'castelo', name: 'Vigília Eterna', icon: 'icon_defense', max: 1, base: 400, x: 1120, y: 560, req: ['n10', 'n5'], excl: 'nk', fx: [['vigil', 1]],
    desc: 'ESCOLHA ÚNICA · Ataques que você não defender nunca levam humanos (só um pouco de Sangue).' },
  { id: 'nk2', branch: 'castelo', name: 'Caçada Real', icon: 'icon_raid', max: 1, base: 400, x: 1040, y: 680, req: ['n10', 'n5'], excl: 'nk', fx: [['defense', 1]],
    desc: 'ESCOLHA ÚNICA · Recompensas de defesa em dobro e +Essência por lobisomem abatido.' },
  // Caçada — battle mastery, cards and the roguelite loop.
  { id: 'h1', branch: 'caçada', name: 'Mapas de Sangue', icon: 'icon_map', max: 3, base: 35, x: 820, y: 700, req: ['lab'], fx: [['raidSize', 0.04]],
    desc: 'A leitura das rotas reduz em 4% o tamanho das hordas por nível.' },
  { id: 'h2', branch: 'caçada', name: 'Formação de Vanguarda', icon: 'icon_defense', max: 5, base: 55, x: 930, y: 620, req: ['h1'], fx: [['unitHp', 0.08]],
    desc: 'Unidades entram na arena com +8% de vida por nível.' },
  { id: 'h3', branch: 'caçada', name: 'Sangue em Reserva', icon: 'icon_blood', max: 5, base: 55, x: 1050, y: 560, req: ['h1'], fx: [['unitCost', 0.06]],
    desc: 'O banco inicial da batalha rende mais: defensores custam 6% menos por nível.' },
  { id: 'h4', branch: 'caçada', name: 'Golpe de Misericórdia', icon: 'icon_raid', max: 5, base: 70, x: 1080, y: 680, req: ['h2', 'h3'], fx: [['unitDmg', 0.1]],
    desc: 'Defensores causam +10% de dano por nível contra inimigos feridos.' },
  { id: 'hk1', branch: 'caçada', name: 'Mestre da Matilha', icon: 'icon_raid', max: 1, base: 500, x: 1130, y: 770, req: ['h4'], excl: 'hk', fx: [['defense', 0.75], ['essence', 0.2]],
    desc: 'ESCOLHA ÚNICA · +75% nas recompensas de defesa e +20% de Essência. A Caçada vira uma escola.' },
  { id: 'hk2', branch: 'caçada', name: 'Arsenal de Emergência', icon: 'icon_collect', max: 1, base: 500, x: 980, y: 770, req: ['h4'], excl: 'hk', fx: [['unitCost', 0.2], ['unitHp', 0.2]],
    desc: 'ESCOLHA ÚNICA · Defensores custam 20% menos e têm +20% de vida. Menos elegância, mais sobrevivência.' },
  // Domínio — long-term mandate identity and cross-system efficiency.
  { id: 'd1', branch: 'dominio', name: 'Censo do Crepúsculo', icon: 'icon_population', max: 3, base: 30, x: 390, y: 120, req: ['lab'], fx: [['moraleBlood', 0.08]],
    desc: 'Humanos com moral alta rendem +8% de Sangue por nível.' },
  { id: 'd2', branch: 'dominio', name: 'Tributo Negociado', icon: 'icon_prestige', max: 4, base: 60, x: 270, y: 80, req: ['d1'], fx: [['quota', 0.05]],
    desc: 'A cota da Sangria fica 5% menor por nível.' },
  { id: 'd3', branch: 'dominio', name: 'Escritório de Fronteira', icon: 'icon_contracts', max: 4, base: 60, x: 270, y: 165, req: ['d1'], fx: [['contractGold', 0.1]],
    desc: 'Contratos pagam +10% de Ouro por nível.' },
  { id: 'd4', branch: 'dominio', name: 'Cofres Interligados', icon: 'icon_gold', max: 3, base: 90, x: 150, y: 85, req: ['d2', 'd3'], fx: [['blood', 0.05], ['food', 0.08]],
    desc: '+5% de Sangue e +8% de Comida por nível: o domínio alimenta a fazenda.' },
  { id: 'dk1', branch: 'dominio', name: 'Lei da Casa', icon: 'icon_codex', max: 1, base: 500, x: 100, y: 175, req: ['d4'], excl: 'dk', fx: [['researchCost', 0.18], ['quota', 0.08]],
    desc: 'ESCOLHA ÚNICA · Pesquisas custam 18% menos e a cota cai mais 8%.' },
  { id: 'dk2', branch: 'dominio', name: 'Celeiro do Castelo', icon: 'icon_build', max: 1, base: 500, x: 210, y: 235, req: ['d4'], excl: 'dk', fx: [['food', 0.35], ['blood', 0.12]],
    desc: 'ESCOLHA ÚNICA · +35% de Comida e +12% de Sangue. Um domínio que nunca passa fome.' },
];

export const node = (id: string) => NODES.find(n => n.id === id)!;
export const lvl = (id: string) => state.research.lv[id] ?? 0;
// Systems ask `has('n1')` instead of knowing about the research UI.
export const has = (id: string) => lvl(id) > 0;
