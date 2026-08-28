import { describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { loadWeatherSnapshot } from './loadWeatherSnapshot'

describe('loadWeatherSnapshot', () => {
  it('loads /data/weather.json independently with no-store caching', async () => {
    const fixture = weatherSnapshotFixture()
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }))

    await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/pulso/')).resolves.toEqual(fixture)
    expect(fetcher).toHaveBeenCalledWith('/pulso/data/weather.json', { cache: 'no-store' })
  })

  it('normalizes a base URL without a trailing slash', async () => {
    const fixture = weatherSnapshotFixture()
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }))

    await loadWeatherSnapshot(fetcher as typeof fetch, '/pulso')

    expect(fetcher).toHaveBeenCalledWith('/pulso/data/weather.json', { cache: 'no-store' })
  })

  it('rejects HTTP failure instead of returning an empty weather snapshot', async () => {
    const fetcher = vi.fn(async () => new Response('down', { status: 503 }))

    await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/')).rejects.toThrow('HTTP 503')
  })

  it('rejects malformed JSON', async () => {
    const fetcher = vi.fn(async () => new Response('{broken', { status: 200 }))

    await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/')).rejects.toThrow()
  })

  it('rejects semantically invalid JSON through the weather validator', async () => {
    const fixture = weatherSnapshotFixture() as any
    fixture.schemaVersion = '9.0'
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }))

    await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/')).rejects.toThrow(
      'snapshot schemaVersion must be 1.0',
    )
  })
})
