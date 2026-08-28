import { createHash } from 'node:crypto'

function propertyIndex(properties) {
  return new Map(
    Object.entries(properties ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  )
}

function propertyValue(index, candidates) {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase()
    if (index.has(key)) return index.get(key)
  }
  return undefined
}

function normalizedText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

export function normalizeHotspotConfidence(raw) {
  if (raw === 7 || raw === '7') return 'low'
  if (raw === 8 || raw === '8') return 'nominal'
  if (raw === 9 || raw === '9') return 'high'

  const text = normalizedText(raw)?.toLowerCase()
  if (!text) return 'unknown'

  if (['low', 'baja', 'bajo'].includes(text)) return 'low'
  if (['nominal', 'media', 'medio', 'medium'].includes(text)) return 'nominal'
  if (['high', 'alta', 'alto'].includes(text)) return 'high'

  return 'unknown'
}

function parseSeparateTimestamp(dateValue, timeValue) {
  const dateText = normalizedText(dateValue)
  const timeText = normalizedText(timeValue)
  if (!dateText || !timeText) return null

  let year
  let month
  let day

  let match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    ;[, year, month, day] = match
  } else {
    match = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return null
    ;[, day, month, year] = match
  }

  const timeMatch = timeText.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!timeMatch) return null

  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const second = Number(timeMatch[3] ?? '0')
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)

  if (
    monthNumber < 1 || monthNumber > 12 ||
    dayNumber < 1 || dayNumber > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) {
    return null
  }

  const timestamp = new Date(
    Date.UTC(yearNumber, monthNumber - 1, dayNumber, hour, minute, second),
  )

  if (
    timestamp.getUTCFullYear() !== yearNumber ||
    timestamp.getUTCMonth() !== monthNumber - 1 ||
    timestamp.getUTCDate() !== dayNumber
  ) {
    return null
  }

  return timestamp.toISOString()
}

function parseAcquisitionTimestamp(index) {
  const combined = normalizedText(
    propertyValue(index, ['FechaHora', 'fecha_hora', 'datetime', 'timestamp']),
  )

  if (combined) {
    const parsed = Date.parse(combined)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
    throw new Error(`CONAE hotspot has an invalid acquisition timestamp: ${combined}`)
  }

  const separate = parseSeparateTimestamp(
    propertyValue(index, ['Fecha', 'fecha', 'acq_date']),
    propertyValue(index, ['Hora', 'hora', 'acq_time']),
  )

  if (!separate) {
    throw new Error('CONAE hotspot is missing a valid acquisition timestamp')
  }

  return separate
}

function parseOptionalNumber(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error(`CONAE hotspot ${label} must be numeric when present`)
  }
  return number
}

function fallbackHotspotId(event) {
  const key = [event.occurredAt, event.latitude, event.longitude, event.frpMw ?? '', event.satellite ?? ''].join('|')
  return `conae-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}

export function parseConaeHotspots(featureCollection) {
  if (featureCollection?.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
    throw new Error('CONAE response must be a GeoJSON FeatureCollection')
  }

  return featureCollection.features.map((feature) => {
    if (feature?.geometry?.type !== 'Point') {
      throw new Error('CONAE hotspot geometry must be Point')
    }

    const [longitude, latitude] = feature.geometry.coordinates ?? []
    if (
      !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
    ) {
      throw new Error('CONAE hotspot Point coordinates must be valid longitude/latitude values')
    }

    const index = propertyIndex(feature.properties)
    const event = {
      id: '',
      kind: 'thermal-hotspot',
      occurredAt: parseAcquisitionTimestamp(index),
      latitude,
      longitude,
      confidence: normalizeHotspotConfidence(
        propertyValue(index, ['FP_Confidence', 'confidence']),
      ),
      frpMw: parseOptionalNumber(
        propertyValue(index, ['FP_Power', 'frp', 'FRP']),
        'FRP',
      ),
      sensor: normalizedText(
        propertyValue(index, ['Instrumento', 'instrument', 'sensor']),
      ),
      satellite: normalizedText(
        propertyValue(index, ['Satelite', 'satellite']),
      ),
    }

    event.id = normalizedText(feature.id) ?? fallbackHotspotId(event)
    return event
  })
}
