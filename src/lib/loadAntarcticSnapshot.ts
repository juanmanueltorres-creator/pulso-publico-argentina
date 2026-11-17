import bases from '../data/antarcticBases.json'
import type { AntarcticPoint, AntarcticSnapshot, AntarcticVariable } from '../types/antarctic'

const range: Record<keyof AntarcticPoint['values'], [number, number]> = {
  temperatureC: [-100, 40],
  windSpeedKmh: [0, 300],
  windDirectionDeg: [0, 360],
  cloudCoverPct: [0, 100],
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isTime = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))

export function validateAntarcticSnapshot(value: unknown): AntarcticSnapshot {
  if (!isObject(value) || value.schemaVersion !== '1.0' || !Array.isArray(value.points) ||
    value.points.length !== bases.length) throw new Error('Invalid Antarctic snapshot')
  if (value.sourceCheckedAt !== null && !isTime(value.sourceCheckedAt)) {
    throw new Error('Invalid Antarctic sourceCheckedAt')
  }
  if (!isObject(value.source) || value.source.provider !== 'Open-Meteo' ||
    value.source.kind !== 'numerical-weather-model' ||
    value.source.url !== 'https://open-meteo.com/en/docs/ecmwf-api' ||
    typeof value.source.dataset !== 'string') {
    throw new Error('Invalid Antarctic model attribution')
  }
  if (!isObject(value.locationSource) ||
    value.locationSource.url !== 'https://www.ign.gob.ar/NuestrasActividades/Geografia/DatosArgentina/BasesAntartida') {
    throw new Error('Invalid Antarctic coordinates source')
  }
  if (!Array.isArray(value.limitations) ||
    !value.limitations.every((item) => typeof item === 'string')) {
    throw new Error('Invalid Antarctic limitations')
  }
  const ids = new Set<string>()
  for (const point of value.points) {
    if (!isObject(point) || typeof point.id !== 'string' || ids.has(point.id)) {
      throw new Error('Invalid or duplicate Antarctic base')
    }
    ids.add(point.id)
    const reference = bases.find((base) => base.id === point.id)
    if (!reference || point.name !== reference.name || point.site !== reference.site ||
      !isObject(point.queryCoordinate) ||
      point.queryCoordinate.latitude !== reference.latitude ||
      point.queryCoordinate.longitude !== reference.longitude) {
      throw new Error('Unexpected Antarctic base coordinates')
    }
    if (point.providerCoordinate !== null &&
      (!isObject(point.providerCoordinate) ||
        !Number.isFinite(point.providerCoordinate.latitude) ||
        !Number.isFinite(point.providerCoordinate.longitude))) {
      throw new Error('Invalid Antarctic provider coordinate')
    }
    if (point.validAt !== null && !isTime(point.validAt)) throw new Error('Invalid Antarctic model frame')
    if (!isObject(point.values)) throw new Error('Invalid Antarctic values')
    for (const [key, [min, max]] of Object.entries(range)) {
      const number = point.values[key]
      if (number !== null &&
        (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max)) {
        throw new Error(`Invalid Antarctic reading ${key}`)
      }
      if (number !== null && point.validAt === null) {
        throw new Error('Antarctic reading without model time')
      }
    }
  }
  return value as unknown as AntarcticSnapshot
}

export async function loadAntarcticSnapshot(fetchImpl: typeof fetch = fetch): Promise<AntarcticSnapshot> {
  const response = await fetchImpl(`${import.meta.env.BASE_URL}data/antarctic.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Antarctic snapshot HTTP ${response.status}`)
  return validateAntarcticSnapshot(await response.json())
}

export function antarcticNumericValue(point: AntarcticPoint, variable: AntarcticVariable): number | null {
  return variable === 'temperature' ? point.values.temperatureC
    : variable === 'wind' ? point.values.windSpeedKmh
      : point.values.cloudCoverPct
}
