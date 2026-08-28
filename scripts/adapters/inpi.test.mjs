import { describe, expect, it } from 'vitest'
import { parseInpiPatentFilings } from './inpi.mjs'

const fetchedAt = '2026-08-28T03:00:00.000Z'

const monthlyPayload = [
  {
    Mes: '2026-06-01T00:00:00',
    'Modelo de Utilidad': 22,
    'Patente de Invencion': 301,
  },
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
]

describe('parseInpiPatentFilings', () => {
  it('uses the latest completed calendar month and ignores the current partial month', () => {
    const signal = parseInpiPatentFilings(monthlyPayload, fetchedAt)

    expect(signal).toMatchObject({
      schemaVersion: '1.0',
      id: 'inpi-patents',
      category: 'innovation',
      title: 'Solicitudes de patentes de invención ingresadas',
      value: 323,
      unit: 'solicitudes',
      periodLabel: 'Julio 2026 · último mes completo',
      status: 'updated',
      availability: 'available',
      observedAt: '2026-07-01T00:00:00.000Z',
      publishedAt: null,
      fetchedAt,
      source: {
        name: 'INPI Argentina',
        kind: 'official',
      },
      method: {
        type: 'api',
      },
    })
  })

  it('accepts an official zero when it belongs to a completed month', () => {
    const payload = [
      {
        Mes: '2026-06-01T00:00:00',
        'Modelo de Utilidad': 4,
        'Patente de Invencion': 0,
      },
      {
        Mes: '2026-07-01T00:00:00',
        'Modelo de Utilidad': 2,
        'Patente de Invencion': 11,
      },
    ]

    const signal = parseInpiPatentFilings(payload, '2026-07-15T12:00:00.000Z')
    expect(signal.value).toBe(0)
    expect(signal.periodLabel).toBe('Junio 2026 · último mes completo')
  })

  it('fails closed when there is no completed monthly observation', () => {
    expect(() =>
      parseInpiPatentFilings(
        [
          {
            Mes: '2026-08-01T00:00:00',
            'Modelo de Utilidad': 1,
            'Patente de Invencion': 0,
          },
        ],
        fetchedAt,
      ),
    ).toThrow(/completed month/i)
  })

  it('fails closed when the patent value is not numeric', () => {
    expect(() =>
      parseInpiPatentFilings(
        [
          {
            Mes: '2026-07-01T00:00:00',
            'Modelo de Utilidad': 1,
            'Patente de Invencion': 'unknown',
          },
        ],
        fetchedAt,
      ),
    ).toThrow(/numeric/i)
  })
})
