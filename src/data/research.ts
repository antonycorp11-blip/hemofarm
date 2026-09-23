// Dr. Hemático's research tree (GDD_ADENDO A4). Each node is a named perk the systems check with `has()`.
import { state } from '../core/state';

export type Branch = 'coleta' | 'bemestar' | 'agricultura' | 'genetica' | 'logistica' | 'defesa';

export interface Node { id: string; branch: Branch; tier: 1 | 2 | 3; name: string; desc: string; locked?: string }

export const BRANCHES: Record<Branch, { name: string; icon: string }> = {
  coleta: { name: 'Coleta', icon: 'icon_collect' },
  bemestar: { name: 'Bem-estar', icon: 'icon_morale' },
  agricultura: { name: 'Agricultura', icon: 'icon_build' },
  genetica: { name: 'Genética', icon: 'icon_vitality' },
  logistica: { name: 'Logística', icon: 'icon_contracts' },
  defesa: { name: 'Defesa', icon: 'icon_defense' },
};

export const TIER_COST = {
  1: { blood: 60, prestige: 5, ms: 45000 },
  2: { blood: 150, prestige: 15, ms: 90000 },
  3: { blood: 300, prestige: 30, ms: 150000 },
} as const;

export const NODES: Node[] = [
  { id: 'c1', branch: 'coleta', tier: 1, name: 'Válvulas Afinadas', desc: '+20% de Sangue por coleta.' },
  { id: 'c2', branch: 'coleta', tier: 2, name: 'Recuperação Assistida', desc: 'Cada coleta tira 20 de vitalidade em vez de 30.' },
  { id: 'c3', branch: 'coleta', tier: 3, name: 'Fila Expressa', desc: 'Coleta 30% mais rápida.' },
  { id: 'w1', branch: 'bemestar', tier: 1, name: 'Ração Nutritiva', desc: 'Vitalidade recupera 50% mais rápido.' },
  { id: 'w2', branch: 'bemestar', tier: 2, name: 'Colchões Decentes', desc: 'Sono 30% mais curto e +2 de moral ao acordar.' },
  { id: 'w3', branch: 'bemestar', tier: 3, name: 'Música Ambiente', desc: 'A moral sobe devagar sozinha. Salvo a do Davi.' },
  { id: 'a1', branch: 'agricultura', tier: 1, name: 'Adubo de Ossos', desc: 'Plantas crescem 25% mais rápido.' },
  { id: 'a2', branch: 'agricultura', tier: 2, name: 'Irrigação Noturna', desc: '+25% de Comida por colheita.' },
  { id: 'a3', branch: 'agricultura', tier: 3, name: 'Sementes Selecionadas', desc: '+25% de velocidade e +25% de colheita.' },
  { id: 'g1', branch: 'genetica', tier: 1, name: 'Cartas Perfumadas', desc: 'Parentes chegam 30% mais rápido.' },
  { id: 'g2', branch: 'genetica', tier: 2, name: 'Registro de Linhagens', desc: '+10% de chance do parente subir de qualidade.' },
  { id: 'g3', branch: 'genetica', tier: 3, name: 'Afinidade Induzida', desc: 'Casais se formam duas vezes mais rápido.' },
  { id: 'l1', branch: 'logistica', tier: 1, name: 'Carruagens Pontuais', desc: 'O castelo paga +25% de Ouro pelo Dízimo.' },
  { id: 'l2', branch: 'logistica', tier: 2, name: 'Contratos Premium', desc: '+20% de Ouro em todos os contratos.' },
  { id: 'l3', branch: 'logistica', tier: 3, name: 'Rotas Noturnas', desc: 'Uma oferta de contrato a mais por noite.' },
  { id: 'd1', branch: 'defesa', tier: 1, name: 'Gárgulas', desc: 'Libera a Gárgula na batalha: abate o primeiro lobisomem que se aproxima.' },
  { id: 'd2', branch: 'defesa', tier: 2, name: 'Alquimia de Guerra', desc: 'Libera o Alquimista: frascos em área que deixam lento.' },
  { id: 'd3', branch: 'defesa', tier: 3, name: 'Nuvem de Morcegos', desc: 'Libera a Nuvem de Morcegos: arrasa uma área 3×3.' },
];

// Systems ask `has('c1')` instead of knowing about the research UI.
export const has = (id: string) => state.research.done.includes(id);
