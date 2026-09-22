// Semantic event bus (GDD §9). Systems emit what happened; tutorial, quests and UI listen.
export interface GameEvents {
  HUMAN_CREATED: { humanId: number; source: string };
  HUMAN_ATE: { humanId: number };
  BLOOD_COLLECTED: { humanId: number; amount: number; vitalityAfter: number };
  MORALE_THRESHOLD: { humanId: number; value: number; direction: 'up' | 'down' };
  BUILDING_BUILT: { buildingId: string; kind: string; level: number };
  BUILDING_UPGRADED: { buildingId: string; kind: string; oldLevel: number; newLevel: number };
  CROP_PLANTED: { plotId: string; crop: string };
  CROP_HARVESTED: { plotId: string; crop: string; food: number };
  NIGHT_STARTED: { night: number; quota: number };
  CARRIAGE_ARRIVED: { night: number };
  TITHE_PAID: { night: number; amount: number; prestige: number };
  TITHE_FAILED: { night: number; deficit: number; taken: number; strikes: number };
  HUMAN_TAKEN: { humanId: number; by: 'tithe' | 'raid' };
  MANDATE_REVOKED: { night: number };
}

type Handler<T> = (payload: T) => void;
const handlers: Partial<Record<keyof GameEvents, Handler<any>[]>> = {};

export const bus = {
  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>) {
    (handlers[type] ??= [] as Handler<any>[]).push(fn);
    return () => { handlers[type] = handlers[type]!.filter(h => h !== fn); };
  },
  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]) {
    for (const fn of handlers[type] ?? []) fn(payload);
  },
};
