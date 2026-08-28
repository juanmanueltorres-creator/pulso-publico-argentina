const CAMMESA_SOURCE_URL = 'https://cammesaweb.cammesa.com/erenovables/'

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function parsePeriod(period) {
  if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error('CAMMESA period must use YYYY-MM')
  }

  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  return {
    year,
    month,
    observedAt: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    periodLabel: `${MONTHS_ES[month - 1]} ${year} · último dato publicado`,
  }
}

export function parseCammesaRenewables(payload, fetchedAt = new Date().toISOString()) {
  const totalGwh = payload?.totalGwh
  if (typeof totalGwh !== 'number' || !Number.isFinite(totalGwh)) {
    throw new Error('CAMMESA Total GWh must be numeric')
  }

  const fetched = new Date(fetchedAt)
  if (Number.isNaN(fetched.getTime())) {
    throw new Error('CAMMESA fetchedAt must be a valid ISO date')
  }

  const period = parsePeriod(payload?.period)

  return {
    schemaVersion: '1.0',
    id: 'cammesa-renewables',
    category: 'energy',
    title: 'Energía renovable generada',
    value: totalGwh,
    unit: 'GWh',
    periodLabel: period.periodLabel,
    status: 'updated',
    availability: 'available',
    observedAt: period.observedAt,
    publishedAt: null,
    fetchedAt,
    source: {
      name: 'CAMMESA',
      url: CAMMESA_SOURCE_URL,
      kind: 'official',
    },
    method: {
      type: 'xlsx',
      note: 'Valor Total GWh de la hoja Tabla Resumen Global de la base mensual oficial Energía Renovables de CAMMESA.',
    },
    limitations: [
      'Es un dato mensual publicado por CAMMESA y no representa generación renovable en tiempo real.',
      'Pulso Público usa el total agregado publicado por CAMMESA; no recalcula el valor sumando centrales o máquinas.',
      'La publicación mensual puede tener rezago respecto del mes observado y los históricos pueden recibir correcciones posteriores.',
    ],
  }
}
