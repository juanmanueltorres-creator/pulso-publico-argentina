import { describe, expect, it } from 'vitest'
import type { EarthquakeEvent, TerritorialSnapshot } from '../types/territorial'
import { loadTerritorialSnapshot } from './loadTerritorialSnapshot'

const earthquakeSnapshot = {
  schemaVersion: '1.0',
  kind: 'earthquake',
  generatedAt: '2026-08-28T04:00:00.000Z',
  sourceCheckedAt: '2026-08-28T04:00:00.000Z',
  window: { hours: 168 },
  freshness: { staleAfterMinutes: 240 },
  source: {
    name: 'INPRES',
    url: 'https://www.inpres.gob.ar/sismos_consultados',
    kind: 'official',
  },
  method: { type: 'scrape', note: 'Tabla oficial de sismos recientes.' },
  limitations: [],
  events: [],
} satisfies TerritorialSnapshot<EarthquakeEvent>

describe('loadTerritorialSnapshot', () => {
  it('loads earthquakes below the Vite base path', async () => {
    let requested = ''
    const fetcher = async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(JSON.stringify(earthquakeSnapshot), { status: 200 })
    }

    const result = await loadTerritorialSnapshot(
      'earthquake',
      fetcher as typeof fetch,
      '/pulso-publico-argentina/',
    )

    expect(requested).toBe('/pulso-publico-argentina/data/earthquakes.json')
    expect(result.kind).toBe('earthquake')
  })

  it('throws instead of turning an HTTP failure into zero events', async () => {
    const fetcher = async () => new Response('down', { status: 503 })

    await expect(
      loadTerritorialSnapshot('thermal-hotspot', fetcher as typeof fetch),
    ).rejects.toThrow(/503/)
  })
})
