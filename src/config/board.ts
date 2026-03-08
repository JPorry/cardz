import BOARD_DATA from './board.json'

export interface BoardConfig {
  width: number
  depth: number
  padding: number
  allowDirectTableCardDrop?: boolean
}

export interface LaneConfig {
  id: string
  label: string
  titlePosition?: 'top' | 'bottom' | 'left' | 'right'
  x: number
  y: number
  width: number
  depth: number
  cardSpacing: number
  flipped?: boolean
}

export type BoardActionTargetRef =
  | { kind: 'lane'; id: string }
  | { kind: 'region'; id: string }
  | { kind: 'hand' }

export type DeckSourcePosition = 'top' | 'bottom'
export type DeckInsertPosition = 'top' | 'bottom'
export type MatchValue = string | string[]

export interface CardMatchConfig {
  code?: MatchValue
  name?: MatchValue
  typeCode?: MatchValue
  cardSetCode?: MatchValue
}

export interface DealRegionAction {
  name: string
  type: 'deal'
  count: number
  from: DeckSourcePosition
  to: BoardActionTargetRef
}

export interface RecoverRegionAction {
  name: string
  type: 'recover'
  from: BoardActionTargetRef
  shuffle: boolean
}

export interface AdvanceRegionAction {
  name: string
  type: 'advance'
  count: number
}

export interface MergeRegionAction {
  name: string
  type: 'merge'
  to: { kind: 'region'; id: string }
  insertAt: DeckInsertPosition
  shuffle: boolean
}

export interface SequenceDealStepConfig {
  type: 'deal'
  from: DeckSourcePosition
  to: BoardActionTargetRef
  match?: CardMatchConfig
  count?: number
}

export interface SequenceMergeStepConfig {
  type: 'merge'
  to: { kind: 'region'; id: string }
  insertAt: DeckInsertPosition
  shuffle: boolean
}

export type SequenceStepConfig = SequenceDealStepConfig | SequenceMergeStepConfig

export interface SequenceRegionAction {
  name: string
  type: 'sequence'
  steps: SequenceStepConfig[]
}

export type RegionActionConfig =
  | DealRegionAction
  | RecoverRegionAction
  | AdvanceRegionAction
  | MergeRegionAction
  | SequenceRegionAction

export interface RegionConfig {
  id: string
  label: string
  titlePosition?: 'top' | 'bottom' | 'left' | 'right'
  x: number
  y: number
  width: number
  depth: number
  flipped?: boolean
  actions?: RegionActionConfig[]
}

export interface BoardLayoutConfig {
  board: BoardConfig
  lanes: LaneConfig[]
  regions: RegionConfig[]
}

type RawBoardData = {
  board: unknown
  lanes: unknown
  regions: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => isString(entry))
}

function parseTitlePosition(value: unknown, label: string): LaneConfig['titlePosition'] {
  if (value === undefined) return undefined
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') {
    return value
  }
  throw new Error(`Invalid ${label}. Expected top, bottom, left, or right.`)
}

function parseBoardConfig(value: unknown): BoardConfig {
  if (!isObject(value)) {
    throw new Error('Invalid board config. Expected an object.')
  }

  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.depth) || !isFiniteNumber(value.padding)) {
    throw new Error('Board config is missing valid width, depth, or padding values.')
  }

  if (value.allowDirectTableCardDrop !== undefined && !isBoolean(value.allowDirectTableCardDrop)) {
    throw new Error('Board config allowDirectTableCardDrop must be a boolean when provided.')
  }

  return {
    width: value.width,
    depth: value.depth,
    padding: value.padding,
    allowDirectTableCardDrop: value.allowDirectTableCardDrop,
  }
}

