import type { SignalEnvelope } from '../types/signal'

export interface SignalExplanation {
  summary: string
  reference: string | null
  isEstimate: boolean
}

const NUMBER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const INTEGER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const ONE_DECIMAL = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function monthAndYear(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function fullDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function daysInObservedMonth(value: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

export function explainSignal(signal: SignalEnvelope): SignalExplanation {
  if (signal.value === null) {
    return {
      summary: 'Todavía no hay un valor verificado para explicar.',
      reference: 'Cuando la fuente esté disponible, Pulso Público mostrará el dato sin reemplazarlo por cero.',
      isEstimate: false,
    }
  }

  if (signal.id === 'cammesa-renewables') {
    const period = monthAndYear(signal.observedAt) ?? 'el último mes publicado'
    const twh = signal.value / 1000
    const householdsMillions = signal.value / 250

    return {
      summary: `En ${period}, las renovables generaron ${NUMBER.format(twh)} TWh de electricidad.`,
      reference: `Para imaginar la escala: equivale aproximadamente al consumo mensual de ${ONE_DECIMAL.format(householdsMillions)} millones de hogares si usamos 250 kWh por hogar. Eso muestra la escala real que ya tienen las renovables dentro del sistema eléctrico.`,
      isEstimate: true,
    }
  }

  if (signal.id === 'openalex-argentina-works') {
    const year = signal.periodLabel.match(/\b20\d{2}\b/)?.[0] ?? 'el período publicado'

    return {
      summary: `OpenAlex registra ${INTEGER.format(signal.value)} trabajos de ${year} vinculados con al menos una de las instituciones argentinas que aparecen en su índice.`,
      reference: 'Eso muestra capacidad científica argentina: universidades e institutos del país participan en decenas de miles de trabajos visibles en un índice científico internacional. No significa que todos sean exclusivamente argentinos y OpenAlex no es un censo completo.',
      isEstimate: false,
    }
  }

  if (signal.id === 'inpi-patents') {
    const days = daysInObservedMonth(signal.observedAt)
    const daily = days ? signal.value / days : null
    const pace = daily === null ? null : Math.round(daily)

    return {
      summary: `En el último mes completo ingresaron ${INTEGER.format(signal.value)} solicitudes de patentes de invención.`,
      reference:
        pace === null
          ? 'Son personas y organizaciones intentando proteger desarrollos nuevos. Es una señal de actividad inventiva, pero no significa que ya sean patentes concedidas.'
          : `Son algo más de ${INTEGER.format(pace)} por día calendario: personas y organizaciones intentando proteger desarrollos nuevos. Es una señal de actividad inventiva, pero no significa que ya sean patentes concedidas.`,
      isEstimate: pace !== null,
    }
  }

  if (signal.id === 'georef-api-usage') {
    const observed = fullDate(signal.observedAt) ?? 'la última fecha publicada'
    const millions = Math.round(signal.value / 1_000_000)
    const observedYear = signal.observedAt?.slice(0, 4) ?? 'una fecha anterior'

    return {
      summary: `Hasta el ${observed}, GeoRef acumulaba unos ${INTEGER.format(millions)} millones de consultas.`,
      reference: `Ese volumen muestra que una infraestructura digital pública puede ser utilizada a gran escala. Ojo: el último dato oficial es de ${observedYear}, así que no describe el uso actual del servicio.`,
      isEstimate: false,
    }
  }

  return {
    summary: `${signal.title}: ${NUMBER.format(signal.value)} ${signal.unit}.`,
    reference: null,
    isEstimate: false,
  }
}
