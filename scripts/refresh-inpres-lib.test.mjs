import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInpresEarthquakes } from './adapters/inpres.mjs'
import { refreshInpresSnapshot, selectInpresEarthquakes } from './refresh-inpres-lib.mjs'

const fixture = await readFile(resolve(process.cwd(), 'scripts/fixtures/inpres-recent.html'), 'utf8')
const parsedEvents = parseInpresEarthquakes(fixture)

const argentinaFixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-69.5, -55],
          [-53, -55],
          [-53, -21],
          [-69.5, -21],
          [-69.5, -55],
        ]],
      },
    },
  ],
}

describe('selectInpresEarthquakes', () => {
  it('filters by the last 168 hours and the exact supplied Argentina polygon', () => {
    const selected = selectInpresEarthquakes(
      parsedEvents,
      argentinaFixture,
      '2026-08-28T05:00:00Z',
    )

    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({ province: 'SAN JUAN', magnitude: 4.2 })
  })
})

describe('refreshInpresSnapshot', () => {
  it('publishes a traced earthquake snapshot from a successful source check', async () => {
    const fetchImpl = async () => new Response(fixture, { status: 200 })

    const result = await refreshInpresSnapshot(
      null,
      argentinaFixture,
      fetchImpl,
      '2026-08-28T05:00:00Z',
    )

    expect(result.publish).toBe(true)
    expect(result.snapshot).toMatchObject({
      schemaVersion: '1.0',
      kind: 'earthquake',
      generatedAt: '2026-08-28T05:00:00Z',
      sourceCheckedAt: '2026-08-28T05:00:00Z',
      window: { hours: 168 },
      freshness: { staleAfterMinutes: 240 },
      source: {
        name: 'INPRES',
        url: 'https://www.inpres.gob.ar/sismos_consultados',
        kind: 'official',
      },
      method: { type: 'scrape' },
    })
    expect(result.snapshot.events).toHaveLength(1)
  })

  it('rejects source HTTP failure instead of publishing zero events', async () => {
    const down = async () => new Response('down', { status: 503 })

    await expect(
      refreshInpresSnapshot(null, argentinaFixture, down, '2026-08-28T05:00:00Z'),
    ).rejects.toThrow(/503/)
  })
})
