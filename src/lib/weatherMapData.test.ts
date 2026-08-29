import { describe, expect, it } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import type { ThermalHotspotEvent } from '../types/territorial'
import type { WeatherSnapshot } from '../types/weather'
import type { HotspotWeatherContext } from './weatherContext'
import {
  selectedHotspotToFeatureCollection,
  weatherFrameToFeatureCollection,
  weatherLinkToFeatureCollection,
  weatherNeighborsToFeatureCollection,
  weatherWindVectorsToFeatureCollection,
} from './weatherMapData'

function snapshot(): WeatherSnapshot {
  return structuredClone(weatherSnapshotFixture())
}

function hotspot(): ThermalHotspotEvent {
  return {
    id: 'hotspot-1',
    kind: 'thermal-hotspot',
    occurredAt: '2026-08-27T10:20:00.000Z',
    latitude: -31.6,
    longitude: -64.1,
    confidence: 'high',
    frpMw: 12.4,
    sensor: 'VIIRS',
    satellite: 'NOAA-20',
  }
}

function context(value = snapshot()): HotspotWeatherContext {
  return {
    hotspotId: 'hotspot-1',
    frameIndex: 10,
    frameTimestamp: value.timestamps[10],
    timeDifferenceMinutes: 20,
    primary: { point: value.points[0], distanceKm: 12.5 },
    neighbors: [
      { point: value.points[0], distanceKm: 12.5 },
      { point: value.points[1], distanceKm: 41.2 },
    ],
  }
}

describe('weatherFrameToFeatureCollection', () => {
  it('projects an active temperature frame into point features', () => {
    const value = snapshot()
    const collection = weatherFrameToFeatureCollection(value, 23, 'temperature') as any

    expect(collection.type).toBe('FeatureCollection')
    expect(collection.features).toHaveLength(2)
    expect(collection.features[0]).toMatchObject({
      type: 'Feature',
      id: 'wx:-31.50:-64.00',
      geometry: {
        type: 'Point',
        coordinates: [-64, -31.5],
      },
      properties: {
        id: 'wx:-31.50:-64.00',
        frameIndex: 23,
        weatherValue: expect.any(Number),
        temperatureC: expect.any(Number),
      },
    })
  })

  it('omits a point when the selected display variable is null instead of emitting zero', () => {
    const value = snapshot()
    value.points[0].values.temperatureC[8] = null

    const collection = weatherFrameToFeatureCollection(value, 8, 'temperature') as any

    expect(collection.features.map((feature: any) => feature.properties.id)).toEqual([
      'wx:-32.00:-64.00',
    ])
    expect(collection.features.some((feature: any) => feature.properties.weatherValue === 0)).toBe(false)
  })

  it('maps humidity and wind to their own selected values', () => {
    const value = snapshot()
    const humidity = weatherFrameToFeatureCollection(value, 4, 'humidity') as any
    const wind = weatherFrameToFeatureCollection(value, 4, 'wind') as any

    expect(humidity.features[0].properties.weatherValue).toBe(value.points[0].values.relativeHumidityPct[4])
    expect(wind.features[0].properties.weatherValue).toBe(value.points[0].values.windSpeedKmh[4])
    expect(wind.features[0].properties.windDirectionDeg).toBe(value.points[0].values.windDirectionDeg[4])
  })
})

