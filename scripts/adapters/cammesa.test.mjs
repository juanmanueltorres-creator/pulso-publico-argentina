import { describe, expect, it } from 'vitest'
import { parseCammesaRenewables } from './cammesa.mjs'

const fetchedAt = '2026-08-28T03:20:00.000Z'

describe('parseCammesaRenewables', () => {
  it('maps the official monthly Total GWh to an updated signal', () => {
    const signal = parseCammesaRenewables(
      { period: '2026-07', totalGwh: 1791.245147 },
      fetchedAt,
    )

    expect(signal).toMatchObject({
      schemaVersion: '1.0',
      id: 'cammesa-renewables',
      category: 'energy',
      title: 'Energía renovable generada',
      value: 1791.245147,
      unit: 'GWh',
      periodLabel: 'Julio 2026 · último dato publicado',
      status: 'updated',
      availability: 'available',
      observedAt: '2026-07-01T00:00:00.000Z',
      publishedAt: null,
      fetchedAt,
      source: {
        name: 'CAMMESA',
        kind: 'official',
      },
      method: {
        type: 'xlsx',
      },
    })
  })

  it('accepts zero as a valid official monthly total', () => {
    const signal = parseCammesaRenewables(
      { period: '2026-07', totalGwh: 0 },
      fetchedAt,
    )

    expect(signal.value).toBe(0)
    expect(signal.availability).toBe('available')
  })

  it('fails closed when the period is malformed', () => {
    expect(() =>
      parseCammesaRenewables({ period: 'julio-2026', totalGwh: 1791 }, fetchedAt),
    ).toThrow(/period/i)
  })

  it('fails closed when Total GWh is not numeric', () => {
    expect(() =>
      parseCammesaRenewables({ period: '2026-07', totalGwh: 'unknown' }, fetchedAt),
    ).toThrow(/numeric/i)
  })
})
