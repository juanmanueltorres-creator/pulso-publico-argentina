const INPI_SOURCE_URL = 'https://datos.inpi.gob.ar/Home/Ingresos_Patentes'
const PATENT_FIELD = 'Patente de Invencion'

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

function parseMonthStart(raw) {
  if (typeof raw !== 'string') {
    throw new Error('INPI monthly observation must include Mes')
  }

  const match = raw.match(/^(\d{4})-(\d{2})-01(?:T|$)/)
  if (!match) {
    throw new Error('INPI Mes must be a first-of-month ISO date')
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('INPI Mes must contain a valid month')
  }

  const date = new Date(Date.UTC(year, monthIndex, 1))
  return { date, year, monthIndex, iso: date.toISOString() }
}

function currentMonthStart(fetchedAt) {
  const fetched = new Date(fetchedAt)
  if (Number.isNaN(fetched.getTime())) {
    throw new Error('INPI fetchedAt must be a valid ISO date')
  }

  return new Date(Date.UTC(fetched.getUTCFullYear(), fetched.getUTCMonth(), 1))
}

export function parseInpiPatentFilings(payload, fetchedAt = new Date().toISOString()) {
  if (!Array.isArray(payload)) {
    throw new Error('INPI monthly payload must be an array')
  }

  const cutoff = currentMonthStart(fetchedAt)
  const completed = payload
    .map((row) => ({ row, month: parseMonthStart(row?.Mes) }))
    .filter(({ month }) => month.date.getTime() < cutoff.getTime())
    .sort((a, b) => a.month.date.getTime() - b.month.date.getTime())

  const latest = completed.at(-1)
  if (!latest) {
    throw new Error('INPI response does not contain a completed month')
  }

  const value = latest.row[PATENT_FIELD]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('INPI patent filing value must be numeric')
  }

  const { year, monthIndex, iso } = latest.month

  return {
    schemaVersion: '1.0',
    id: 'inpi-patents',
    category: 'innovation',
    title: 'Solicitudes de patentes de invención ingresadas',
    value,
    unit: 'solicitudes',
    periodLabel: `${MONTHS_ES[monthIndex]} ${year} · último mes completo`,
    status: 'updated',
    availability: 'available',
    observedAt: iso,
    publishedAt: null,
    fetchedAt,
    source: {
      name: 'INPI Argentina',
      url: INPI_SOURCE_URL,
      kind: 'official',
    },
    method: {
      type: 'api',
      note: 'Último mes calendario completo del endpoint JSON getEstadisticasCSV utilizado por el dashboard oficial, con tipoTramite=Patentes, mes=1 y ano=0.',
    },
    limitations: [
      'El mes calendario en curso se excluye automáticamente porque puede estar incompleto; un cero sólo se publica si pertenece a un mes ya cerrado.',
      'El endpoint JSON es utilizado por el dashboard oficial del INPI pero no está documentado como API pública estable y puede cambiar.',
      'La métrica representa ingresos de solicitudes de patentes de invención; no equivale a patentes concedidas, expedientes resueltos ni modelos de utilidad.',
      'Los valores históricos pueden recibir correcciones o actualizaciones posteriores por parte de la fuente.',
    ],
  }
}
