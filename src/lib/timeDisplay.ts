import {
  formatTemporal,
  normalizeDate,
  normalizeInstant,
  type TemporalRole,
} from '@juanmanueltorres/geo-temporal-contract'

export const ARG_TIME_ZONE = 'America/Argentina/Buenos_Aires'
export const ARG_TIME_LABEL = 'hora ARG'

export function formatArgInstant(value: string, role: TemporalRole): string {
  try {
    const temporal = normalizeInstant(value, {
      role,
      sourceTimeZone: null,
      timeZoneBasis: 'unknown',
      displayTimeZone: ARG_TIME_ZONE,
    })

    return formatTemporal(temporal, {
      locale: 'es-AR',
      timeZone: ARG_TIME_ZONE,
      timeZoneLabel: ARG_TIME_LABEL,
      hour12: false,
    })
  } catch {
    return value
  }
}

export function formatCalendarDate(value: string, role: TemporalRole): string {
  const canonicalDate = value.slice(0, 10)

  try {
    const temporal = normalizeDate(canonicalDate, {
      role,
      sourceValue: value,
    })
    return formatTemporal(temporal, { locale: 'es-AR' })
  } catch {
    return value
  }
}
