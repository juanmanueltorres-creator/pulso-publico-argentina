import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeJsonAtomic } from './lib/write-json-atomic.mjs'

const VARIABLES = ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover']
export const MODEL = 'ecmwf_ifs025'
export const IGN_URL = 'https://www.ign.gob.ar/NuestrasActividades/Geografia/DatosArgentina/BasesAntartida'
export const SOURCE_URL = 'https://open-meteo.com/en/docs/ecmwf-api'

export function antarcticRequestUrl(bases) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', bases.map((base) => base.latitude).join(','))
  url.searchParams.set('longitude', bases.map((base) => base.longitude).join(','))
  url.searchParams.set('models', MODEL)
  url.searchParams.set('current', VARIABLES.join(','))
  url.searchParams.set('timezone', 'GMT')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set('forecast_days', '1')
  return url.toString()
}

const nullableNumber = (value, minimum, maximum) =>
  typeof value === 'number' && Number.isFinite(value) &&
  value >= minimum && value <= maximum ? value : null

export function normalizeAntarcticResponse(bases, response, checkedAt) {
  if (!Array.isArray(bases) || bases.length !== 6 || !Array.isArray(response) ||
    response.length !== bases.length || Number.isNaN(Date.parse(checkedAt))) {
    throw new Error('Antarctic forecast batch incomplete')
  }
  const points = bases.map((base, index) => {
    const item = response[index]
    if (!item || item.error || !item.current || !item.current_units ||
      item.current_units.temperature_2m !== '°C' ||
      item.current_units.wind_speed_10m !== 'km/h' ||
      item.current_units.cloud_cover !== '%') {
      throw new Error(`Antarctic forecast invalid model or units: ${base.id}`)
    }
    const validAt = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(item.current.time ?? '')
      ? new Date(`${item.current.time}:00Z`).toISOString() : null
    if (!validAt || Number.isNaN(Date.parse(validAt))) {
      throw new Error(`Antarctic forecast invalid timestamp: ${base.id}`)
    }
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) {
      throw new Error(`Antarctic model grid coordinate absent: ${base.id}`)
    }
    return {
      id: base.id, name: base.name, site: base.site,
      queryCoordinate: { latitude: base.latitude, longitude: base.longitude },
      providerCoordinate: { latitude: item.latitude, longitude: item.longitude },
      validAt,
      values: {
        temperatureC: nullableNumber(item.current.temperature_2m, -100, 40),
        windSpeedKmh: nullableNumber(item.current.wind_speed_10m, 0, 300),
        windDirectionDeg: nullableNumber(item.current.wind_direction_10m, 0, 360),
        cloudCoverPct: nullableNumber(item.current.cloud_cover, 0, 100),
      },
    }
  })
  if (!points.some((point) => Object.values(point.values).some((v) => v !== null))) {
    throw new Error('Antarctic forecast contains no usable data')
  }
  return {
    schemaVersion: '1.0',
    sourceCheckedAt: checkedAt,
    source: {
      provider: 'Open-Meteo',
      dataset: 'ECMWF IFS 0.25° · pronóstico meteorológico global',
      url: SOURCE_URL, kind: 'numerical-weather-model',
    },
    locationSource: { provider: 'IGN / Dirección Nacional del Antártico', url: IGN_URL },
    limitations: [
      'Son pronósticos de un modelo global, no mediciones de estaciones instaladas en las bases.',
      'La temperatura y el viento pueden diferir de la realidad local por relieve, elevación y resolución del modelo.',
      'El mapa utiliza Mercator y distorsiona distancias y superficies en latitudes polares.',
      'Las seis ubicaciones no constituyen una malla continua ni definen fronteras o soberanía.',
    ],
    points,
  }
}

export async function refreshAntarcticSnapshot(bases, fetchImpl = fetch, checkedAt = new Date().toISOString()) {
  const response = await fetchImpl(antarcticRequestUrl(bases), {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000),
  })
  if (!response?.ok) throw new Error(`Antarctic forecast HTTP ${response?.status ?? 'unknown'}`)
  const payload = await response.json()
  return normalizeAntarcticResponse(bases, Array.isArray(payload) ? payload : [payload], checkedAt)
}

export async function main() {
  const bases = JSON.parse(await readFile(resolve('src/data/antarcticBases.json'), 'utf8'))
  const snapshot = await refreshAntarcticSnapshot(bases)
  await writeJsonAtomic(resolve('public/data/antarctic.json'), snapshot)
  console.log(`Antarctic refreshed: ${snapshot.points.length} bases · ${snapshot.sourceCheckedAt}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Antarctic refresh failed; previous snapshot retained: ${error.message}`)
    process.exitCode = 1
  })
}
