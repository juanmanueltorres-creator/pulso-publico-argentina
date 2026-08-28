import { describe, expect, it, vi } from 'vitest'
import {
  buildWeatherSnapshot,
  refreshWeatherSnapshot,
  selectCommonTimestamps,
} from './refresh-weather-lib.mjs'

const checkedAt = '2026-08-28T20:37:00.000Z'

const argentinaFixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-65.25, -32.25],
          [-63.75, -32.25],
          [-63.75, -30.75],
          [-65.25, -30.75],
          [-65.25, -32.25],
        ]],
      },
    },
  ],
}

function hourlyTimestamps(count = 30, start = '2026-08-27T15:00:00.000Z') {
  const startMs = Date.parse(start)
  return Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * 60 * 60 * 1000).toISOString(),
  )
}

function location(id, latitude, longitude, options = {}) {
  const timestamps = options.timestamps ?? hourlyTimestamps()
  const length = timestamps.length
  const values = (base) => Array.from({ length }, (_, index) => base + index)

  return {
    id,
    queryCoordinate: { latitude, longitude },
    providerCoordinate: { latitude: latitude + 0.01, longitude: longitude - 0.01 },
    timestamps,
    values: {
      temperatureC: values(10),
      relativeHumidityPct: Array.from({ length }, (_, index) => Math.max(20, 70 - index)),
      windSpeedKmh: values(5),
      windDirectionDeg: Array.from({ length }, (_, index) => (180 + index) % 360),
      windGustKmh: values(8),
      precipitationMm: Array.from({ length }, (_, index) => (index % 5 === 0 ? 0.2 : 0)),
      ...options.values,
    },
  }
}

function responsePayload(latitude, longitude) {
  const times = hourlyTimestamps().map((timestamp) => timestamp.slice(0, 16))
  const length = times.length
  return {
    latitude: latitude + 0.01,
    longitude: longitude - 0.01,
    hourly: {
      time: times,
      temperature_2m: Array.from({ length }, (_, index) => 10 + index),
      relative_humidity_2m: Array.from({ length }, (_, index) => Math.max(20, 70 - index)),
      wind_speed_10m: Array.from({ length }, (_, index) => 5 + index),
      wind_direction_10m: Array.from({ length }, (_, index) => (180 + index) % 360),
      wind_gusts_10m: Array.from({ length }, (_, index) => 8 + index),
      precipitation: Array.from({ length }, (_, index) => (index % 5 === 0 ? 0.2 : 0)),
    },
  }
}

function successfulFetch(url) {
  const parsed = new URL(url)
  const latitudes = parsed.searchParams.get('latitude').split(',').map(Number)
  const longitudes = parsed.searchParams.get('longitude').split(',').map(Number)
  const payloads = latitudes.map((latitude, index) => responsePayload(latitude, longitudes[index]))
  return Promise.resolve(
    new Response(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads), { status: 200 }),
  )
}

describe('selectCommonTimestamps', () => {
  it('selects the newest 24 hourly timestamps shared by every point', () => {
    const first = location('a', -31.5, -64)
    const second = location('b', -32, -64.5, {
      timestamps: hourlyTimestamps(29, '2026-08-27T16:00:00.000Z'),
    })

    const selected = selectCommonTimestamps([first, second])

    expect(selected).toHaveLength(24)
    expect(selected).toEqual([...selected].sort())
    expect(selected.at(-1)).toBe('2026-08-28T20:00:00.000Z')
  })

  it('rejects fewer than 24 common hourly frames', () => {
    const first = location('a', -31.5, -64, { timestamps: hourlyTimestamps(23) })
    const second = location('b', -32, -64.5, { timestamps: hourlyTimestamps(23) })

    expect(() => selectCommonTimestamps([first, second])).toThrow(/24 common hourly frames/i)
  })
})

