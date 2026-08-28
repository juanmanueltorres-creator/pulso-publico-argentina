import type {
  SignalAvailability,
  SignalCategory,
  SignalEnvelope,
  SignalMethodType,
  SignalSnapshot,
  SignalSourceKind,
  SignalStatus,
} from '../types/signal'

const CATEGORIES: SignalCategory[] = [
  'energy',
  'science',
  'innovation',
  'public-infrastructure',
]
const STATUSES: SignalStatus[] = ['live', 'updated', 'estimated', 'historical']
const AVAILABILITIES: SignalAvailability[] = ['available', 'stale', 'unavailable']
const SOURCE_KINDS: SignalSourceKind[] = ['official', 'open-index']
const METHOD_TYPES: SignalMethodType[] = ['api', 'csv', 'xlsx', 'scrape', 'calculation']

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

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T {
  const value = record[key]
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${key} has an unsupported value`)
  }
  return value as T
}

function validateSignal(input: unknown): SignalEnvelope {
  if (!isRecord(input)) throw new Error('signal must be an object')
  if (input.schemaVersion !== '1.0') throw new Error('signal schemaVersion must be 1.0')

  const category = requireEnum(input, 'category', CATEGORIES)
  const status = requireEnum(input, 'status', STATUSES)
  const availability = requireEnum(input, 'availability', AVAILABILITIES)

  const rawValue = input.value
  if (rawValue !== null && (typeof rawValue !== 'number' || !Number.isFinite(rawValue))) {
    throw new Error('value must be a finite number or null')
  }
  if (availability === 'unavailable' && rawValue !== null) {
    throw new Error('value must be null when availability is unavailable')
  }
  if (availability !== 'unavailable' && rawValue === null) {
    throw new Error('value must be numeric when availability is available or stale')
  }

  if (!isRecord(input.source)) throw new Error('source must be an object')
  if (!isRecord(input.method)) throw new Error('method must be an object')
  if (!Array.isArray(input.limitations) || input.limitations.some((item) => typeof item !== 'string')) {
    throw new Error('limitations must be an array of strings')
  }

  return {
    schemaVersion: '1.0',
    id: requireString(input, 'id'),
    category,
    title: requireString(input, 'title'),
    value: rawValue,
    unit: requireString(input, 'unit'),
    periodLabel: requireString(input, 'periodLabel'),
    status,
    availability,
    observedAt: requireNullableString(input, 'observedAt'),
    publishedAt: requireNullableString(input, 'publishedAt'),
    fetchedAt: requireString(input, 'fetchedAt'),
    source: {
      name: requireString(input.source, 'name'),
      url: requireString(input.source, 'url'),
      kind: requireEnum(input.source, 'kind', SOURCE_KINDS),
    },
    method: {
      type: requireEnum(input.method, 'type', METHOD_TYPES),
      note: requireString(input.method, 'note'),
    },
    limitations: [...input.limitations],
  }
}

export function validateSnapshot(input: unknown): SignalSnapshot {
  if (!isRecord(input)) throw new Error('snapshot must be an object')
  if (input.schemaVersion !== '1.0') throw new Error('snapshot schemaVersion must be 1.0')
  const generatedAt = requireString(input, 'generatedAt')
  if (!Array.isArray(input.signals)) throw new Error('signals must be an array')

  return {
    schemaVersion: '1.0',
    generatedAt,
    signals: input.signals.map(validateSignal),
  }
}
