// Relics (roguelite choice): every 3 nights the castle offers 1 of 3. They last until the end of the mandate.
import type { Fx } from './research';
import { L } from '../core/i18n';

export interface Relic { name: string; desc: string; icon: string; fx: [Fx, number][] }

export const RELICS: Record<string, Relic> = {
  seringa: { name: L('Seringa Dourada', 'Golden Syringe'), icon: 'icon_blood', desc: L('+20% de Sangue por coleta.', '+20% Blood per collection.'), fx: [['blood', 0.2]] },
  calice: { name: L('Cálice de Prata', 'Silver Chalice'), icon: 'icon_blood', desc: L('Cálices geram +50% na batalha.', 'Chalices make +50% in battle.'), fx: [['chalice', 0.5]] },
  presas: { name: L('Presas de Lua', 'Moon Fangs'), icon: 'icon_defense', desc: L('Defensores causam +25% de dano.', 'Defenders deal +25% damage.'), fx: [['unitDmg', 0.25]] },
  pergaminho: { name: L('Pergaminho Selado', 'Sealed Scroll'), icon: 'icon_contracts', desc: L('Contratos pagam +40% de Ouro.', 'Contracts pay +40% Gold.'), fx: [['contractGold', 0.4]] },
  colheita: { name: L('Foice Antiga', 'Ancient Scythe'), icon: 'icon_build', desc: L('+40% de Comida e plantas 20% mais rápidas.', '+40% Food and crops 20% faster.'), fx: [['harvest', 0.4], ['grow', 0.2]] },
  corvo: { name: L('Pena de Corvo', 'Raven Feather'), icon: 'icon_blood', desc: L('Orbes aparecem com o dobro da frequência.', 'Orbs appear twice as often.'), fx: [['orbRate', 1]] },
  selo: { name: L('Selo de Vesper', 'Vesper\'s Seal'), icon: 'icon_prestige', desc: L('Cota da Sangria 15% menor.', 'Bloodletting quota 15% lower.'), fx: [['quota', 0.15]] },
  coracao: { name: L('Coração Pulsante', 'Beating Heart'), icon: 'icon_vitality', desc: L('Vitalidade recupera 40% mais rápido.', 'Vitality recovers 40% faster.'), fx: [['regen', 0.4]] },
  anel: { name: L('Anel de Noivado', 'Engagement Ring'), icon: 'icon_morale', desc: L('Casais se formam e chamam parentes 50% mais rápido.', 'Couples form and send for relatives 50% faster.'), fx: [['bond', 0.5], ['kin', 0.5]] },
  frasco: { name: L('Frasco Etéreo', 'Ethereal Flask'), icon: 'icon_research', desc: L('+40% de Essência.', '+40% Essence.'), fx: [['essence', 0.4]] },
  sino: { name: L('Sino de Prata', 'Silver Bell'), icon: 'icon_bell', desc: L('Ataques trazem 20% menos lobisomens.', 'Attacks bring 20% fewer werewolves.'), fx: [['raidSize', 0.2]] },
  tomo: { name: L('Tomo Proibido', 'Forbidden Tome'), icon: 'icon_codex', desc: L('Pesquisas custam 20% menos Essência.', 'Research costs 20% less Essence.'), fx: [['researchCost', 0.2]] },
  ampulheta: { name: L('Ampulheta Rachada', 'Cracked Hourglass'), icon: 'icon_time', desc: L('Coleta 20% mais rápida.', 'Collection 20% faster.'), fx: [['collectSpeed', 0.2]] },
  escudo: { name: L('Brasão da Casa', 'House Crest'), icon: 'icon_defense', desc: L('Defensores com +30% de vida e 10% mais baratos.', 'Defenders with +30% health and 10% cheaper.'), fx: [['unitHp', 0.3], ['unitCost', 0.1]] },
};

export const RELIC_EVERY = 3;