describe('weatherWindVectorsToFeatureCollection', () => {
  it('draws a meteorological north wind as a headed arrow flowing toward geographic south', () => {
    const value = snapshot()
    value.points[0].values.windSpeedKmh[3] = 15
    value.points[0].values.windDirectionDeg[3] = 0

    const collection = weatherWindVectorsToFeatureCollection(value, 3) as any
    const vector = collection.features.find((feature: any) => feature.properties.id === 'wx:-31.50:-64.00')
    const [shaft, headLeft, headRight] = vector.geometry.coordinates
    const [origin, endpoint] = shaft

    expect(vector.geometry.type).toBe('MultiLineString')
    expect(origin).toEqual([-64, -31.5])
    expect(endpoint[1]).toBeLessThan(origin[1])
    expect(Math.abs(endpoint[0] - origin[0])).toBeLessThan(0.001)
    expect(headLeft[0]).toEqual(endpoint)
    expect(headRight[0]).toEqual(endpoint)
    expect(vector.properties).toMatchObject({
      windSpeedKmh: 15,
      windDirectionDeg: 0,
      flowDirectionDeg: 180,
      directionSemantics: 'arrow-to-flow',
    })
  })

  it('draws a meteorological south wind toward geographic north', () => {
    const value = snapshot()
    value.points[0].values.windSpeedKmh[3] = 15
    value.points[0].values.windDirectionDeg[3] = 180

    const collection = weatherWindVectorsToFeatureCollection(value, 3) as any
    const vector = collection.features.find((feature: any) => feature.properties.id === 'wx:-31.50:-64.00')
    const [[origin, endpoint]] = vector.geometry.coordinates

    expect(endpoint[1]).toBeGreaterThan(origin[1])
    expect(vector.properties.flowDirectionDeg).toBe(0)
  })

  it('keeps visual shaft length constant even when wind speeds differ', () => {
    const value = snapshot()
    value.points[0].queryCoordinate = { latitude: -31.5, longitude: -64 }
    value.points[1].queryCoordinate = { latitude: -31.5, longitude: -63.5 }
    value.points[0].values.windDirectionDeg[6] = 90
    value.points[1].values.windDirectionDeg[6] = 90
    value.points[0].values.windSpeedKmh[6] = 5
    value.points[1].values.windSpeedKmh[6] = 55

    const collection = weatherWindVectorsToFeatureCollection(value, 6) as any
    const lengths = collection.features.map((feature: any) => {
      const [shaft] = feature.geometry.coordinates
      const [a, b] = shaft
      return Math.hypot(b[0] - a[0], b[1] - a[1])
    })

    expect(lengths[0]).toBeCloseTo(lengths[1], 3)
  })

  it('omits vectors unless both speed and direction are available', () => {
    const value = snapshot()
    value.points[0].values.windSpeedKmh[7] = null
    value.points[1].values.windDirectionDeg[7] = null

    const collection = weatherWindVectorsToFeatureCollection(value, 7) as any

    expect(collection.features).toHaveLength(0)
  })
})

describe('weather context map helpers', () => {
  it('serializes ordered context neighbors with rank, distance and primary state', () => {
    const value = snapshot()
    const collection = weatherNeighborsToFeatureCollection(context(value), 10) as any

    expect(collection.features).toHaveLength(2)
    expect(collection.features[0].properties).toMatchObject({
      id: value.points[0].id,
      rank: 1,
      distanceKm: 12.5,
      isPrimary: true,
      frameIndex: 10,
    })
    expect(collection.features[1].properties).toMatchObject({
      rank: 2,
      isPrimary: false,
    })
  })

  it('creates exactly one link from the hotspot to the primary weather query coordinate', () => {
    const value = snapshot()
    const collection = weatherLinkToFeatureCollection(hotspot(), context(value)) as any

    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [-64.1, -31.6],
          [-64, -31.5],
        ],
      },
      properties: {
        hotspotId: 'hotspot-1',
        weatherPointId: value.points[0].id,
        distanceKm: 12.5,
      },
    })
  })

  it('returns zero or one selected-hotspot point feature', () => {
    const empty = selectedHotspotToFeatureCollection(null) as any
    const selected = selectedHotspotToFeatureCollection(hotspot()) as any

    expect(empty.features).toEqual([])
    expect(selected.features).toHaveLength(1)
    expect(selected.features[0]).toMatchObject({
      id: 'hotspot-1',
      geometry: { type: 'Point', coordinates: [-64.1, -31.6] },
      properties: { id: 'hotspot-1', kind: 'thermal-hotspot' },
    })
  })
})