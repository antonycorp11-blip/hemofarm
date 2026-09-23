import { L } from '../core/i18n';
// Crops for the vegetable plots (GDD_ADENDO A3). Placeholder textures are used until the crop art exists.
export type CropId = 'turnip' | 'potato' | 'cabbage';

export interface CropDef { name: string; growMs: number; yieldPerTile: number; desc: string }

export const CROPS: Record<CropId, CropDef> = {
  turnip: { name: L('Nabo', 'Turnip'), growMs: 60000, yieldPerTile: 1, desc: L('Rápido e modesto.', 'Fast and modest.') },
  potato: { name: L('Batata', 'Potato'), growMs: 90000, yieldPerTile: 2, desc: L('O equilíbrio da nutrição forçada.', 'The balance of forced nutrition.') },
  cabbage: { name: L('Repolho', 'Cabbage'), growMs: 140000, yieldPerTile: 3.5, desc: L('Demora, mas enche o refeitório.', 'Slow, but fills the dining hall.') },
};

export const FOOD_PER_MEAL = 1;
export const START_FOOD = 40;
export const WORK_MS = 5000;   // time a human spends planting or harvesting a plot
