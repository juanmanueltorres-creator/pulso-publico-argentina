import { parseInpiPatentFilings } from './adapters/inpi.mjs'

const INPI_ENDPOINT = 'https://datos.inpi.gob.ar/Home/getEstadisticasCSV'
const INPI_REFERER = 'https://datos.inpi.gob.ar/Home/Ingresos_Patentes'

export function buildInpiMonthlyUrl() {
  const url = new URL(INPI_ENDPOINT)
  url.searchParams.set('tipoTramite', 'Patentes')
  url.searchParams.set('mes', '1')
  url.searchParams.set('ano', '0')
  return url
}

export async function fetchInpiPatentFilings(
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
) {
  const response = await fetchImpl(buildInpiMonthlyUrl(), {
    headers: {
      accept: 'application/json,text/javascript,*/*;q=0.1',
      'x-requested-with': 'XMLHttpRequest',
      referer: INPI_REFERER,
    },
  })

  if (!response?.ok) {
    throw new Error(`INPI dashboard endpoint request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const payload = await response.json()
  return parseInpiPatentFilings(payload, fetchedAt)
}
