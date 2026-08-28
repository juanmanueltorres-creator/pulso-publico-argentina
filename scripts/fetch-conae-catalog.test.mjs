import { describe, expect, it, vi } from 'vitest'
import {
  CONAE_PUBLIC_MAP_SATELLITES,
  buildConaeCatalogSearchUrl,
  extractConaePublicMapToken,
  fetchConaeCatalogHotspots,
} from './fetch-conae-hotspots.mjs'

const resultHtml = (token) => `
<script>
function mostrarMapa() {
  var formData = new FormData();
  formData.append("datosMapa", "1");
  formData.append("p", "${token}")
}
</script>`

const payloadBySatellite = {
  NOAA20: '-25.47868,-55.10352,2026-08-27 - 03:53:00,NOAA20,55\r\n',
  SNPP: '-34.50000,-64.50000,2026-08-28 - 04:20:00,SNPP,87\r\n',
}

describe('CONAE public catalog acquisition', () => {
  it('builds a bounded detail search for one VIIRS satellite', () => {
    const url = new URL(buildConaeCatalogSearchUrl('NOAA20', '2026-08-27', '2026-08-28'))

    expect(url.hostname).toBe('catalogos5.conae.gov.ar')
    expect(url.pathname).toMatch(/catalogofocos\/search_date\.aspx$/i)
    expect(url.searchParams.get('satelite')).toBe('NOAA20')
    expect(url.searchParams.get('Confianza')).toBe('0')
    expect(url.searchParams.get('tipoA')).toBe('dib')
    expect(url.searchParams.get('formato')).toBe('csv')
    expect(url.searchParams.get('tipoTot')).toBe('det')
    expect(url.searchParams.get('Coordenadas')).toBe('-21.7_-73.7_-55.2_-53.5')
  })

  it('extracts only the token used by the public map request', () => {
    expect(extractConaePublicMapToken(resultHtml('abc-2026'))).toBe('abc-2026')
    expect(() => extractConaePublicMapToken('<html></html>')).toThrow(/token/i)
  })

  it('fetches NOAA20 and SNPP and combines their public map detections', async () => {
    const calls = []
    const fetchImpl = vi.fn(async (url, options = {}) => {
      const requestUrl = new URL(url)
      calls.push({ url: requestUrl, options })

      if (requestUrl.pathname.endsWith('/search_date.aspx')) {
        const satellite = requestUrl.searchParams.get('satelite')
        return new Response(resultHtml(`token-${satellite}`), { status: 200 })
      }

      const body = new URLSearchParams(options.body)
      const token = body.get('p')
      const satellite = token?.replace('token-', '')
      return new Response(payloadBySatellite[satellite], {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    })

    const events = await fetchConaeCatalogHotspots(
      fetchImpl,
      '2026-08-28T12:00:00.000Z',
    )

    expect(CONAE_PUBLIC_MAP_SATELLITES).toEqual(['NOAA20', 'SNPP'])
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.satellite)).toEqual(['NOAA20', 'SNPP'])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(calls.filter(({ url }) => url.pathname.endsWith('/descarga.aspx'))).toHaveLength(2)
  })

  it('fails the whole refresh if either satellite request fails', async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      const requestUrl = new URL(url)
      if (requestUrl.pathname.endsWith('/search_date.aspx')) {
        const satellite = requestUrl.searchParams.get('satelite')
        if (satellite === 'SNPP') return new Response('down', { status: 503 })
        return new Response(resultHtml('token-NOAA20'), { status: 200 })
      }
      return new Response(payloadBySatellite.NOAA20, { status: 200 })
    })

    await expect(
      fetchConaeCatalogHotspots(fetchImpl, '2026-08-28T12:00:00.000Z'),
    ).rejects.toThrow(/503/)
  })
})