function parseLaneConfig(value: unknown, index: number): LaneConfig {
  if (!isObject(value)) {
    throw new Error(`Invalid lane config at index ${index}.`)
  }

  if (
    !isString(value.id)
    || !isString(value.label)
    || !isFiniteNumber(value.x)
    || !isFiniteNumber(value.y)
    || !isFiniteNumber(value.width)
    || !isFiniteNumber(value.depth)
    || !isFiniteNumber(value.cardSpacing)
  ) {
    throw new Error(`Lane config at index ${index} is missing required fields.`)
  }

  if (value.flipped !== undefined && !isBoolean(value.flipped)) {
    throw new Error(`Lane ${value.id} flipped must be a boolean when provided.`)
  }

  return {
    id: value.id,
    label: value.label,
    titlePosition: parseTitlePosition(value.titlePosition, `lane ${value.id} titlePosition`),
    x: value.x,
    y: value.y,
    width: value.width,
    depth: value.depth,
    cardSpacing: value.cardSpacing,
    flipped: value.flipped,
  }
}

function parseTargetRef(
  value: unknown,
  label: string,
  laneIds: Set<string>,
  regionIds: Set<string>,
): BoardActionTargetRef {
  if (!isObject(value) || !isString(value.kind)) {
    throw new Error(`Invalid ${label}. Expected a target object with a kind.`)
  }

  if (value.kind === 'hand') {
    return { kind: 'hand' }
  }

  if (value.kind === 'lane') {
    if (!isString(value.id)) {
      throw new Error(`Invalid ${label}. Lane targets require an id.`)
    }
    if (!laneIds.has(value.id)) {
      throw new Error(`Invalid ${label}. Unknown lane target "${value.id}".`)
    }
    return { kind: 'lane', id: value.id }
  }

  if (value.kind === 'region') {
    if (!isString(value.id)) {
      throw new Error(`Invalid ${label}. Region targets require an id.`)
    }
    if (!regionIds.has(value.id)) {
      throw new Error(`Invalid ${label}. Unknown region target "${value.id}".`)
    }
    return { kind: 'region', id: value.id }
  }

  throw new Error(`Invalid ${label}. Unsupported target kind "${value.kind}".`)
}

function parseMatchValue(value: unknown, label: string): MatchValue {
  if (isString(value)) return value
  if (isStringArray(value) && value.length > 0) return value
  throw new Error(`Invalid ${label}. Expected a string or non-empty string array.`)
}

function parseCardMatchConfig(value: unknown, label: string): CardMatchConfig {
  if (!isObject(value)) {
    throw new Error(`Invalid ${label}. Expected a match object.`)
  }

  const match: CardMatchConfig = {}

  if (value.code !== undefined) {
    match.code = parseMatchValue(value.code, `${label}.code`)
  }
  if (value.name !== undefined) {
    match.name = parseMatchValue(value.name, `${label}.name`)
  }
  if (value.typeCode !== undefined) {
    match.typeCode = parseMatchValue(value.typeCode, `${label}.typeCode`)
  }
  if (value.cardSetCode !== undefined) {
    match.cardSetCode = parseMatchValue(value.cardSetCode, `${label}.cardSetCode`)
  }

  if (
    match.code === undefined
    && match.name === undefined
    && match.typeCode === undefined
    && match.cardSetCode === undefined
  ) {
    throw new Error(`Invalid ${label}. Match object must include at least one field.`)
  }

  return match
}

