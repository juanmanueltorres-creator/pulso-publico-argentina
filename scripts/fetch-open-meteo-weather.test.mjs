import { describe, expect, it, vi } from 'vitest'
import {
  buildOpenMeteoUrl,
  fetchOpenMeteoBatch,
  fetchOpenMeteoWeather,
} from './fetch-open-meteo-weather.mjs'

const checkedAt = '2026-08-28T20:37:00.000Z'

const points = [
  { id: 'wx:-31.50:-64.00', latitude: -31.5, longitude: -64 },
  { id: 'wx:-32.00:-64.50', latitude: -32, longitude: -64.5 },
  { id: 'wx:-32.50:-65.00', latitude: -32.5, longitude: -65 },
]

function payloadFor(latitude, longitude, offset = 0) {
  return {
    latitude,
    longitude,
    hourly: {
      time: ['2026-08-27T18:00', '2026-08-27T19:00', '2026-08-27T20:00'],
      temperature_2m: [20 + offset, null, 22 + offset],
      relative_humidity_2m: [40 + offset, 42 + offset, 44 + offset],
      wind_speed_10m: [10 + offset, 12 + offset, 14 + offset],
      wind_direction_10m: [180, 190, 200],
      wind_gusts_10m: [20 + offset, 22 + offset, 24 + offset],
      precipitation: [0, 0.2, 0],
    },
  }
}

function responseForRequest(url) {
  const parsed = new URL(url)
  const latitudes = parsed.searchParams.get('latitude').split(',').map(Number)
  const longitudes = parsed.searchParams.get('longitude').split(',').map(Number)
  const payloads = latitudes.map((latitude, index) =>
    payloadFor(latitude + 0.01, longitudes[index] - 0.01, index),
  )
  return new Response(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads), { status: 200 })
}

