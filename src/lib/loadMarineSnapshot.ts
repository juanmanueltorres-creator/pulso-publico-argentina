import type { MarinePoint, MarineSnapshot } from '../types/marine'
import locations from '../data/marineLocations.json'

const REQUIRED_VALUES = {
  waveHeightM: [0, 50],
  waveDirectionDeg: [0, 360],
  wavePeriodS: [0, 40],
  currentVelocityKmh: [0, 60],
  currentDirectionDeg: [0, 360],
  seaSurfaceTemperatureC: [-4, 45],
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const validInstant = (value: unknown): boolean =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

export function validateMarineSnapshot(payload: unknown): MarineSnapshot {
  if (!isRecord(payload) || payload.schemaVersion !== '1.0' || !Array.isArray(payload.points)) {
    throw new Error('Invalid marine snapshot')
  }
  if (payload.sourceCheckedAt !== null && !validInstant(payload.sourceCheckedAt)) {
    throw new Error('Invalid marine update time')
  }
  if (!isRecord(payload.source) || payload.source.provider !== 'Open-Meteo' ||
    payload.source.kind !== 'numerical-ocean-model' ||
    typeof payload.source.dataset !== 'string' ||
    payload.source.url !== 'https://open-meteo.com/en/docs/marine-weather-api') {
    throw new Error('Invalid marine source')
  }
  if (!Array.isArray(payload.limitations) || !payload.limitations.every((item) => typeof item === 'string')) {
    throw new Error('Invalid marine limitations')
  }

  const points = payload.points as unknown[]
  if (points.length !== locations.length) throw new Error('Incomplete marine sample')
  const ids = new Set<string>()
  for (const value of points) {
    if (!isRecord(value) || typeof value.id !== 'string' || ids.has(value.id)) {
      throw new Error('Invalid or duplicate marine point')
    }
    const reference = locations.find((location) => location.id === value.id)
    if (!reference || value.name !== reference.name || value.region !== reference.region) {
      throw new Error('Unexpected marine reference point')
    }
    ids.add(value.id)
    if (!isRecord(value.queryCoordinate) ||
      value.queryCoordinate.latitude !== reference.latitude ||
      value.queryCoordinate.longitude !== reference.longitude) {
      throw new Error('Incorrect marine coordinates')
    }
    if (value.providerCoordinate !== null &&
      (!isRecord(value.providerCoordinate) ||
        typeof value.providerCoordinate.latitude !== 'number' ||
        !Number.isFinite(value.providerCoordinate.latitude) ||
        typeof value.providerCoordinate.longitude !== 'number' ||
        !Number.isFinite(value.providerCoordinate.longitude))) {
      throw new Error('Invalid marine model coordinate')
    }
    if (value.validAt !== null && !validInstant(value.validAt)) {
      throw new Error('Invalid marine frame time')
    }
    if (!isRecord(value.values)) throw new Error('Invalid marine model variables')
    for (const [key, [minimum, maximum]] of Object.entries(REQUIRED_VALUES)) {
      const reading = value.values[key]
      if (reading !== null && (typeof reading !== 'number' || !Number.isFinite(reading) ||
        reading < minimum || reading > maximum)) {
        throw new Error(`Invalid marine value: ${key}`)
      }
      if (reading !== null && value.validAt === null) {
        throw new Error('Marine value without a valid model timestamp')
      }
    }
  }
  return payload as unknown as MarineSnapshot
}

export async function loadMarineSnapshot(fetchImpl: typeof fetch = fetch): Promise<MarineSnapshot> {
  const response = await fetchImpl(`${import.meta.env.BASE_URL}data/marine.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Marine snapshot HTTP ${response.status}`)
  return validateMarineSnapshot(await response.json())
}

export function marineNumericValue(point: MarinePoint, variable: 'waves' | 'currents' | 'temperature'): number | null {
  return variable === 'waves' ? point.values.waveHeightM
    : variable === 'currents' ? point.values.currentVelocityKmh
      : point.values.seaSurfaceTemperatureC
}