describe('buildWeatherSnapshot', () => {
  it('builds the exact validated WeatherSnapshot 1.0 candidate from aligned locations', () => {
    const first = location('a', -31.5, -64)
    first.values.temperatureC[29] = null
    const second = location('b', -32, -64.5)

    const snapshot = buildWeatherSnapshot([first, second], checkedAt)

    expect(snapshot).toMatchObject({
      schemaVersion: '1.0',
      generatedAt: checkedAt,
      sourceCheckedAt: checkedAt,
      dataThrough: '2026-08-28T20:00:00.000Z',
      window: { hours: 24, stepHours: 1 },
      freshness: { staleAfterMinutes: 180 },
      grid: { spacingDegrees: 0.5, pointCount: 2 },
      source: {
        provider: 'Open-Meteo',
        dataset: 'ECMWF IFS HRES 9 km',
        kind: 'numerical-weather-model',
        license: 'CC BY 4.0',
      },
      method: {
        type: 'historical-forecast-grid',
        temporalResolutionMinutes: 60,
      },
    })
    expect(snapshot.timestamps).toHaveLength(24)
    expect(snapshot.points[0].values.temperatureC).toHaveLength(24)
    expect(snapshot.points[0].values.temperatureC.at(-1)).toBeNull()
    expect(snapshot.limitations.join(' ')).toMatch(/no demuestra causalidad/i)
  })

  it('reindexes every weather variable by the selected common timestamps, not by raw array position', () => {
    const first = location('a', -31.5, -64)
    const shiftedTimestamps = hourlyTimestamps(29, '2026-08-27T16:00:00.000Z')
    const second = location('b', -32, -64.5, { timestamps: shiftedTimestamps })

    const snapshot = buildWeatherSnapshot([first, second], checkedAt)

    expect(snapshot.timestamps[0]).toBe('2026-08-27T21:00:00.000Z')
    expect(snapshot.points[0].values.temperatureC[0]).toBe(16)
    expect(snapshot.points[1].values.temperatureC[0]).toBe(15)
  })

  it('rejects mismatched raw variable lengths instead of publishing shifted data', () => {
    const broken = location('a', -31.5, -64)
    broken.values.windSpeedKmh.pop()

    expect(() => buildWeatherSnapshot([broken], checkedAt)).toThrow(/aligned/i)
  })

  it('rejects invalid values through the shared runtime validator', () => {
    const broken = location('a', -31.5, -64)
    broken.values.relativeHumidityPct[29] = 101

    expect(() => buildWeatherSnapshot([broken], checkedAt)).toThrow(/relativeHumidityPct/i)
  })
})

describe('refreshWeatherSnapshot', () => {
  it('generates the geometry-derived grid, fetches every expected point and returns a publishable snapshot', async () => {
    const result = await refreshWeatherSnapshot(null, argentinaFixture, successfulFetch, checkedAt)

    expect(result.publish).toBe(true)
    expect(result.snapshot.timestamps).toHaveLength(24)
    expect(result.snapshot.grid.pointCount).toBe(9)
    expect(result.snapshot.points).toHaveLength(9)
    expect(new Set(result.snapshot.points.map((point) => point.id)).size).toBe(9)
  })

  it('does not publish a new snapshot when the semantic weather payload is unchanged', async () => {
    const first = await refreshWeatherSnapshot(null, argentinaFixture, successfulFetch, checkedAt)
    const later = '2026-08-28T21:00:00.000Z'
    const unchanged = await refreshWeatherSnapshot(first.snapshot, argentinaFixture, successfulFetch, later)

    expect(unchanged.publish).toBe(false)
    expect(unchanged.snapshot).toBe(first.snapshot)
  })

  it('propagates adapter failure instead of producing an empty or partial snapshot', async () => {
    const down = vi.fn(async () => new Response('down', { status: 503 }))

    await expect(refreshWeatherSnapshot(null, argentinaFixture, down, checkedAt)).rejects.toThrow(/503/)
  })

  it('rejects a provider response that omits an expected grid location', async () => {
    const missingLocationFetch = async (url) => {
      const parsed = new URL(url)
      const latitudes = parsed.searchParams.get('latitude').split(',').map(Number)
      const longitudes = parsed.searchParams.get('longitude').split(',').map(Number)
      const payloads = latitudes.slice(0, -1).map((latitude, index) =>
        responsePayload(latitude, longitudes[index]),
      )
      return new Response(JSON.stringify(payloads), { status: 200 })
    }

    await expect(
      refreshWeatherSnapshot(null, argentinaFixture, missingLocationFetch, checkedAt),
    ).rejects.toThrow(/count/i)
  })
})
