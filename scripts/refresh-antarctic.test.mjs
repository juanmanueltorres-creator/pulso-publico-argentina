import { describe, expect, it, vi } from 'vitest'
import bases from '../src/data/antarcticBases.json'
import { antarcticRequestUrl, normalizeAntarcticResponse, refreshAntarcticSnapshot } from './refresh-antarctic.mjs'

const checkedAt = '2026-11-16T22:00:00.000Z'
const fixtures = () => bases.map((base) => ({
  latitude: base.latitude + 0.1, longitude: base.longitude + 0.1,
  current_units: {
    time: 'iso8601', temperature_2m: '°C', wind_speed_10m: 'km/h',
    wind_direction_10m: '°', cloud_cover: '%',
  },
  current: {
    time: '2026-11-16T22:00', temperature_2m: -11.4, wind_speed_10m: 36.2,
    wind_direction_10m: 185, cloud_cover: 88,
  },
}))

describe('Antarctic global forecast', () => {
  it('queries six sourced bases in one global ECMWF request, no fabricated stations', () => {
    const url = new URL(antarcticRequestUrl(bases))
    expect(url.hostname).toBe('api.open-meteo.com')
    expect(url.searchParams.get('models')).toBe('ecmwf_ifs025')
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(6)
    expect(url.searchParams.get('current')).toBe('temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover')
    expect(url.searchParams.get('timezone')).toBe('GMT')
  })

  it('retains base and model coordinate separately with true model time and units', () => {
    const snapshot = normalizeAntarcticResponse(bases, fixtures(), checkedAt)
    expect(snapshot.points).toHaveLength(6)
    expect(snapshot.source.kind).toBe('numerical-weather-model')
    expect(snapshot.points[0].providerCoordinate.latitude).toBeCloseTo(bases[0].latitude + 0.1)
    expect(snapshot.points[0].values).toEqual({
      temperatureC: -11.4, windSpeedKmh: 36.2,
      windDirectionDeg: 185, cloudCoverPct: 88,
    })
    expect(snapshot.points[0].validAt).toBe('2026-11-16T22:00:00.000Z')
  })

  it('preserves absent variables as null and rejects bad units, missing stations and all-empty responses', () => {
    const someNull = fixtures()
    someNull[0].current.cloud_cover = null
    expect(normalizeAntarcticResponse(bases, someNull, checkedAt).points[0].values.cloudCoverPct).toBeNull()
    const badUnits = fixtures()
    badUnits[0].current_units.wind_speed_10m = 'm/s'
    expect(() => normalizeAntarcticResponse(bases, badUnits, checkedAt)).toThrow(/units/i)
    expect(() => normalizeAntarcticResponse(bases, fixtures().slice(1), checkedAt)).toThrow(/incomplete/i)
    const empty = fixtures()
    for (const row of empty) for (const key of Object.keys(row.current)) if (key !== 'time') row.current[key] = null
    expect(() => normalizeAntarcticResponse(bases, empty, checkedAt)).toThrow(/no usable/i)
  })

  it('does not publish partial API failures', async () => {
    const fail = vi.fn(async () => new Response('not available', { status: 503 }))
    await expect(refreshAntarcticSnapshot(bases, fail, checkedAt)).rejects.toThrow('503')
  })

  it('retries transient connection errors and preserves model data on recovery', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixtures()), { status: 200 }))
    const sleepImpl = vi.fn(async () => undefined)
    const snapshot = await refreshAntarcticSnapshot(bases, mockFetch, checkedAt, {
      maxRetries: 2, retryDelayMs: 0, sleepImpl,
    })
    expect(snapshot.points).toHaveLength(6)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(sleepImpl).toHaveBeenCalledOnce()
  })

  it('fails closed after bounded network retries rather than overwriting a valid snapshot', async () => {
    const failure = vi.fn(async () => { throw new TypeError('DNS temporarily unreachable') })
    await expect(refreshAntarcticSnapshot(bases, failure, checkedAt, {
      maxRetries: 2, retryDelayMs: 0, sleepImpl: async () => undefined,
    })).rejects.toThrow(/after 3 attempt.*DNS temporarily unreachable/)
    expect(failure).toHaveBeenCalledTimes(3)
  })

  it('queries a single six-location batch', async () => {
    const mockFetch = vi.fn(async () => new Response(JSON.stringify(fixtures()), { status: 200 }))
    const snapshot = await refreshAntarcticSnapshot(bases, mockFetch, checkedAt)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(snapshot.points).toHaveLength(6)
  })
})
