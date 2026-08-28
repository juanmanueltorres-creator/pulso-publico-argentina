import { describe, expect, it } from 'vitest'
import { validateSnapshot } from './validateSnapshot'

const unavailableSignal = {
  schemaVersion: '1.0',
  id: 'energy-renewables',
  category: 'energy',
  title: 'Generación renovable',
  value: null,
  unit: 'MW',
  periodLabel: 'Fuente pendiente de integración',
  status: 'updated',
  availability: 'unavailable',
  observedAt: null,
  publishedAt: null,
  fetchedAt: '2026-08-27T00:00:00Z',
  source: {
    name: 'CAMMESA',
    url: 'https://cammesaweb.cammesa.com/inicio-renovables/',
    kind: 'official',
  },
  method: {
    type: 'api',
    note: 'Pendiente de confirmar un endpoint estructurado estable.',
  },
  limitations: ['No se publica un valor hasta verificar la fuente.'],
}

describe('validateSnapshot', () => {
  it('accepts an unavailable signal with a null value', () => {
    const snapshot = validateSnapshot({
      schemaVersion: '1.0',
      generatedAt: '2026-08-27T00:00:00Z',
      signals: [unavailableSignal],
    })

    expect(snapshot.signals[0].value).toBeNull()
  })

  it('rejects available signals with null values', () => {
    expect(() =>
      validateSnapshot({
        schemaVersion: '1.0',
        generatedAt: '2026-08-27T00:00:00Z',
        signals: [{ ...unavailableSignal, availability: 'available' }],
      }),
    ).toThrow(/value/i)
  })

  it('rejects unsupported signal states', () => {
    expect(() =>
      validateSnapshot({
        schemaVersion: '1.0',
        generatedAt: '2026-08-27T00:00:00Z',
        signals: [{ ...unavailableSignal, status: 'magic-live' }],
      }),
    ).toThrow(/status/i)
  })
})
