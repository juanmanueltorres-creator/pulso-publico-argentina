import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseConaeHotspots } from './adapters/conae-hotspots.mjs'
import { refreshConaeHotspotSnapshot, selectConaeHotspots } from './refresh-conae-hotspots-lib.mjs'

const featureCollection = JSON.parse(
  await readFile(resolve(process.cwd(), 'scripts/fixtures/conae-viirs.geojson'), 'utf8'),
)
const wfsCapabilities = await readFile(
  resolve(process.cwd(), 'scripts/fixtures/conae-capabilities.xml'),
  'utf8',
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

const resultHtml = (token) => `
<script>
function mostrarMapa() {
  var formData = new FormData();
  formData.append("datosMapa", "1");
  formData.append("p", "${token}")
}
</script>`

const catalogPayloads = {
  NOAA20: [
    '-30.10000,-62.20000,2026-08-28 - 03:10:00,NOAA20,87',
    '-20.00000,-62.20000,2026-08-28 - 03:10:00,NOAA20,87',
  ].join('\r\n'),
  SNPP: '-34.50000,-64.50000,2026-08-27 - 06:20:00,SNPP,55\r\n',
}

async function successfulCatalogFetch(url, options = {}) {
  const requestUrl = new URL(url)
  if (requestUrl.pathname.endsWith('/search_date.aspx')) {
    const satellite = requestUrl.searchParams.get('satelite')
    return new Response(resultHtml(`token-${satellite}`), { status: 200 })
  }

  const body = new URLSearchParams(options.body)
  const satellite = body.get('p')?.replace('token-', '')
  return new Response(catalogPayloads[satellite], {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
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
  it('publishes a traced 24-hour CONAE catalog snapshot without upgrading detections into fire claims', async () => {
    const result = await refreshConaeHotspotSnapshot(
      null,
      argentinaFixture,
      successfulCatalogFetch,
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
        url: 'https://catalogos5.conae.gov.ar/catalogofocos/',
        kind: 'official',
      },
      method: { type: 'scrape' },
    })
    expect(result.snapshot.events).toHaveLength(2)
    expect(result.snapshot.events.map((event) => event.satellite)).toEqual(['SNPP', 'NOAA20'])
    expect(result.snapshot.events.every((event) => event.frpMw === null)).toBe(true)

    const limitations = result.snapshot.limitations.join(' ').toLowerCase()
    expect(limitations).toContain('no implica un incendio confirmado')
    expect(limitations).toContain('no equivale a probabilidad de incendio')
    expect(limitations).toContain('frp')
    expect(limitations).toContain('mapa público')
    expect(limitations).toContain('zona horaria')
  })

  it('recovers from a catalog result without a map token using official CONAE VIIRS WFS', async () => {
    const requested = []
    const fetchImpl = async (url) => {
      const requestUrl = new URL(url)
      requested.push(requestUrl)

      if (requestUrl.pathname.endsWith('/search_date.aspx')) {
        return new Response(
          '<html><body>No se encontraron Focos de Calor con el criterio de búsqueda solicitado.</body></html>',
          { status: 200 },
        )
      }

      if (requestUrl.searchParams.get('request') === 'GetCapabilities') {
        return new Response(wfsCapabilities, { status: 200 })
      }

      if (requestUrl.searchParams.get('request') === 'GetFeature') {
        return new Response(JSON.stringify(featureCollection), { status: 200 })
      }

      throw new Error(`Unexpected CONAE request: ${url}`)
    }

    const result = await refreshConaeHotspotSnapshot(
      null,
      argentinaFixture,
      fetchImpl,
      '2026-08-28T05:00:00Z',
    )

    expect(result.publish).toBe(true)
    expect(result.snapshot.method.type).toBe('wfs')
    expect(result.snapshot.source).toMatchObject({
      name: 'CONAE',
      url: 'https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs',
      kind: 'official',
    })
    expect(result.snapshot.events).toHaveLength(1)
    expect(result.snapshot.events[0]).toMatchObject({ id: 'viirs.1' })
    expect(result.snapshot.limitations.join(' ')).toContain('capa WFS')
    expect(requested.map((url) => url.searchParams.get('request')).filter(Boolean)).toEqual([
      'GetCapabilities',
      'GetFeature',
    ])
  })

  it('fails closed if a catalog response has no token and the official WFS is unavailable', async () => {
    const fetchImpl = async (url) => (
      String(url).includes('search_date.aspx')
        ? new Response('<html><body>Unexpected CONAE HTML</body></html>', { status: 200 })
        : new Response('Service Unavailable', { status: 503 })
    )

    await expect(
      refreshConaeHotspotSnapshot(null, argentinaFixture, fetchImpl, '2026-08-28T05:00:00Z'),
    ).rejects.toThrow(/catalog .*token was not found.*WFS .*503/)
  })

  it('does not publish a synthetic empty snapshot when the provider fails', async () => {
    const down = async () => new Response('down', { status: 503 })

    await expect(
      refreshConaeHotspotSnapshot(null, argentinaFixture, down, '2026-08-28T05:00:00Z'),
    ).rejects.toThrow(/503/)
  })
})
