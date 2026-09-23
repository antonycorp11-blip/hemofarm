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
  HUMAN_INSPECTED: { humanId: number };
  CONTRACT_ACCEPTED: { contractId: string };
  CONTRACT_COMPLETED: { contractId: string; delivered: number; gold: number };
  CONTRACT_FAILED: { contractId: string };
  BOND_FORMED: { a: number; b: number; arranged: boolean };
  HEIR_ARRIVED: { humanId: number; parents: number[]; quality: string; blood: string; code: string; parentNames: string[] };
  HEIR_BLOCKED: { reason: 'capacity' };
  RESEARCH_STARTED: { nodeId: string };
  RESEARCH_DONE: { nodeId: string };
  EVENT_RAISED: { eventId: string };
  EVENT_RESOLVED: { eventId: string };
  REBELLION_STARTED: Record<string, never>;
  REBELLION_ENDED: Record<string, never>;
  RAID_WARNING: { big: boolean };
  RAID_ENDED: { result: 'won' | 'lost' | 'auto'; losses: number };
  NIGHT_STARTED: { night: number; quota: number };
  CARRIAGE_ARRIVED: { night: number };
  TITHE_PAID: { night: number; amount: number; prestige: number };
  TITHE_FAILED: { night: number; deficit: number; taken: number; strikes: number };
  HUMAN_TAKEN: { humanId: number; by: 'tithe' | 'raid' };
  MANDATE_REVOKED: { night: number };
  LINEAGE_DISCOVERED: { key: string; name: string; total: number };
  ORB_TAPPED: { amount: number };
  UPGRADE_BOUGHT: { kind: string; level: number };
  ORDER_DONE: { kind: string };
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
