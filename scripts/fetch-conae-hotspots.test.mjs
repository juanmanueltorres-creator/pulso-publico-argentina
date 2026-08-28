import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CONAE_VIIRS_LAYER, fetchConaeHotspots } from './fetch-conae-hotspots.mjs'

const capabilities = await readFile(
  resolve(process.cwd(), 'scripts/fixtures/conae-capabilities.xml'),
  'utf8',
)
const featureCollection = JSON.parse(
  await readFile(resolve(process.cwd(), 'scripts/fixtures/conae-viirs.geojson'), 'utf8'),
)

describe('fetchConaeHotspots', () => {
  it('checks capabilities before requesting the exact VIIRS layer as EPSG:4326 GeoJSON', async () => {
    const requestedUrls = []
    const fetchImpl = vi.fn(async (url) => {
      const requestUrl = new URL(url)
      requestedUrls.push(requestUrl)

      if (requestUrl.searchParams.get('request') === 'GetCapabilities') {
        return new Response(capabilities, { status: 200 })
      }

      return new Response(JSON.stringify(featureCollection), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const events = await fetchConaeHotspots(fetchImpl)

    expect(events).toHaveLength(3)
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    expect(requestedUrls[0].searchParams.get('service')).toBe('WFS')
    expect(requestedUrls[0].searchParams.get('version')).toBe('2.0.0')
    expect(requestedUrls[0].searchParams.get('request')).toBe('GetCapabilities')

    expect(requestedUrls[1].searchParams.get('request')).toBe('GetFeature')
    expect(requestedUrls[1].searchParams.get('typeNames')).toBe(CONAE_VIIRS_LAYER)
    expect(requestedUrls[1].searchParams.get('outputFormat')).toBe('application/json')
    expect(requestedUrls[1].searchParams.get('srsName')).toBe('EPSG:4326')
  })

  it('fails closed when the advertised VIIRS layer is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<WFS_Capabilities><FeatureTypeList /></WFS_Capabilities>', { status: 200 }),
    )

    await expect(fetchConaeHotspots(fetchImpl)).rejects.toThrow(/FocosDeCalorVIIRS/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails closed on provider HTTP failure', async () => {
    const fetchImpl = async () => new Response('down', { status: 503 })

    await expect(fetchConaeHotspots(fetchImpl)).rejects.toThrow(/503/)
  })
})
