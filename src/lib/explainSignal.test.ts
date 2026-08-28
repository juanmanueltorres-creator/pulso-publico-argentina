import { describe, expect, it } from 'vitest'
import type { SignalEnvelope } from '../types/signal'
import { explainSignal } from './explainSignal'

const base = {
  schemaVersion: '1.0' as const,
  status: 'updated' as const,
  availability: 'available' as const,
  publishedAt: null,
  fetchedAt: '2026-08-28T00:00:00.000Z',
  source: { name: 'Fuente', url: 'https://example.com', kind: 'official' as const },
  method: { type: 'api' as const, note: 'Método' },
  limitations: [],
}

function signal(overrides: Partial<SignalEnvelope>): SignalEnvelope {
  return {
    ...base,
    id: 'test',
    category: 'energy',
    title: 'Test',
    value: 1,
    unit: 'u',
    periodLabel: 'Período',
    observedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as SignalEnvelope
}

describe('explainSignal', () => {
  it('translates CAMMESA GWh into TWh and an explicitly estimated household scale', () => {
    const explanation = explainSignal(
      signal({
        id: 'cammesa-renewables',
        category: 'energy',
        value: 1791.245147,
        unit: 'GWh',
        periodLabel: 'Julio 2026 · último dato publicado',
      }),
    )

    expect(explanation.summary).toContain('1,79 TWh')
    expect(explanation.summary).toContain('julio de 2026')
    expect(explanation.reference).toContain('7,2 millones de hogares')
    expect(explanation.reference).toContain('250 kWh')
    expect(explanation.isEstimate).toBe(true)
  })

  it('explains OpenAlex without presenting the index as a census of Argentine science', () => {
    const explanation = explainSignal(
      signal({
        id: 'openalex-argentina-works',
        category: 'science',
        value: 27994,
        unit: 'works',
        periodLabel: '2026 · afiliación institucional argentina',
        source: { name: 'OpenAlex', url: 'https://openalex.org', kind: 'open-index' },
      }),
    )

    expect(explanation.summary).toContain('27.994 trabajos')
    expect(explanation.summary).toContain('al menos una afiliación institucional argentina')
    expect(explanation.reference).toContain('No significa')
  })

  it('turns the monthly INPI count into an intuitive daily pace while preserving semantics', () => {
    const explanation = explainSignal(
      signal({
        id: 'inpi-patents',
        category: 'innovation',
        value: 323,
        unit: 'solicitudes',
        periodLabel: 'Julio 2026 · último mes completo',
      }),
    )

    expect(explanation.summary).toContain('323 solicitudes')
    expect(explanation.reference).toContain('algo más de 10 por día')
    expect(explanation.reference).toContain('no son patentes concedidas')
  })

  it('makes GeoRef staleness impossible to miss in the plain-language copy', () => {
    const explanation = explainSignal(
      signal({
        id: 'georef-api-usage',
        category: 'public-infrastructure',
        value: 264037620,
        unit: 'consultas',
        periodLabel: 'Acumulado al 2024-08-27',
        status: 'historical',
        availability: 'stale',
        observedAt: '2024-08-27T00:00:00.000Z',
      }),
    )

    expect(explanation.summary).toContain('264 millones de consultas')
    expect(explanation.reference).toContain('2024')
    expect(explanation.reference).toContain('no describe el uso actual')
  })
})
