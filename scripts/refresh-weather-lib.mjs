import { validateWeatherSnapshot } from '../src/lib/validateWeatherSnapshot.ts'
import { fetchOpenMeteoWeather } from './fetch-open-meteo-weather.mjs'
import { generateWeatherGrid } from './lib/weather-grid.mjs'

const WEATHER_VALUE_KEYS = [
  'temperatureC',
  'relativeHumidityPct',
  'windSpeedKmh',
  'windDirectionDeg',
  'windGustKmh',
  'precipitationMm',
]

function requireLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error('weather locations must be a non-empty array')
  }
  return locations
}

function requireLocationSeries(location) {
  if (!location || typeof location !== 'object') {
    throw new Error('weather location must be an object')
  }
  if (!Array.isArray(location.timestamps) || location.timestamps.length === 0) {
    throw new Error(`weather location ${location.id ?? 'unknown'} must contain timestamps`)
  }
  if (!location.values || typeof location.values !== 'object' || Array.isArray(location.values)) {
    throw new Error(`weather location ${location.id ?? 'unknown'} must contain values`)
  }

  for (const key of WEATHER_VALUE_KEYS) {
    const series = location.values[key]
    if (!Array.isArray(series) || series.length !== location.timestamps.length) {
      throw new Error(`${key} must stay aligned with location timestamps`)
    }
  }
}

export function selectCommonTimestamps(locations) {
  const validated = requireLocations(locations)
  const counts = new Map()

  for (const location of validated) {
    requireLocationSeries(location)
    const unique = new Set()

    for (const timestamp of location.timestamps) {
      if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
        throw new Error(`weather location ${location.id ?? 'unknown'} contains an invalid timestamp`)
      }
      unique.add(timestamp)
    }

    for (const timestamp of unique) {
      counts.set(timestamp, (counts.get(timestamp) ?? 0) + 1)
    }
  }

  const common = [...counts.entries()]
    .filter(([, count]) => count === validated.length)
    .map(([timestamp]) => timestamp)
    .sort((left, right) => Date.parse(left) - Date.parse(right))

  if (common.length < 24) {
    throw new Error('weather source does not contain 24 common hourly frames')
  }

  return common.slice(-24)
}

function selectPointFrames(location, timestamps) {
  requireLocationSeries(location)
  const sourceIndex = new Map(location.timestamps.map((timestamp, index) => [timestamp, index]))

  const selectedIndexes = timestamps.map((timestamp) => {
    const index = sourceIndex.get(timestamp)
    if (index === undefined) {
      throw new Error(`weather location ${location.id} is missing selected timestamp ${timestamp}`)
    }
    return index
  })

  const values = {}
  for (const key of WEATHER_VALUE_KEYS) {
    const source = location.values[key]
    values[key] = selectedIndexes.map((index) => {
      if (index >= source.length) {
        throw new Error(`${key} must stay aligned with selected weather timestamps`)
      }
      return source[index]
    })
  }

  return {
    id: location.id,
    queryCoordinate: location.queryCoordinate,
    providerCoordinate: location.providerCoordinate ?? null,
    values,
  }
}

export function buildWeatherSnapshot(locations, checkedAt = new Date().toISOString()) {
  const validated = requireLocations(locations)
  const timestamps = selectCommonTimestamps(validated)
  const points = validated.map((location) => selectPointFrames(location, timestamps))

  const candidate = {
    schemaVersion: '1.0',
    generatedAt: checkedAt,
    sourceCheckedAt: checkedAt,
    dataThrough: timestamps.at(-1),
    window: { hours: 24, stepHours: 1 },
    freshness: { staleAfterMinutes: 180 },
    grid: { spacingDegrees: 0.5, pointCount: points.length },
    timestamps,
    source: {
      provider: 'Open-Meteo',
      dataset: 'ECMWF IFS HRES 9 km',
      url: 'https://open-meteo.com/en/docs/historical-forecast-api',
      kind: 'numerical-weather-model',
      license: 'CC BY 4.0',
    },
    method: {
      type: 'historical-forecast-grid',
      temporalResolutionMinutes: 60,
      note: 'Malla Pulso de 0,5° filtrada por geometría argentina; series horarias Open-Meteo Historical Forecast usando ECMWF IFS HRES.',
    },
    limitations: [
      'Es contexto meteorológico modelado y no una medición de estación en la coordenada exacta.',
      'La coincidencia espacial y temporal con una detección térmica no demuestra causalidad ni confirma un incendio.',
      'La malla Pulso es de 0,5° y no representa la resolución espacial nativa exacta del modelo.',
    ],
    points,
  }

  return validateWeatherSnapshot(candidate)
}

function semanticWeatherPayload(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const { generatedAt: _generatedAt, sourceCheckedAt: _sourceCheckedAt, ...semantic } = snapshot
  return semantic
}

function weatherPayloadEqual(left, right) {
  const leftSemantic = semanticWeatherPayload(left)
  const rightSemantic = semanticWeatherPayload(right)
  if (!leftSemantic || !rightSemantic) return false
  return JSON.stringify(leftSemantic) === JSON.stringify(rightSemantic)
}

export async function refreshWeatherSnapshot(
  previous,
  argentinaGeometry,
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
) {
  const grid = generateWeatherGrid(argentinaGeometry, 0.5)
  if (grid.length === 0) {
    throw new Error('Argentina weather grid must contain at least one point')
  }

  const locations = await fetchOpenMeteoWeather(grid, fetchImpl, checkedAt)
  if (locations.length !== grid.length) {
    throw new Error(`weather provider result count mismatch: expected ${grid.length}, received ${locations.length}`)
  }

  for (let index = 0; index < grid.length; index += 1) {
    if (locations[index]?.id !== grid[index].id) {
      throw new Error(`weather provider point mismatch at index ${index}`)
    }
  }

  const candidate = buildWeatherSnapshot(locations, checkedAt)

  if (previous && weatherPayloadEqual(previous, candidate)) {
    return { publish: false, snapshot: previous }
  }

  return { publish: true, snapshot: candidate }
}
