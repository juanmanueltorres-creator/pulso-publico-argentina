import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeJsonAtomic } from './lib/write-json-atomic.mjs'

export const MARINE_VARIABLES = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'ocean_current_velocity',
  'ocean_current_direction',
  'sea_surface_temperature',
]

export const MARINE_SOURCE = {
  provider: 'Open-Meteo',
  dataset: 'Marine Weather API · selección automática de modelos oceánicos',
  url: 'https://open-meteo.com/en/docs/marine-weather-api',
  kind: 'numerical-ocean-model',
}

export const MARINE_LIMITATIONS = [
  'Pronóstico oceánico modelado: no representa mediciones de boyas ni estaciones.',
  'Precisión costera limitada. No sirve para navegación ni decisiones de seguridad en el mar.',
  'Cada punto representa una consulta mar adentro; no describe las condiciones exactas de un puerto.',
  'La selección automática puede combinar modelos y resoluciones diferentes según variable y ubicación.',
]

const finiteOrNull = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null

export function marineRequestUrl(locations) {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine')
  url.searchParams.set('latitude', locations.map((point) => point.latitude).join(','))
  url.searchParams.set('longitude', locations.map((point) => point.longitude).join(','))
  url.searchParams.set('current', MARINE_VARIABLES.join(','))
  url.searchParams.set('timezone', 'GMT')
  url.searchParams.set('cell_selection', 'sea')
  return url.toString()
}

export function normalizeMarineResponse(locations, response, checkedAt) {
  if (!Array.isArray(locations) || locations.length === 0 ||
    !Array.isArray(response) || response.length !== locations.length) {
    throw new Error('Marine API point count mismatch')
  }
  if (Number.isNaN(Date.parse(checkedAt))) throw new Error('Invalid marine refresh time')

  const points = response.map((item, index) => {
    const reference = locations[index]
    if (!item || typeof item !== 'object' || item.error || !item.current ||
      typeof item.current !== 'object') {
      throw new Error(`Marine API response missing location ${reference.id}`)
    }
    const current = item.current
    const validAt = typeof current.time === 'string' &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(current.time)
      ? new Date(`${current.time}:00Z`).toISOString()
      : null
    if (!validAt || Number.isNaN(Date.parse(validAt))) {
      throw new Error(`Marine API missing valid timestamp for ${reference.id}`)
    }
    const providerLatitude = Number.isFinite(item.latitude) ? item.latitude : null
    const providerLongitude = Number.isFinite(item.longitude) ? item.longitude : null
    if (providerLatitude === null || providerLongitude === null) {
      throw new Error(`Marine API missing model coordinate for ${reference.id}`)
    }
    return {
      id: reference.id,
      name: reference.name,
      region: reference.region,
      queryCoordinate: { latitude: reference.latitude, longitude: reference.longitude },
      providerCoordinate: { latitude: providerLatitude, longitude: providerLongitude },
      validAt,
      values: {
        waveHeightM: finiteOrNull(current.wave_height, 0, 50),
        waveDirectionDeg: finiteOrNull(current.wave_direction, 0, 360),
        wavePeriodS: finiteOrNull(current.wave_period, 0, 40),
        currentVelocityKmh: finiteOrNull(current.ocean_current_velocity, 0, 60),
        currentDirectionDeg: finiteOrNull(current.ocean_current_direction, 0, 360),
        seaSurfaceTemperatureC: finiteOrNull(current.sea_surface_temperature, -4, 45),
      },
    }
  })
  if (!points.some((point) => Object.values(point.values).some((value) => value !== null))) {
    throw new Error('Marine API returned no usable marine readings; existing snapshot preserved')
  }
  return {
    schemaVersion: '1.0',
    sourceCheckedAt: checkedAt,
    source: MARINE_SOURCE,
    limitations: MARINE_LIMITATIONS,
    points,
  }
}

export async function refreshMarineSnapshot(locations, fetchImpl = fetch, checkedAt = new Date().toISOString()) {
  const response = await fetchImpl(marineRequestUrl(locations), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response?.ok) throw new Error(`Marine API HTTP ${response?.status ?? 'unknown'}`)
  const payload = await response.json()
  return normalizeMarineResponse(locations, Array.isArray(payload) ? payload : [payload], checkedAt)
}

export async function main() {
  const locations = JSON.parse(await readFile(resolve('src/data/marineLocations.json'), 'utf8'))
  const snapshot = await refreshMarineSnapshot(locations)
  await writeJsonAtomic(resolve('public/data/marine.json'), snapshot)
  console.log(`Marine refreshed: ${snapshot.points.length} offshore reference points · ${snapshot.sourceCheckedAt}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Marine refresh failed (previous snapshot kept): ${error.message}`)
    process.exitCode = 1
  })
}
