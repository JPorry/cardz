export interface CardCounters {
  damage: number
  acceleration: number
  threat: number
  allPurpose: number
}

export interface CardStatuses {
  stunned: boolean
  confused: boolean
  tough: boolean
}

export type CardCounterKey = keyof CardCounters
export type CardStatusKey = keyof CardStatuses

export const CARD_COUNTER_BADGE_COLORS: Record<CardCounterKey, string> = {
  damage: '#e53935',
  acceleration: '#fb8c00',
  threat: '#1e88e5',
  allPurpose: '#43a047',
}

export const CARD_STATUS_BADGE_COLORS: Record<CardStatusKey, string> = {
  stunned: '#d81b60',
  confused: '#5e35b1',
  tough: '#2e7d32',
}

export const DEFAULT_CARD_COUNTERS: CardCounters = {
  damage: 0,
  acceleration: 0,
  threat: 0,
  allPurpose: 0,
}

export const DEFAULT_CARD_STATUSES: CardStatuses = {
  stunned: false,
  confused: false,
  tough: false,
}

export function clampCounterValue(value: number): number {
  return Math.max(0, Math.floor(value))
}

export function normalizeCardCounters(value?: Partial<CardCounters> | null): CardCounters {
  return {
    damage: clampCounterValue(value?.damage ?? 0),
    acceleration: clampCounterValue(value?.acceleration ?? 0),
    threat: clampCounterValue(value?.threat ?? 0),
    allPurpose: clampCounterValue(value?.allPurpose ?? 0),
  }
}

export function normalizeCardStatuses(value?: Partial<CardStatuses> | null): CardStatuses {
  return {
    stunned: Boolean(value?.stunned),
    confused: Boolean(value?.confused),
    tough: Boolean(value?.tough),
  }
}

export function createDefaultCardMetadata() {
  return {
    counters: normalizeCardCounters(),
    statuses: normalizeCardStatuses(),
  }
}

export function hasVisibleCardMetadata(
  counters: CardCounters,
  statuses: CardStatuses,
): boolean {
  return (
    counters.damage > 0
    || counters.acceleration > 0
    || counters.threat > 0
    || counters.allPurpose > 0
    || statuses.stunned
    || statuses.confused
    || statuses.tough
  )
}