function parseSequenceStep(
  value: unknown,
  regionId: string,
  actionName: string,
  stepIndex: number,
  laneIds: Set<string>,
  regionIds: Set<string>,
): SequenceStepConfig {
  if (!isObject(value) || !isString(value.type)) {
    throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} is invalid.`)
  }

  if (value.type === 'deal') {
    if (value.to === undefined) {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} is missing a destination target.`)
    }

    if (value.from !== undefined && value.from !== 'top' && value.from !== 'bottom') {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} has an invalid source position.`)
    }

    if (value.count !== undefined && (!isFiniteNumber(value.count) || value.count < 1)) {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} has an invalid count.`)
    }

    return {
      type: 'deal',
      from: value.from === 'bottom' ? 'bottom' : 'top',
      to: parseTargetRef(value.to, `region ${regionId} action "${actionName}" step ${stepIndex + 1} destination`, laneIds, regionIds),
      match: value.match !== undefined
        ? parseCardMatchConfig(value.match, `region ${regionId} action "${actionName}" step ${stepIndex + 1} match`)
        : undefined,
      count: value.count,
    }
  }

  if (value.type === 'merge') {
    if (!isObject(value.to) || value.to.kind !== 'region') {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} must target a region.`)
    }

    const target = parseTargetRef(
      value.to,
      `region ${regionId} action "${actionName}" step ${stepIndex + 1} destination`,
      laneIds,
      regionIds,
    )

    if (target.kind !== 'region') {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} must target a region.`)
    }

    if (target.id === regionId) {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} cannot target its own region.`)
    }

    if (value.insertAt !== undefined && value.insertAt !== 'top' && value.insertAt !== 'bottom') {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} has an invalid insertAt value.`)
    }

    if (value.shuffle !== undefined && !isBoolean(value.shuffle)) {
      throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} shuffle must be a boolean.`)
    }

    return {
      type: 'merge',
      to: target,
      insertAt: value.insertAt === 'bottom' ? 'bottom' : 'top',
      shuffle: value.shuffle ?? false,
    }
  }

  throw new Error(`Region ${regionId} action "${actionName}" step ${stepIndex + 1} has an unsupported type.`)
}

function parseRegionAction(
  value: unknown,
  regionId: string,
  index: number,
  laneIds: Set<string>,
  regionIds: Set<string>,
): RegionActionConfig {
  if (!isObject(value)) {
    throw new Error(`Invalid action at index ${index} for region ${regionId}.`)
  }

  if (!isString(value.name) || value.name.trim().length === 0) {
    throw new Error(`Region ${regionId} action at index ${index} is missing a valid name.`)
  }

  const actionName = value.name

  if (value.type === 'deal') {
    if (value.to === undefined) {
      throw new Error(`Region ${regionId} action "${actionName}" is missing a destination target.`)
    }

    if (value.count !== undefined && (!isFiniteNumber(value.count) || value.count < 1)) {
      throw new Error(`Region ${regionId} action "${actionName}" has an invalid count.`)
    }

    if (value.from !== undefined && value.from !== 'top' && value.from !== 'bottom') {
      throw new Error(`Region ${regionId} action "${actionName}" has an invalid source position.`)
    }

    return {
      name: actionName,
      type: 'deal',
      count: value.count ?? 1,
      from: value.from === 'bottom' ? 'bottom' : 'top',
      to: parseTargetRef(value.to, `region ${regionId} action "${actionName}" destination`, laneIds, regionIds),
    }
  }

  if (value.type === 'recover') {
    if (value.from === undefined) {
      throw new Error(`Region ${regionId} action "${actionName}" is missing a source target.`)
    }

    if (value.shuffle !== undefined && !isBoolean(value.shuffle)) {
      throw new Error(`Region ${regionId} action "${actionName}" shuffle must be a boolean.`)
    }

    return {
      name: actionName,
      type: 'recover',
      from: parseTargetRef(value.from, `region ${regionId} action "${actionName}" source`, laneIds, regionIds),
      shuffle: value.shuffle ?? false,
    }
  }

  if (value.type === 'advance') {
    if (value.count !== undefined && (!isFiniteNumber(value.count) || value.count < 1)) {
      throw new Error(`Region ${regionId} action "${actionName}" has an invalid count.`)
    }

    return {
      name: actionName,
      type: 'advance',
      count: value.count ?? 1,
    }
  }

  if (value.type === 'merge') {
    if (!isObject(value.to) || value.to.kind !== 'region') {
      throw new Error(`Region ${regionId} action "${actionName}" must target a region.`)
    }

    const target = parseTargetRef(value.to, `region ${regionId} action "${actionName}" destination`, laneIds, regionIds)
    if (target.kind !== 'region') {
      throw new Error(`Region ${regionId} action "${actionName}" must target a region.`)
    }

    if (target.id === regionId) {
      throw new Error(`Region ${regionId} action "${actionName}" cannot target its own region.`)
    }

    if (value.insertAt !== undefined && value.insertAt !== 'top' && value.insertAt !== 'bottom') {
      throw new Error(`Region ${regionId} action "${actionName}" has an invalid insertAt value.`)
    }

    if (value.shuffle !== undefined && !isBoolean(value.shuffle)) {
      throw new Error(`Region ${regionId} action "${actionName}" shuffle must be a boolean.`)
    }

    return {
      name: actionName,
      type: 'merge',
      to: target,
      insertAt: value.insertAt === 'bottom' ? 'bottom' : 'top',
      shuffle: value.shuffle ?? false,
    }
  }

  if (value.type === 'sequence') {
    if (!Array.isArray(value.steps) || value.steps.length === 0) {
      throw new Error(`Region ${regionId} action "${actionName}" must include a non-empty steps array.`)
    }

    return {
      name: actionName,
      type: 'sequence',
      steps: value.steps.map((step, stepIndex) => (
        parseSequenceStep(step, regionId, actionName, stepIndex, laneIds, regionIds)
      )),
    }
  }

  throw new Error(`Region ${regionId} action "${actionName}" has an unsupported type.`)
}

function parseRegionConfig(
  value: unknown,
  index: number,
  laneIds: Set<string>,
  regionIds: Set<string>,
): RegionConfig {
  if (!isObject(value)) {
    throw new Error(`Invalid region config at index ${index}.`)
  }

  if (
    !isString(value.id)
    || !isString(value.label)
    || !isFiniteNumber(value.x)
    || !isFiniteNumber(value.y)
    || !isFiniteNumber(value.width)
    || !isFiniteNumber(value.depth)
  ) {
    throw new Error(`Region config at index ${index} is missing required fields.`)
  }

  if (value.flipped !== undefined && !isBoolean(value.flipped)) {
    throw new Error(`Region ${value.id} flipped must be a boolean when provided.`)
  }

  if (value.actions !== undefined && !Array.isArray(value.actions)) {
    throw new Error(`Region ${value.id} actions must be an array when provided.`)
  }

  const regionId = value.id

  return {
    id: regionId,
    label: value.label,
    titlePosition: parseTitlePosition(value.titlePosition, `region ${regionId} titlePosition`),
    x: value.x,
    y: value.y,
    width: value.width,
    depth: value.depth,
    flipped: value.flipped,
    actions: value.actions?.map((action, actionIndex) => (
      parseRegionAction(action, regionId, actionIndex, laneIds, regionIds)
    )),
  }
}

function parseBoardLayout(value: unknown): BoardLayoutConfig {
  if (!isObject(value)) {
    throw new Error('Invalid board layout config.')
  }

  const rawData = value as RawBoardData
  if (!Array.isArray(rawData.lanes) || !Array.isArray(rawData.regions)) {
    throw new Error('Board layout config must include lanes and regions arrays.')
  }

  const lanes = rawData.lanes.map(parseLaneConfig)
  const laneIds = new Set<string>()
  lanes.forEach((lane) => {
    if (laneIds.has(lane.id)) {
      throw new Error(`Duplicate lane id "${lane.id}" in board config.`)
    }
    laneIds.add(lane.id)
  })

  const rawRegions = rawData.regions.map((region, index): { id: string } & Record<string, unknown> => {
    if (!isObject(region) || !isString(region.id)) {
      throw new Error(`Region config at index ${index} is missing a valid id.`)
    }
    return region as { id: string } & Record<string, unknown>
  })
  const regionIds = new Set<string>()
  rawRegions.forEach((region) => {
    if (regionIds.has(region.id)) {
      throw new Error(`Duplicate region id "${region.id}" in board config.`)
    }
    regionIds.add(region.id)
  })

  return {
    board: parseBoardConfig(rawData.board),
    lanes,
    regions: rawData.regions.map((region, index) => parseRegionConfig(region, index, laneIds, regionIds)),
  }
}

export const BOARD_LAYOUT = parseBoardLayout(BOARD_DATA)
export const BOARD_CONFIG = BOARD_LAYOUT.board
export const BOARD_LANES = BOARD_LAYOUT.lanes
export const BOARD_REGIONS = BOARD_LAYOUT.regions

const REGION_CONFIG_MAP = new Map(BOARD_REGIONS.map((region) => [region.id, region]))

export function getRegionConfig(regionId: string): RegionConfig | undefined {
  return REGION_CONFIG_MAP.get(regionId)
}
