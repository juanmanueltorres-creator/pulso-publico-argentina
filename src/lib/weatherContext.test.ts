import { describe, expect, it } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import type { ThermalHotspotEvent } from '../types/territorial'
import type { WeatherPoint, WeatherSnapshot } from '../types/weather'
import { findWeatherContext, haversineKm } from './weatherContext'

function hotspot(overrides: Partial<ThermalHotspotEvent> = {}): ThermalHotspotEvent {
  return {
    id: 'hotspot-1',
    kind: 'thermal-hotspot',
    occurredAt: '2026-08-27T10:20:00.000Z',
    latitude: -31.6,
    longitude: -64,
    confidence: 'high',
    frpMw: 12.4,
    sensor: 'VIIRS',
    satellite: 'NOAA-20',
    ...overrides,
  }
}

function snapshot(): WeatherSnapshot {
  return structuredClone(weatherSnapshotFixture())
}

function pointAt(
  id: string,
  latitude: number,
  longitude: number,
  base?: WeatherPoint,
): WeatherPoint {
  const source = structuredClone(base ?? snapshot().points[0])
  source.id = id
  source.queryCoordinate = { latitude, longitude }
  source.providerCoordinate = { latitude: latitude + 0.01, longitude: longitude + 0.01 }
  return source
}

function withPoints(points: WeatherPoint[]): WeatherSnapshot {
  const value = snapshot()
  value.points = points
  value.grid.pointCount = points.length
  return value
}

describe('haversineKm', () => {
  it('computes a known one-degree meridional distance', () => {
    expect(
      haversineKm(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
      ),
    ).toBeCloseTo(111.195, 2)
  })
})

describe('findWeatherContext', () => {
  it('orders neighbors by query-coordinate distance and keeps the closest usable point as primary', () => {
    const value = withPoints([
      pointAt('far', -32.3, -64),
      pointAt('near', -31.55, -64),
      pointAt('middle', -31.9, -64),
    ])

    const context = findWeatherContext(hotspot(), value)

    expect(context).not.toBeNull()
    expect(context?.neighbors.map((neighbor) => neighbor.point.id)).toEqual([
      'near',
      'middle',
      'far',
    ])
    expect(context?.primary.point.id).toBe('near')
    expect(context?.neighbors[0].distanceKm).toBeLessThan(context?.neighbors[1].distanceKm ?? 0)
  })

  it('uses queryCoordinate rather than providerCoordinate for matching distance', () => {
    const farQuery = pointAt('far-query', -33, -64)
    farQuery.providerCoordinate = { latitude: -31.6001, longitude: -64 }
    const nearQuery = pointAt('near-query', -31.61, -64)
    nearQuery.providerCoordinate = { latitude: -40, longitude: -70 }
    const value = withPoints([farQuery, nearQuery])

    const context = findWeatherContext(hotspot(), value)

    expect(context?.primary.point.id).toBe('near-query')
    expect(context?.neighbors[0].point.id).toBe('near-query')
  })

  it('hard-caps the retained spatial neighbors at six', () => {
    const base = snapshot().points[0]
    const points = Array.from({ length: 8 }, (_, index) =>
      pointAt(`p-${index}`, -31.6 - index * 0.05, -64, base),
    )
    const value = withPoints(points)

    const context = findWeatherContext(hotspot(), value, 99)

    expect(context?.neighbors).toHaveLength(6)
    expect(context?.neighbors.map((neighbor) => neighbor.point.id)).toEqual([
      'p-0',
      'p-1',
      'p-2',
      'p-3',
      'p-4',
      'p-5',
    ])
  })

  it('chooses the nearest weather frame and reports the absolute minute difference', () => {
    const context = findWeatherContext(
      hotspot({ occurredAt: '2026-08-27T10:40:00.000Z' }),
      snapshot(),
    )

    expect(context?.frameIndex).toBe(11)
    expect(context?.frameTimestamp).toBe('2026-08-27T11:00:00.000Z')
    expect(context?.timeDifferenceMinutes).toBe(20)
  })

  it('chooses the earlier timestamp deterministically on an exact temporal tie', () => {
    const context = findWeatherContext(
      hotspot({ occurredAt: '2026-08-27T10:30:00.000Z' }),
      snapshot(),
    )

    expect(context?.frameIndex).toBe(10)
    expect(context?.frameTimestamp).toBe('2026-08-27T10:00:00.000Z')
    expect(context?.timeDifferenceMinutes).toBe(30)
  })

  it('skips a closer point with no core values at the selected frame when choosing primary', () => {
    const close = pointAt('close-empty', -31.61, -64)
    const usable = pointAt('usable', -31.8, -64)
    for (const key of ['temperatureC', 'relativeHumidityPct', 'windSpeedKmh'] as const) {
      close.values[key][10] = null
    }
    const value = withPoints([close, usable])

    const context = findWeatherContext(
      hotspot({ occurredAt: '2026-08-27T10:05:00.000Z' }),
      value,
    )

    expect(context?.neighbors[0].point.id).toBe('close-empty')
    expect(context?.primary.point.id).toBe('usable')
  })

  it('returns null when no retained neighbor has any usable core value at the chosen frame', () => {
    const points = [
      pointAt('empty-a', -31.61, -64),
      pointAt('empty-b', -31.8, -64),
    ]
    for (const point of points) {
      for (const key of ['temperatureC', 'relativeHumidityPct', 'windSpeedKmh'] as const) {
        point.values[key][10] = null
      }
    }
    const value = withPoints(points)

    expect(
      findWeatherContext(
        hotspot({ occurredAt: '2026-08-27T10:05:00.000Z' }),
        value,
      ),
    ).toBeNull()
  })

  it('returns null for an invalid hotspot timestamp or an empty weather snapshot', () => {
    expect(findWeatherContext(hotspot({ occurredAt: 'not-a-date' }), snapshot())).toBeNull()

    const empty = snapshot()
    empty.points = []
    empty.grid.pointCount = 0
    expect(findWeatherContext(hotspot(), empty)).toBeNull()
  })
})
