import { describe, expect, it } from 'vitest'
import { fetchInpiPatentFilings } from './fetch-inpi.mjs'

describe('fetchInpiPatentFilings', () => {
  it('requests the structured monthly patent-filings endpoint used by the official dashboard', async () => {
    let requestedUrl = ''
    let requestedOptions = null
    const fakeFetch = async (url, options) => {
      requestedUrl = String(url)
      requestedOptions = options
      return {
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
      }
    }

    const signal = await fetchInpiPatentFilings(fakeFetch, '2026-08-28T03:10:00.000Z')

    const url = new URL(requestedUrl)
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://datos.inpi.gob.ar/Home/getEstadisticasCSV',
    )
    expect(url.searchParams.get('tipoTramite')).toBe('Patentes')
    expect(url.searchParams.get('mes')).toBe('1')
    expect(url.searchParams.get('ano')).toBe('0')
    expect(requestedOptions.headers.accept).toContain('application/json')
    expect(requestedOptions.headers['x-requested-with']).toBe('XMLHttpRequest')
    expect(signal.value).toBe(323)
    expect(signal.periodLabel).toBe('Julio 2026 · último mes completo')
  })

  it('fails closed when the official dashboard endpoint does not return HTTP success', async () => {
    const fakeFetch = async () => ({ ok: false, status: 503 })

    await expect(
      fetchInpiPatentFilings(fakeFetch, '2026-08-28T03:10:00.000Z'),
    ).rejects.toThrow(/503/)
  })
})
