import { describe, expect, it, vi } from 'vitest'
import locations from '../src/data/marineLocations.json'
import { marineRequestUrl, normalizeMarineResponse, refreshMarineSnapshot } from './refresh-marine.mjs'

const checkedAt = '2026-11-17T00:00:00.000Z'

const responses = () => locations.map((location) => ({
  latitude: location.latitude + 0.01,
  longitude: location.longitude + 0.02,
  current: {
    time: '2026-11-17T00:00',
    wave_height: 1.8,
    wave_direction: 90,
    wave_period: 8,
    ocean_current_velocity: 1.4,
    ocean_current_direction: 35,
    sea_surface_temperature: 13.4,
  },
}))

describe('Marine API snapshot', () => {
  it('requests six fixed offshore points with sea-cell selection and three marine dimensions', () => {
    const url = new URL(marineRequestUrl(locations))
    expect(url.hostname).toBe('marine-api.open-meteo.com')
    expect(url.searchParams.get('cell_selection')).toBe('sea')
    expect(url.searchParams.get('timezone')).toBe('GMT')
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(6)
    expect(url.searchParams.get('longitude')?.split(',')).toHaveLength(6)
    expect(url.searchParams.get('current')).toContain('wave_height')
    expect(url.searchParams.get('current')).toContain('ocean_current_velocity')
    expect(url.searchParams.get('current')).toContain('sea_surface_temperature')
  })

  it('preserves model time, coordinate and original variable semantics', () => {
    const snapshot = normalizeMarineResponse(locations, responses(), checkedAt)
    expect(snapshot.points).toHaveLength(6)
    expect(snapshot.source.kind).toBe('numerical-ocean-model')
    expect(snapshot.points[0].validAt).toBe('2026-11-17T00:00:00.000Z')
    expect(snapshot.points[0].providerCoordinate).toEqual({
      latitude: locations[0].latitude + 0.01,
      longitude: locations[0].longitude + 0.02,
    })
    expect(snapshot.points[0].values).toMatchObject({
      waveHeightM: 1.8, waveDirectionDeg: 90, wavePeriodS: 8,
      currentVelocityKmh: 1.4, currentDirectionDeg: 35,
      seaSurfaceTemperatureC: 13.4,
    })
  })

  it('never converts absent variables to measured zero', () => {
    const source = responses()
    source[0].current.sea_surface_temperature = null
    source[0].current.wave_height = null
    const snapshot = normalizeMarineResponse(locations, source, checkedAt)
    expect(snapshot.points[0].values.seaSurfaceTemperatureC).toBeNull()
    expect(snapshot.points[0].values.waveHeightM).toBeNull()
  })

  it('does not accept truncated API results, fabricated date or all-null data', () => {
    expect(() => normalizeMarineResponse(locations, responses().slice(1), checkedAt))
      .toThrow(/count/i)
    const noTime = responses()
    noTime[0].current.time = null
    expect(() => normalizeMarineResponse(locations, noTime, checkedAt)).toThrow(/timestamp/i)
    const empty = responses()
    for (const point of empty) {
      for (const key of Object.keys(point.current)) {
        if (key !== 'time') point.current[key] = null
      }
    }
    expect(() => normalizeMarineResponse(locations, empty, checkedAt)).toThrow(/no usable/i)
  })

  it('rejects an HTTP error rather than publishing a partial model', async () => {
    const down = vi.fn(async () => new Response('down', { status: 503 }))
    await expect(refreshMarineSnapshot(locations, down, checkedAt)).rejects.toThrow('503')
  })

  it('fetches all coordinates in one request', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(responses()), { status: 200 }))
    const snapshot = await refreshMarineSnapshot(locations, fetchImpl, checkedAt)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(snapshot.points).toHaveLength(6)
  })
})
