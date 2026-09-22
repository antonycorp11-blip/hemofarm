// Crops for the vegetable plots (GDD_ADENDO A3). Placeholder textures are used until the crop art exists.
export type CropId = 'turnip' | 'potato' | 'cabbage';

export interface CropDef { name: string; growMs: number; yieldPerTile: number; desc: string }

export const CROPS: Record<CropId, CropDef> = {
  turnip: { name: 'Nabo', growMs: 60000, yieldPerTile: 1, desc: 'Rápido e modesto.' },
  potato: { name: 'Batata', growMs: 90000, yieldPerTile: 2, desc: 'O equilíbrio da nutrição forçada.' },
  cabbage: { name: 'Repolho', growMs: 140000, yieldPerTile: 3.5, desc: 'Demora, mas enche o refeitório.' },
};

export const FOOD_PER_MEAL = 1;
export const START_FOOD = 40;
export const WORK_MS = 5000;   // time a human spends planting or harvesting a plot
