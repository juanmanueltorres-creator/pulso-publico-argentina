import type {
  BaseTerritorialEvent,
  EarthquakeEvent,
  HotspotConfidence,
  TerritorialKind,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'

const CONFIDENCE_VALUES: HotspotConfidence[] = ['low', 'nominal', 'high', 'unknown']
const METHOD_TYPES = ['scrape', 'wfs'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} must be a non-empty string`)
  }
  return value
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`)
  return value
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`)
  }
  return value
}

function requireNullableFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number or null`)
  }
  return value
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key)
  if (Number.isNaN(Date.parse(value))) throw new Error(`${key} must be a valid timestamp`)
  return value
}

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = record[key]
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${key} has an unsupported value`)
  }
  return value as T
}

function validateBaseEvent(record: Record<string, unknown>, expectedKind: TerritorialKind) {
  const kind = requireString(record, 'kind')
  if (kind !== expectedKind) throw new Error(`event kind must be ${expectedKind}`)

  const latitude = requireFiniteNumber(record, 'latitude')
  const longitude = requireFiniteNumber(record, 'longitude')
  if (latitude < -90 || latitude > 90) throw new Error('latitude must be between -90 and 90')
  if (longitude < -180 || longitude > 180) throw new Error('longitude must be between -180 and 180')

  return {
    id: requireString(record, 'id'),
    kind: expectedKind,
    occurredAt: requireTimestamp(record, 'occurredAt'),
    latitude,
    longitude,
  }
}

function validateEarthquakeEvent(input: unknown): EarthquakeEvent {
  if (!isRecord(input)) throw new Error('earthquake event must be an object')
  const base = validateBaseEvent(input, 'earthquake')

  return {
    ...base,
    kind: 'earthquake',
    magnitude: requireFiniteNumber(input, 'magnitude'),
    depthKm: requireNullableFiniteNumber(input, 'depthKm'),
    place: requireNullableString(input, 'place'),
    province: requireNullableString(input, 'province'),
    intensityText: requireNullableString(input, 'intensityText'),
  }
}

function validateHotspotEvent(input: unknown): ThermalHotspotEvent {
  if (!isRecord(input)) throw new Error('thermal hotspot event must be an object')
  const base = validateBaseEvent(input, 'thermal-hotspot')

  return {
    ...base,
    kind: 'thermal-hotspot',
    confidence: requireEnum(input, 'confidence', CONFIDENCE_VALUES),
    frpMw: requireNullableFiniteNumber(input, 'frpMw'),
    sensor: requireNullableString(input, 'sensor'),
    satellite: requireNullableString(input, 'satellite'),
  }
}

function validateCommonSnapshot(input: unknown, expectedKind: TerritorialKind) {
  if (!isRecord(input)) throw new Error('territorial snapshot must be an object')
  if (input.schemaVersion !== '1.0') throw new Error('snapshot schemaVersion must be 1.0')
  if (input.kind !== expectedKind) throw new Error(`snapshot kind must be ${expectedKind}`)

  if (!isRecord(input.window)) throw new Error('window must be an object')
  const windowHours = requireFiniteNumber(input.window, 'hours')
  const requiredHours = expectedKind === 'earthquake' ? 168 : 24
  if (windowHours !== requiredHours) {
    throw new Error(`window hours must be ${requiredHours} for ${expectedKind}`)
  }

  if (!isRecord(input.freshness)) throw new Error('freshness must be an object')
  const staleAfterMinutes = requireFiniteNumber(input.freshness, 'staleAfterMinutes')
  if (staleAfterMinutes <= 0) throw new Error('staleAfterMinutes must be positive')

  if (!isRecord(input.source)) throw new Error('source must be an object')
  if (input.source.kind !== 'official') throw new Error('source kind must be official')

  if (!isRecord(input.method)) throw new Error('method must be an object')

  if (!Array.isArray(input.limitations) || input.limitations.some((item) => typeof item !== 'string')) {
    throw new Error('limitations must be an array of strings')
  }
  if (!Array.isArray(input.events)) throw new Error('events must be an array')

  return {
    events: input.events,
    generatedAt: requireTimestamp(input, 'generatedAt'),
    sourceCheckedAt: requireTimestamp(input, 'sourceCheckedAt'),
    windowHours,
    staleAfterMinutes,
    source: {
      name: requireString(input.source, 'name'),
      url: requireString(input.source, 'url'),
      kind: 'official' as const,
    },
    method: {
      type: requireEnum(input.method, 'type', METHOD_TYPES),
      note: requireString(input.method, 'note'),
    },
    limitations: [...input.limitations],
  }
}

export function validateTerritorialSnapshot(
  input: unknown,
  expectedKind: 'earthquake',
): TerritorialSnapshot<EarthquakeEvent>
export function validateTerritorialSnapshot(
  input: unknown,
  expectedKind: 'thermal-hotspot',
): TerritorialSnapshot<ThermalHotspotEvent>
export function validateTerritorialSnapshot(
  input: unknown,
  expectedKind: TerritorialKind,
): TerritorialSnapshot<BaseTerritorialEvent> {
  const common = validateCommonSnapshot(input, expectedKind)
  const events =
    expectedKind === 'earthquake'
      ? common.events.map(validateEarthquakeEvent)
      : common.events.map(validateHotspotEvent)

  return {
    schemaVersion: '1.0',
    kind: expectedKind,
    generatedAt: common.generatedAt,
    sourceCheckedAt: common.sourceCheckedAt,
    window: { hours: common.windowHours },
    freshness: { staleAfterMinutes: common.staleAfterMinutes },
    source: common.source,
    method: common.method,
    limitations: common.limitations,
    events,
  }
}
