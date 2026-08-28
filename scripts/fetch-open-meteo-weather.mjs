const OPEN_METEO_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast'

const HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
]

const VALUE_MAPPING = {
  temperature_2m: 'temperatureC',
  relative_humidity_2m: 'relativeHumidityPct',
  wind_speed_10m: 'windSpeedKmh',
  wind_direction_10m: 'windDirectionDeg',
  wind_gusts_10m: 'windGustKmh',
  precipitation: 'precipitationMm',
}

function requireCheckedAt(checkedAt) {
  const date = new Date(checkedAt)
  if (Number.isNaN(date.getTime())) {
    throw new Error('checkedAt must be a valid timestamp')
  }
  return date
}

function requireGridPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('weather points must be a non-empty array')
  }

  return points.map((point, index) => {
    if (!point || typeof point !== 'object') {
      throw new Error(`weather point ${index} must be an object`)
    }
    if (typeof point.id !== 'string' || point.id.trim() === '') {
      throw new Error(`weather point ${index} id must be a non-empty string`)
    }
    if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
      throw new Error(`weather point ${point.id} latitude must be valid WGS84`)
    }
    if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
      throw new Error(`weather point ${point.id} longitude must be valid WGS84`)
    }
    return point
  })
}

function utcDate(date) {
  return date.toISOString().slice(0, 10)
}

export function buildOpenMeteoUrl(points, checkedAt) {
  const validatedPoints = requireGridPoints(points)
  const checkedDate = requireCheckedAt(checkedAt)
  const startDate = new Date(checkedDate.getTime() - 30 * 60 * 60 * 1000)

  const url = new URL(OPEN_METEO_URL)
  url.searchParams.set('latitude', validatedPoints.map((point) => point.latitude).join(','))
  url.searchParams.set('longitude', validatedPoints.map((point) => point.longitude).join(','))
  url.searchParams.set('models', 'ecmwf_ifs')
  url.searchParams.set('hourly', HOURLY_VARIABLES.join(','))
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('precipitation_unit', 'mm')
  url.searchParams.set('cell_selection', 'nearest')
  url.searchParams.set('start_date', utcDate(startDate))
  url.searchParams.set('end_date', utcDate(checkedDate))

  return url
}

function normalizeTimestamp(value, index) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`hourly.time[${index}] must be a timestamp string`)
  }

  const candidate = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`
  const parsed = Date.parse(candidate)
  if (!Number.isFinite(parsed)) {
    throw new Error(`hourly.time[${index}] must be a valid timestamp`)
  }
  return new Date(parsed).toISOString()
}

function normalizeSeries(hourly, sourceKey, expectedLength) {
  const source = hourly[sourceKey]
  if (!Array.isArray(source)) {
    throw new Error(`${sourceKey} must be an hourly array`)
  }
  if (source.length !== expectedLength) {
    throw new Error(`${sourceKey} must stay aligned with hourly.time`)
  }

  return source.map((value, index) => {
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${sourceKey}[${index}] must be a finite number or null`)
    }
    return value
  })
}

function normalizeLocation(point, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Open-Meteo location payload for ${point.id} must be an object`)
  }
  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    throw new Error(`Open-Meteo provider coordinates for ${point.id} must be finite`)
  }
  if (!payload.hourly || typeof payload.hourly !== 'object' || Array.isArray(payload.hourly)) {
    throw new Error(`Open-Meteo hourly payload for ${point.id} must be an object`)
  }
  if (!Array.isArray(payload.hourly.time) || payload.hourly.time.length === 0) {
    throw new Error(`Open-Meteo hourly.time for ${point.id} must be a non-empty array`)
  }

  const timestamps = payload.hourly.time.map(normalizeTimestamp)
  const values = {}

  for (const sourceKey of HOURLY_VARIABLES) {
    values[VALUE_MAPPING[sourceKey]] = normalizeSeries(payload.hourly, sourceKey, timestamps.length)
  }

  return {
    id: point.id,
    queryCoordinate: {
      latitude: point.latitude,
      longitude: point.longitude,
    },
    providerCoordinate: {
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
    timestamps,
    values,
  }
}

export async function fetchOpenMeteoBatch(points, fetchImpl = fetch, checkedAt = new Date().toISOString()) {
  const validatedPoints = requireGridPoints(points)
  const url = buildOpenMeteoUrl(validatedPoints, checkedAt)
  const response = await fetchImpl(url)

  if (!response?.ok) {
    throw new Error(`Open-Meteo request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const payload = await response.json()
  let locations

  if (validatedPoints.length === 1) {
    locations = Array.isArray(payload) ? payload : [payload]
  } else {
    if (!Array.isArray(payload)) {
      throw new Error('Open-Meteo multi-location response must be an array')
    }
    locations = payload
  }

  if (locations.length !== validatedPoints.length) {
    throw new Error(
      `Open-Meteo response count mismatch: expected ${validatedPoints.length}, received ${locations.length}`,
    )
  }

  return validatedPoints.map((point, index) => normalizeLocation(point, locations[index]))
}

export async function fetchOpenMeteoWeather(
  points,
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
  batchSize = 100,
) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('weather batch size must be a positive integer')
  }
  if (!Array.isArray(points)) {
    throw new Error('weather points must be an array')
  }
  if (points.length === 0) return []

  requireCheckedAt(checkedAt)
  requireGridPoints(points)

  const locations = []
  for (let start = 0; start < points.length; start += batchSize) {
    const batch = points.slice(start, start + batchSize)
    const normalized = await fetchOpenMeteoBatch(batch, fetchImpl, checkedAt)
    locations.push(...normalized)
  }

  return locations
}
