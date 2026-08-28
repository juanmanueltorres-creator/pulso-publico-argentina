import { describe, expect, it } from 'vitest'
import { parseGeorefSeries } from './georef.mjs'

describe('parseGeorefSeries', () => {
  it('maps the latest apis_georef_005 datapoint to an available signal', () => {
    const payload = {
      data: [['2026-08-24', 123456789]],
    }

    const signal = parseGeorefSeries(payload, '2026-08-28T02:15:00.000Z')

    expect(signal).toMatchObject({
      schemaVersion: '1.0',
      id: 'georef-api-usage',
      category: 'public-infrastructure',
      title: 'Consultas históricas a GeoRef',
      value: 123456789,
      unit: 'consultas',
      periodLabel: 'Acumulado al 2026-08-24',
      status: 'updated',
      availability: 'available',
      observedAt: '2026-08-24T00:00:00.000Z',
      publishedAt: null,
      fetchedAt: '2026-08-28T02:15:00.000Z',
      source: {
        name: 'Datos Argentina · GeoRef',
        kind: 'official',
      },
      method: {
        type: 'api',
      },
    })
  })

  it('fails closed when the API returns no datapoint', () => {
    expect(() => parseGeorefSeries({ data: [] }, '2026-08-28T02:15:00.000Z')).toThrow(
      /latest datapoint/i,
    )
  })

  it('fails closed when the latest value is not numeric', () => {
    expect(() =>
      parseGeorefSeries({ data: [['2026-08-24', 'unknown']] }, '2026-08-28T02:15:00.000Z'),
    ).toThrow(/numeric/i)
  })
})
