import { describe, expect, it } from 'vitest'
import { loadSignals } from './loadSignals'

const validSnapshot = {
  schemaVersion: '1.0',
  generatedAt: '2026-08-27T00:00:00Z',
  signals: [
    {
      schemaVersion: '1.0',
      id: 'georef-usage',
      category: 'public-infrastructure',
      title: 'Consultas históricas a GeoRef',
      value: 123,
      unit: 'consultas',
      periodLabel: 'Último dato publicado',
      status: 'updated',
      availability: 'available',
      observedAt: '2026-08-20',
      publishedAt: null,
      fetchedAt: '2026-08-27T00:00:00Z',
      source: {
        name: 'Datos Argentina · GeoRef',
        url: 'https://www.datos.gob.ar/dataset/jgm_8/archivo/jgm_8.24',
        kind: 'official',
      },
      method: {
        type: 'api',
        note: 'Serie oficial apis_georef_005.',
      },
      limitations: ['La frecuencia declarada del recurso es semanal.'],
    },
  ],
}

describe('loadSignals', () => {
  it('loads and validates the public snapshot', async () => {
    const fetcher = async () =>
      new Response(JSON.stringify(validSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const result = await loadSignals(fetcher as typeof fetch)

    expect(result.schemaVersion).toBe('1.0')
    expect(result.signals[0].id).toBe('georef-usage')
  })

  it('loads the snapshot below the Vite base path', async () => {
    let requestedUrl = ''
    const fetcher = async (input: RequestInfo | URL) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify(validSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    await loadSignals(fetcher as typeof fetch, '/pulso-publico-argentina/')

    expect(requestedUrl).toBe('/pulso-publico-argentina/data/signals.json')
  })

  it('throws when the public snapshot request fails', async () => {
    const fetcher = async () => new Response('nope', { status: 503 })

    await expect(loadSignals(fetcher as typeof fetch)).rejects.toThrow(/503/)
  })
})
