// Relics (roguelite choice): every 3 nights the castle offers 1 of 3. They last until the end of the mandate.
import type { Fx } from './research';

export interface Relic { name: string; desc: string; icon: string; fx: [Fx, number][] }

export const RELICS: Record<string, Relic> = {
  seringa: { name: 'Seringa Dourada', icon: 'icon_blood', desc: '+20% de Sangue por coleta.', fx: [['blood', 0.2]] },
  calice: { name: 'Cálice de Prata', icon: 'icon_blood', desc: 'Cálices geram +50% na batalha.', fx: [['chalice', 0.5]] },
  presas: { name: 'Presas de Lua', icon: 'icon_defense', desc: 'Defensores causam +25% de dano.', fx: [['unitDmg', 0.25]] },
  pergaminho: { name: 'Pergaminho Selado', icon: 'icon_contracts', desc: 'Contratos pagam +40% de Ouro.', fx: [['contractGold', 0.4]] },
  colheita: { name: 'Foice Antiga', icon: 'icon_build', desc: '+40% de Comida e plantas 20% mais rápidas.', fx: [['harvest', 0.4], ['grow', 0.2]] },
  corvo: { name: 'Pena de Corvo', icon: 'icon_blood', desc: 'Orbes aparecem com o dobro da frequência.', fx: [['orbRate', 1]] },
  selo: { name: 'Selo de Vesper', icon: 'icon_prestige', desc: 'Cota da Sangria 15% menor.', fx: [['quota', 0.15]] },
  coracao: { name: 'Coração Pulsante', icon: 'icon_vitality', desc: 'Vitalidade recupera 40% mais rápido.', fx: [['regen', 0.4]] },
  anel: { name: 'Anel de Noivado', icon: 'icon_morale', desc: 'Casais se formam e chamam parentes 50% mais rápido.', fx: [['bond', 0.5], ['kin', 0.5]] },
  frasco: { name: 'Frasco Etéreo', icon: 'icon_research', desc: '+40% de Essência.', fx: [['essence', 0.4]] },
  sino: { name: 'Sino de Prata', icon: 'icon_bell', desc: 'Ataques trazem 20% menos lobisomens.', fx: [['raidSize', 0.2]] },
  tomo: { name: 'Tomo Proibido', icon: 'icon_codex', desc: 'Pesquisas custam 20% menos Essência.', fx: [['researchCost', 0.2]] },
  ampulheta: { name: 'Ampulheta Rachada', icon: 'icon_time', desc: 'Coleta 20% mais rápida.', fx: [['collectSpeed', 0.2]] },
  escudo: { name: 'Brasão da Casa', icon: 'icon_defense', desc: 'Defensores com +30% de vida e 10% mais baratos.', fx: [['unitHp', 0.3], ['unitCost', 0.1]] },
};

export const RELIC_EVERY = 3;
