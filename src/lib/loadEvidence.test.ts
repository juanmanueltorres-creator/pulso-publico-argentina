import { describe, expect, it } from 'vitest'
import { loadEvidence } from './loadEvidence'

const validSnapshot = {
  schemaVersion: '1.0',
  generatedAt: '2026-08-28T19:30:00Z',
  evidences: [
    {
      id: 'agroenso-maize-nino-villaguay',
      claim: {
        type: 'historical-association',
        title: 'Maíz + El Niño en Villaguay',
        statement: 'Asociación histórica positiva reportada para Villaguay.',
      },
      territory: {
        countryCode: 'AR',
        province: 'Entre Ríos',
        adminLevel: 'department',
        adminName: 'Villaguay',
        adminCode: '30113',
        geometryRef: '/data/evidence/territories/villaguay.geojson',
      },
      subject: {
        domain: 'agriculture',
        variable: 'Maíz',
        condition: 'El Niño',
      },
      result: {
        value: 24,
        unit: '%',
        interpretation: 'Referencia externa aproximada.',
        statisticalSignificance: null,
      },
      temporalContext: {
        coverage: '35 campañas históricas',
        observedAt: null,
        freshness: 'historical',
      },
      provenance: {
        resultKind: 'external-reference',
        analysisName: 'AgroENSO',
        authors: ['Juan Pablo Monzon'],
        sourceUrl: 'https://www.argentina.gob.ar/example',
        inputs: [
          {
            role: 'yield-data',
            sourceName: 'MAGyP',
            sourceUrl: 'https://datos.magyp.gob.ar/example',
          },
        ],
      },
      method: {
        summary: 'Análisis histórico reportado por la fuente.',
        processingSteps: ['Serie histórica'],
      },
      limitations: ['No es un pronóstico de rendimiento.'],
      missingContext: ['Agua útil actual'],
    },
  ],
}

describe('loadEvidence', () => {
  it('loads and validates the public evidence snapshot below the Vite base path', async () => {
    let requestedUrl = ''
    const fetcher = async (input: RequestInfo | URL) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify(validSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await loadEvidence(fetcher as typeof fetch, '/pulso-publico-argentina/')

    expect(requestedUrl).toBe('/pulso-publico-argentina/data/evidence.json')
    expect(result.evidences[0].id).toBe('agroenso-maize-nino-villaguay')
  })

  it('rejects a failed HTTP response', async () => {
    const fetcher = async () => new Response('unavailable', { status: 503 })
    await expect(loadEvidence(fetcher as typeof fetch)).rejects.toThrow(/503/)
  })

  it('rejects malformed JSON', async () => {
    const fetcher = async () =>
      new Response('{not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    await expect(loadEvidence(fetcher as typeof fetch)).rejects.toThrow()
  })

  it('rejects a semantically invalid snapshot', async () => {
    const invalid = { ...validSnapshot, schemaVersion: '2.0' }
    const fetcher = async () =>
      new Response(JSON.stringify(invalid), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    await expect(loadEvidence(fetcher as typeof fetch)).rejects.toThrow(/schemaVersion/i)
  })
})
