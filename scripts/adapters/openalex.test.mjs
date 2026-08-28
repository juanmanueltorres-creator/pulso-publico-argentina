import { describe, expect, it } from 'vitest'
import { parseOpenAlexWorks } from './openalex.mjs'

describe('parseOpenAlexWorks', () => {
  it('maps meta.count to the 2026 Argentina-affiliation signal', () => {
    const payload = {
      meta: {
        count: 18452,
        page: 1,
        per_page: 1,
      },
      results: [],
    }

    const signal = parseOpenAlexWorks(payload, '2026-08-28T03:00:00.000Z', 2026)

    expect(signal).toMatchObject({
      schemaVersion: '1.0',
      id: 'openalex-argentina-works',
      category: 'science',
      title: 'Producción científica indexada',
      value: 18452,
      unit: 'works',
      periodLabel: '2026 · afiliación institucional argentina',
      status: 'updated',
      availability: 'available',
      observedAt: '2026-08-28T03:00:00.000Z',
      publishedAt: null,
      fetchedAt: '2026-08-28T03:00:00.000Z',
      source: {
        name: 'OpenAlex',
        kind: 'open-index',
      },
      method: {
        type: 'api',
      },
    })
  })

  it('fails closed when meta.count is missing', () => {
    expect(() => parseOpenAlexWorks({ meta: {} }, '2026-08-28T03:00:00.000Z', 2026)).toThrow(
      /meta.count/i,
    )
  })

  it('fails closed when meta.count is not a non-negative integer', () => {
    expect(() =>
      parseOpenAlexWorks({ meta: { count: -1 } }, '2026-08-28T03:00:00.000Z', 2026),
    ).toThrow(/non-negative integer/i)
  })
})
