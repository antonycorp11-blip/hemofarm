import { L } from '../core/i18n';
// Regional map (GDD §13). Each mandate runs in one region; regions change the rules, not just the look.
// x/y are percentages on the regional map image.
export type RegionId = 'bosque' | 'pantano' | 'fronteira' | 'vale' | 'costa' | 'cripta';

export interface RegionMods {
  quota?: number; blood?: number; regen?: number; hunger?: number; collectTime?: number; researchTime?: number;
  contractGold?: number; raidChance?: number; bigEvery?: number; unitCost?: number; qualityBoost?: number; startHumans?: number;
}

export interface Region { name: string; tag: string; desc: string; x: number; y: number; unlock: number; tint: number; mods: RegionMods }

export const REGIONS: Record<RegionId, Region> = {
  bosque: { name: L('Bosque Cinzento', 'Grey Woods'), tag: L('Equilibrado', 'Balanced'), x: 30, y: 45, unlock: 0, tint: 0xffffff,
    desc: L('Onde tudo começou. Nenhuma surpresa além das habituais.', 'Where it all began. No surprises beyond the usual ones.'), mods: {} },
  pantano: { name: L('Pântano Carmesim', 'Crimson Marsh'), tag: L('Produção', 'Production'), x: 22, y: 78, unlock: 1, tint: 0xffd4d4,
    desc: L('+20% recuperação de vitalidade e +15% Sangue, mas a fome sobe 25% mais rápido.', '+20% vitality recovery and +15% Blood, but hunger rises 25% faster.'), mods: { regen: 1.2, blood: 1.15, hunger: 1.25 } },
  fronteira: { name: L('Fronteira da Lua Rasgada', 'Torn Moon Frontier'), tag: L('Defesa', 'Defense'), x: 50, y: 18, unlock: 1, tint: 0xd8dcff,
    desc: L('Ataques quase toda noite e lua cheia a cada 3 noites. Defensores custam 25% menos.', 'Attacks almost every night and a full moon every 3 nights. Defenders cost 25% less.'), mods: { raidChance: 0.8, bigEvery: 3, unitCost: 0.75 } },
  vale: { name: L('Vale do Sol Fraco', 'Valley of the Weak Sun'), tag: L('Qualidade', 'Quality'), x: 78, y: 45, unlock: 2, tint: 0xfff0c8,
    desc: L('Humanos melhores desde o início (+30% de chance de qualidade), mas a coleta é 25% mais lenta.', 'Better humans from the start (+30% quality chance), but collection is 25% slower.'), mods: { qualityBoost: 0.3, collectTime: 1.25 } },
  costa: { name: L('Costa do Nevoeiro', 'Fog Coast'), tag: L('Comércio', 'Trade'), x: 76, y: 80, unlock: 2, tint: 0xd8e8ff,
    desc: L('Contratos pagam 35% a mais. O castelo cobra 10% a mais na Sangria.', 'Contracts pay 35% more. The castle charges 10% more Bloodletting.'), mods: { contractGold: 1.35, quota: 1.1 } },
  cripta: { name: L('Cripta de Vesper', 'Vesper\'s Crypt'), tag: L('Processamento', 'Processing'), x: 80, y: 16, unlock: 3, tint: 0xe0d0f0,
    desc: L('Pesquisas 40% mais rápidas, mas começa com 2 humanos a menos.', 'Research 40% faster, but you start with 2 fewer humans.'), mods: { researchTime: 0.6, startHumans: -2 } },
};