describe('Open-Meteo ECMWF adapter', () => {
  it('builds the approved Historical Forecast request with explicit UTC date coverage', () => {
    const url = buildOpenMeteoUrl(points.slice(0, 2), checkedAt)

    expect(url.hostname).toBe('historical-forecast-api.open-meteo.com')
    expect(url.pathname).toBe('/v1/forecast')
    expect(url.searchParams.get('models')).toBe('ecmwf_ifs')
    expect(url.searchParams.get('hourly')).toBe(
      'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation',
    )
    expect(url.searchParams.get('timezone')).toBe('UTC')
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh')
    expect(url.searchParams.get('temperature_unit')).toBe('celsius')
    expect(url.searchParams.get('precipitation_unit')).toBe('mm')
    expect(url.searchParams.get('cell_selection')).toBe('nearest')
    expect(url.searchParams.get('latitude')).toBe('-31.5,-32')
    expect(url.searchParams.get('longitude')).toBe('-64,-64.5')
    expect(url.searchParams.get('start_date')).toBe('2026-08-27')
    expect(url.searchParams.get('end_date')).toBe('2026-08-28')
  })

  it('normalizes a multi-location response while preserving request ids, order, provider coordinates and nulls', async () => {
    const fetcher = vi.fn(async (url) => responseForRequest(url))

    const result = await fetchOpenMeteoBatch(points.slice(0, 2), fetcher, checkedAt)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: points[0].id,
      queryCoordinate: { latitude: -31.5, longitude: -64 },
      providerCoordinate: { latitude: -31.49, longitude: -64.01 },
      timestamps: [
        '2026-08-27T18:00:00.000Z',
        '2026-08-27T19:00:00.000Z',
        '2026-08-27T20:00:00.000Z',
      ],
    })
    expect(result[0].values.temperatureC).toEqual([20, null, 22])
    expect(result[0].values.relativeHumidityPct).toEqual([40, 42, 44])
    expect(result[0].values.windSpeedKmh).toEqual([10, 12, 14])
    expect(result[0].values.windDirectionDeg).toEqual([180, 190, 200])
    expect(result[0].values.windGustKmh).toEqual([20, 22, 24])
    expect(result[0].values.precipitationMm).toEqual([0, 0.2, 0])
    expect(result[1].id).toBe(points[1].id)
  })

  it('accepts the provider object shape for a one-point batch', async () => {
    const fetcher = vi.fn(async (url) => responseForRequest(url))

    const [result] = await fetchOpenMeteoBatch(points.slice(0, 1), fetcher, checkedAt)

    expect(result.id).toBe(points[0].id)
    expect(result.timestamps).toHaveLength(3)
  })

  it('batches requests deterministically and preserves global point order', async () => {
    const fetcher = vi.fn(async (url) => responseForRequest(url))
    const sleepImpl = vi.fn(async () => undefined)

    const result = await fetchOpenMeteoWeather(points, fetcher, checkedAt, 2, {
      batchDelayMs: 12_000,
      sleepImpl,
      maxRetries: 0,
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.map((location) => location.id)).toEqual(points.map((point) => point.id))
    expect(sleepImpl).toHaveBeenCalledTimes(1)
    expect(sleepImpl).toHaveBeenCalledWith(12_000)
  })

  it('backs off and retries HTTP 429 while respecting Retry-After', async () => {
    let call = 0
    const fetcher = vi.fn(async (url) => {
      call += 1
      if (call === 1) {
        return new Response('slow down', {
          status: 429,
          headers: { 'Retry-After': '1' },
        })
      }
      return responseForRequest(url)
    })
    const sleepImpl = vi.fn(async () => undefined)

    const result = await fetchOpenMeteoWeather(points.slice(0, 1), fetcher, checkedAt, 1, {
      batchDelayMs: 0,
      sleepImpl,
      maxRetries: 2,
      retryDelayMs: 60_000,
    })

    expect(result).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleepImpl).toHaveBeenCalledWith(1_000)
  })

  it('retries a transient network fetch failure and then succeeds', async () => {
    let call = 0
    const fetcher = vi.fn(async (url) => {
      call += 1
      if (call === 1) throw new TypeError('fetch failed')
      return responseForRequest(url)
    })
    const sleepImpl = vi.fn(async () => undefined)

    const result = await fetchOpenMeteoWeather(points.slice(0, 1), fetcher, checkedAt, 1, {
      batchDelayMs: 0,
      sleepImpl,
      maxRetries: 2,
      retryDelayMs: 1_234,
    })

    expect(result).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleepImpl).toHaveBeenCalledTimes(1)
    expect(sleepImpl).toHaveBeenCalledWith(1_234)
  })

  it.each(['AbortError', 'TimeoutError'])(
    'retries transient %s transport failures',
    async (name) => {
      let call = 0
      const fetcher = vi.fn(async (url) => {
        call += 1
        if (call === 1) {
          const error = new Error(`${name} while fetching`)
          error.name = name
          throw error
        }
        return responseForRequest(url)
      })
      const sleepImpl = vi.fn(async () => undefined)

      await expect(
        fetchOpenMeteoWeather(points.slice(0, 1), fetcher, checkedAt, 1, {
          batchDelayMs: 0,
          sleepImpl,
          maxRetries: 1,
          retryDelayMs: 321,
        }),
      ).resolves.toHaveLength(1)

      expect(fetcher).toHaveBeenCalledTimes(2)
      expect(sleepImpl).toHaveBeenCalledWith(321)
    },
  )

  it('does not retry semantic response validation failures', async () => {
    const invalid = payloadFor(-31.49, -64.01)
    delete invalid.hourly.wind_gusts_10m
    const fetcher = vi.fn(async () => new Response(JSON.stringify(invalid), { status: 200 }))
    const sleepImpl = vi.fn(async () => undefined)

    await expect(
      fetchOpenMeteoWeather(points.slice(0, 1), fetcher, checkedAt, 1, {
        batchDelayMs: 0,
        sleepImpl,
        maxRetries: 2,
        retryDelayMs: 100,
      }),
    ).rejects.toThrow(/wind_gusts_10m/i)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('fails closed after exhausting retries for a persistent 429', async () => {
    const fetcher = vi.fn(async () => new Response('slow down', { status: 429 }))
    const sleepImpl = vi.fn(async () => undefined)

    await expect(
      fetchOpenMeteoWeather(points.slice(0, 1), fetcher, checkedAt, 1, {
        batchDelayMs: 0,
        sleepImpl,
        maxRetries: 1,
        retryDelayMs: 1_234,
      }),
    ).rejects.toThrow(/HTTP 429/i)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleepImpl).toHaveBeenCalledTimes(1)
    expect(sleepImpl).toHaveBeenCalledWith(1_234)
  })

  it('rejects non-success HTTP responses', async () => {
    const fetcher = vi.fn(async () => new Response('provider down', { status: 503 }))

    await expect(fetchOpenMeteoBatch(points.slice(0, 1), fetcher, checkedAt)).rejects.toThrow(/HTTP 503/i)
  })

  it('rejects a non-array response for a multi-location batch', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(payloadFor(-31.49, -64.01)), { status: 200 }),
    )

    await expect(fetchOpenMeteoBatch(points.slice(0, 2), fetcher, checkedAt)).rejects.toThrow(/array/i)
  })

  it('rejects response count mismatches instead of pairing the wrong location', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify([payloadFor(-31.49, -64.01)]), { status: 200 }),
    )

    await expect(fetchOpenMeteoBatch(points.slice(0, 2), fetcher, checkedAt)).rejects.toThrow(/count/i)
  })

  it('rejects missing hourly variables and misaligned arrays', async () => {
    const missing = payloadFor(-31.49, -64.01)
    delete missing.hourly.wind_gusts_10m
    const missingFetcher = vi.fn(async () => new Response(JSON.stringify(missing), { status: 200 }))
    await expect(fetchOpenMeteoBatch(points.slice(0, 1), missingFetcher, checkedAt)).rejects.toThrow(/wind_gusts_10m/i)

    const short = payloadFor(-31.49, -64.01)
    short.hourly.precipitation = [0]
    const shortFetcher = vi.fn(async () => new Response(JSON.stringify(short), { status: 200 }))
    await expect(fetchOpenMeteoBatch(points.slice(0, 1), shortFetcher, checkedAt)).rejects.toThrow(/aligned/i)
  })

  it('rejects the entire multi-batch operation when any batch fails', async () => {
    let call = 0
    const fetcher = vi.fn(async (url) => {
      call += 1
      if (call === 2) return new Response('down', { status: 502 })
      return responseForRequest(url)
    })

    await expect(
      fetchOpenMeteoWeather(points, fetcher, checkedAt, 2, {
        batchDelayMs: 0,
        sleepImpl: async () => undefined,
        maxRetries: 0,
      }),
    ).rejects.toThrow(/HTTP 502/i)
  })

  it('rejects invalid checkedAt and batch size inputs before requesting the provider', async () => {
    expect(() => buildOpenMeteoUrl(points.slice(0, 1), 'not-a-date')).toThrow(/checkedAt/i)
    const fetcher = vi.fn()
    await expect(fetchOpenMeteoWeather(points, fetcher, checkedAt, 0)).rejects.toThrow(/batch/i)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
