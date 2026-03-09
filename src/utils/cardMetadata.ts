import type {
  CardCounterDefinition,
  CardCounters,
  CardStatusDefinition,
  CardStatuses,
  GameCardSemantics,
} from '../games/types'

export type CardCounterKey = string
export type CardStatusKey = string

export function clampCounterValue(value: number): number {
  return Math.max(0, Math.floor(value))
}

export function normalizeCardCounters(
  semantics: GameCardSemantics,
  value?: Record<string, unknown> | null,
): CardCounters {
  return Object.fromEntries(
    semantics.counters.map((counter) => [
      counter.key,
      clampCounterValue(typeof value?.[counter.key] === 'number' ? value[counter.key] as number : 0),
    ]),
  )
}

export function normalizeCardStatuses(
  semantics: GameCardSemantics,
  value?: Record<string, unknown> | null,
): CardStatuses {
  return Object.fromEntries(
    semantics.statuses.map((status) => [
      status.key,
      Boolean(value?.[status.key]),
    ]),
  )
}

export function createDefaultCardMetadata(semantics: GameCardSemantics) {
  return {
    counters: normalizeCardCounters(semantics),
    statuses: normalizeCardStatuses(semantics),
  }
}

export function hasVisibleCardMetadata(
  semantics: GameCardSemantics,
  counters: CardCounters,
  statuses: CardStatuses,
): boolean {
  return semantics.counters.some((counter) => (counters[counter.key] ?? 0) > 0)
    || semantics.statuses.some((status) => Boolean(statuses[status.key]))
}

export function getCounterBadgeColors(definitions: CardCounterDefinition[]): Record<string, string> {
  return Object.fromEntries(definitions.map((definition) => [definition.key, definition.color]))
}

export function getStatusBadgeColors(definitions: CardStatusDefinition[]): Record<string, string> {
  return Object.fromEntries(definitions.map((definition) => [definition.key, definition.color]))
}
