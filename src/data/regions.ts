// Regional map (GDD §13). Each mandate runs in one region; regions change the rules, not just the look.
// x/y are percentages on the regional map image.
export type RegionId = 'bosque' | 'pantano' | 'fronteira' | 'vale' | 'costa' | 'cripta';

export interface RegionMods {
  quota?: number; blood?: number; regen?: number; hunger?: number; collectTime?: number; researchTime?: number;
  contractGold?: number; raidChance?: number; bigEvery?: number; unitCost?: number; qualityBoost?: number; startHumans?: number;
}

export interface Region { name: string; tag: string; desc: string; x: number; y: number; unlock: number; tint: number; mods: RegionMods }

export const REGIONS: Record<RegionId, Region> = {
  bosque: { name: 'Bosque Cinzento', tag: 'Equilibrado', x: 30, y: 45, unlock: 0, tint: 0xffffff,
    desc: 'Onde tudo começou. Nenhuma surpresa além das habituais.', mods: {} },
  pantano: { name: 'Pântano Carmesim', tag: 'Produção', x: 22, y: 78, unlock: 1, tint: 0xffd4d4,
    desc: '+20% recuperação de vitalidade e +15% Sangue, mas a fome sobe 25% mais rápido.', mods: { regen: 1.2, blood: 1.15, hunger: 1.25 } },
  fronteira: { name: 'Fronteira da Lua Rasgada', tag: 'Defesa', x: 50, y: 18, unlock: 1, tint: 0xd8dcff,
    desc: 'Ataques quase toda noite e lua cheia a cada 3 noites. Defensores custam 25% menos.', mods: { raidChance: 0.8, bigEvery: 3, unitCost: 0.75 } },
  vale: { name: 'Vale do Sol Fraco', tag: 'Qualidade', x: 78, y: 45, unlock: 2, tint: 0xfff0c8,
    desc: 'Humanos melhores desde o início (+30% de chance de qualidade), mas a coleta é 25% mais lenta.', mods: { qualityBoost: 0.3, collectTime: 1.25 } },
  costa: { name: 'Costa do Nevoeiro', tag: 'Comércio', x: 76, y: 80, unlock: 2, tint: 0xd8e8ff,
    desc: 'Contratos pagam 35% a mais. O castelo cobra 10% a mais de Dízimo.', mods: { contractGold: 1.35, quota: 1.1 } },
  cripta: { name: 'Cripta de Vesper', tag: 'Processamento', x: 80, y: 16, unlock: 3, tint: 0xe0d0f0,
    desc: 'Pesquisas 40% mais rápidas, mas começa com 2 humanos a menos.', mods: { researchTime: 0.6, startHumans: -2 } },
};
