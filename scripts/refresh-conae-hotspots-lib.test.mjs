import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseConaeHotspots } from './adapters/conae-hotspots.mjs'
import { refreshConaeHotspotSnapshot, selectConaeHotspots } from './refresh-conae-hotspots-lib.mjs'

const capabilities = await readFile(
  resolve(process.cwd(), 'scripts/fixtures/conae-capabilities.xml'),
  'utf8',
)
const featureCollection = JSON.parse(
  await readFile(resolve(process.cwd(), 'scripts/fixtures/conae-viirs.geojson'), 'utf8'),
)
const parsedEvents = parseConaeHotspots(featureCollection)

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

function successfulConaeFetch(url) {
  const requestUrl = new URL(url)
  if (requestUrl.searchParams.get('request') === 'GetCapabilities') {
    return Promise.resolve(new Response(capabilities, { status: 200 }))
  }
  return Promise.resolve(
    new Response(JSON.stringify(featureCollection), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('selectConaeHotspots', () => {
  it('keeps only last-24-hour detections inside the exact supplied Argentina polygon', () => {
    const selected = selectConaeHotspots(
      parsedEvents,
      argentinaFixture,
      '2026-08-28T05:00:00Z',
    )

    expect(selected.map((event) => event.id)).toEqual(['viirs.1'])
  })
})

describe('refreshConaeHotspotSnapshot', () => {
  it('publishes a traced 24-hour CONAE snapshot without upgrading detections into fire claims', async () => {
    const result = await refreshConaeHotspotSnapshot(
      null,
      argentinaFixture,
      successfulConaeFetch,
      '2026-08-28T05:00:00Z',
    )

    expect(result.publish).toBe(true)
    expect(result.snapshot).toMatchObject({
      schemaVersion: '1.0',
      kind: 'thermal-hotspot',
      generatedAt: '2026-08-28T05:00:00Z',
      sourceCheckedAt: '2026-08-28T05:00:00Z',
      window: { hours: 24 },
      freshness: { staleAfterMinutes: 240 },
      source: {
        name: 'CONAE',
        url: 'https://catalogos.conae.gov.ar/catalogo/catalogoGeoServiciosOGC.html',
        kind: 'official',
      },
      method: { type: 'wfs' },
    })
    expect(result.snapshot.events.map((event) => event.id)).toEqual(['viirs.1'])

    const limitations = result.snapshot.limitations.join(' ').toLowerCase()
    expect(limitations).toContain('no implica un incendio confirmado')
    expect(limitations).toContain('no equivale a probabilidad de incendio')
    expect(limitations).toContain('frp')
    expect(limitations).toContain('peligro')
  })

  it('does not publish a synthetic empty snapshot when the provider fails', async () => {
    const down = async () => new Response('down', { status: 503 })

    await expect(
      refreshConaeHotspotSnapshot(null, argentinaFixture, down, '2026-08-28T05:00:00Z'),
    ).rejects.toThrow(/503/)
  })
})
