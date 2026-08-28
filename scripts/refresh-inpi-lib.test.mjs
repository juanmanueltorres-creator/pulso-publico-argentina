import { describe, expect, it } from 'vitest'
import { refreshInpiSnapshot } from './refresh-inpi-lib.mjs'

describe('refreshInpiSnapshot', () => {
  it('replaces only the INPI signal and advances generatedAt', async () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T02:00:00.000Z',
      signals: [
        { id: 'cammesa-renewables', value: null },
        { id: 'openalex-argentina-works', value: 27994 },
        { id: 'inpi-patents', value: null, availability: 'unavailable' },
        { id: 'georef-api-usage', value: 264037620 },
      ],
    }

    const fakeFetch = async () => ({
      ok: true,
      json: async () => [
        {
          Mes: '2026-07-01T00:00:00',
          'Modelo de Utilidad': 33,
          'Patente de Invencion': 323,
        },
        {
          Mes: '2026-08-01T00:00:00',
          'Modelo de Utilidad': 1,
          'Patente de Invencion': 0,
        },
      ],
    })

    const next = await refreshInpiSnapshot(
      snapshot,
      fakeFetch,
      '2026-08-28T03:20:00.000Z',
    )

    expect(next.generatedAt).toBe('2026-08-28T03:20:00.000Z')
    expect(next.signals[0]).toEqual({ id: 'cammesa-renewables', value: null })
    expect(next.signals[1]).toEqual({ id: 'openalex-argentina-works', value: 27994 })
    expect(next.signals[2]).toMatchObject({
      id: 'inpi-patents',
      value: 323,
      availability: 'available',
      periodLabel: 'Julio 2026 · último mes completo',
      fetchedAt: '2026-08-28T03:20:00.000Z',
    })
    expect(next.signals[3]).toEqual({ id: 'georef-api-usage', value: 264037620 })
  })

  it('fails closed when the snapshot does not contain exactly one INPI signal', async () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T02:00:00.000Z',
      signals: [{ id: 'openalex-argentina-works', value: 27994 }],
    }

    const fakeFetch = async () => ({
      ok: true,
      json: async () => [
        {
          Mes: '2026-07-01T00:00:00',
          'Modelo de Utilidad': 33,
          'Patente de Invencion': 323,
        },
      ],
    })

    await expect(
      refreshInpiSnapshot(snapshot, fakeFetch, '2026-08-28T03:20:00.000Z'),
    ).rejects.toThrow(/exactly one inpi-patents/i)
  })
})
