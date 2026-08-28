import type { WeatherPoint, WeatherSnapshot } from '../types/weather'

const VALUE_KEYS = [
  'temperatureC',
  'relativeHumidityPct',
  'windSpeedKmh',
  'windDirectionDeg',
  'windGustKmh',
  'precipitationMm',
] as const

type WeatherValueKey = (typeof VALUE_KEYS)[number]

type Coordinate = {
  latitude: number
  longitude: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key]
  if (!isRecord(value)) throw new Error(`${key} must be an object`)
  return value
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} must be a non-empty string`)
  }
  return value
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`)
  }
  return value
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key)
  if (Number.isNaN(Date.parse(value))) throw new Error(`${key} must be a valid timestamp`)
  return value
}

function requireCoordinate(value: unknown, key: string): Coordinate {
  if (!isRecord(value)) throw new Error(`${key} must be an object`)
  const latitude = requireFiniteNumber(value, 'latitude')
  const longitude = requireFiniteNumber(value, 'longitude')
  if (latitude < -90 || latitude > 90) throw new Error(`${key}.latitude must be between -90 and 90`)
  if (longitude < -180 || longitude > 180) {
    throw new Error(`${key}.longitude must be between -180 and 180`)
  }
  return { latitude, longitude }
}

function requireTimestampArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 24) {
    throw new Error('timestamps must contain exactly 24 values')
  }

  const timestamps = value.map((item, index) => {
    if (typeof item !== 'string' || Number.isNaN(Date.parse(item))) {
      throw new Error(`timestamps[${index}] must be a valid timestamp`)
    }
    return item
  })

  for (let index = 1; index < timestamps.length; index += 1) {
    if (Date.parse(timestamps[index]) <= Date.parse(timestamps[index - 1])) {
      throw new Error('timestamps must be unique and strictly ascending')
    }
  }

  return timestamps
}

function nullableFiniteSeries(value: unknown, key: string, length: number): Array<number | null> {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${key} must contain ${length} aligned values`)
  }

  return value.map((item) => {
    if (item === null) return null
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new Error(`${key} values must be finite numbers or null`)
    }
    return item
  })
}

function validateRange(series: Array<number | null>, key: WeatherValueKey) {
  for (const value of series) {
    if (value === null) continue

    if (key === 'relativeHumidityPct' && (value < 0 || value > 100)) {
      throw new Error('relativeHumidityPct values must be between 0 and 100')
    }
    if ((key === 'windSpeedKmh' || key === 'windGustKmh') && value < 0) {
      throw new Error(`${key} values must be non-negative`)
    }
    if (key === 'windDirectionDeg' && (value < 0 || value > 360)) {
      throw new Error('windDirectionDeg values must be between 0 and 360')
    }
    if (key === 'precipitationMm' && value < 0) {
      throw new Error('precipitationMm values must be non-negative')
    }
  }
}

function validateWeatherPoint(input: unknown, frameCount: number): WeatherPoint {
  if (!isRecord(input)) throw new Error('weather point must be an object')

  const id = requireString(input, 'id')
  const queryCoordinate = requireCoordinate(input.queryCoordinate, 'queryCoordinate')
  const providerCoordinate =
    input.providerCoordinate === null
      ? null
      : requireCoordinate(input.providerCoordinate, 'providerCoordinate')

  const values = requireRecord(input, 'values')
  const normalizedValues = {} as WeatherPoint['values']

  for (const key of VALUE_KEYS) {
    const series = nullableFiniteSeries(values[key], key, frameCount)
    validateRange(series, key)
    normalizedValues[key] = series
  }

  return {
    id,
    queryCoordinate,
    providerCoordinate,
    values: normalizedValues,
  }
}

export function validateWeatherSnapshot(input: unknown): WeatherSnapshot {
  if (!isRecord(input)) throw new Error('weather snapshot must be an object')
  if (input.schemaVersion !== '1.0') throw new Error('snapshot schemaVersion must be 1.0')

  const generatedAt = requireTimestamp(input, 'generatedAt')
  const sourceCheckedAt = requireTimestamp(input, 'sourceCheckedAt')
  const dataThrough = requireTimestamp(input, 'dataThrough')

  const window = requireRecord(input, 'window')
  if (requireFiniteNumber(window, 'hours') !== 24) throw new Error('window.hours must be 24')
  if (requireFiniteNumber(window, 'stepHours') !== 1) throw new Error('window.stepHours must be 1')

  const freshness = requireRecord(input, 'freshness')
  const staleAfterMinutes = requireFiniteNumber(freshness, 'staleAfterMinutes')
  if (staleAfterMinutes <= 0) throw new Error('staleAfterMinutes must be positive')

  const grid = requireRecord(input, 'grid')
  if (requireFiniteNumber(grid, 'spacingDegrees') !== 0.5) {
    throw new Error('grid.spacingDegrees must be 0.5')
  }
  const pointCount = requireFiniteNumber(grid, 'pointCount')
  if (!Number.isInteger(pointCount) || pointCount < 0) {
    throw new Error('grid.pointCount must be a non-negative integer')
  }

  const timestamps = requireTimestampArray(input.timestamps)
  if (dataThrough !== timestamps[timestamps.length - 1]) {
    throw new Error('dataThrough must equal the final timestamp')
  }

  const source = requireRecord(input, 'source')
  if (source.kind !== 'numerical-weather-model') {
    throw new Error('source.kind must be numerical-weather-model')
  }

  const method = requireRecord(input, 'method')
  if (method.type !== 'historical-forecast-grid') {
    throw new Error('method.type must be historical-forecast-grid')
  }
  if (requireFiniteNumber(method, 'temporalResolutionMinutes') !== 60) {
    throw new Error('method.temporalResolutionMinutes must be 60')
  }

  if (!Array.isArray(input.limitations) || input.limitations.some((item) => typeof item !== 'string')) {
    throw new Error('limitations must be an array of strings')
  }

  if (!Array.isArray(input.points)) throw new Error('points must be an array')
  if (input.points.length !== pointCount) throw new Error('grid.pointCount must equal points.length')

  const points = input.points.map((point) => validateWeatherPoint(point, timestamps.length))
  const ids = new Set<string>()
  for (const point of points) {
    if (ids.has(point.id)) throw new Error(`weather point id must be unique: ${point.id}`)
    ids.add(point.id)
  }

  return {
    schemaVersion: '1.0',
    generatedAt,
    sourceCheckedAt,
    dataThrough,
    window: { hours: 24, stepHours: 1 },
    freshness: { staleAfterMinutes },
    grid: { spacingDegrees: 0.5, pointCount },
    timestamps,
    source: {
      provider: requireString(source, 'provider'),
      dataset: requireString(source, 'dataset'),
      url: requireString(source, 'url'),
      kind: 'numerical-weather-model',
      license: requireString(source, 'license'),
    },
    method: {
      type: 'historical-forecast-grid',
      temporalResolutionMinutes: 60,
      note: requireString(method, 'note'),
    },
    limitations: [...input.limitations],
    points,
  }
}
