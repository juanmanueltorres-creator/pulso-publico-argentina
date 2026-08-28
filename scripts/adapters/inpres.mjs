import { createHash } from 'node:crypto'
import { load } from 'cheerio'

const REQUIRED_HEADINGS = [
  'fecha y hora',
  'latitud',
  'longitud',
  'prof',
  'magn',
  'intensidad',
  'provincia',
]

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeHeading(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.:]+$/g, '')
}

function parseFiniteNumber(value, label, { nullable = false } = {}) {
  const text = normalizeText(value)
  if (nullable && text === '') return null
  const number = Number(text.replace(',', '.'))
  if (!Number.isFinite(number)) {
    throw new Error(`INPRES ${label} must be a finite number`)
  }
  return number
}

function formatLocalDate(year, month, day, hour, minute, second) {
  const parts = [year, month, day, hour, minute, second]
  if (parts.some((part) => !Number.isInteger(part))) {
    throw new Error('INPRES date contains non-integer parts')
  }

  const utcProbe = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (
    utcProbe.getUTCFullYear() !== year ||
    utcProbe.getUTCMonth() + 1 !== month ||
    utcProbe.getUTCDate() !== day ||
    utcProbe.getUTCHours() !== hour ||
    utcProbe.getUTCMinutes() !== minute ||
    utcProbe.getUTCSeconds() !== second
  ) {
    throw new Error('INPRES date is outside valid calendar ranges')
  }

  const pad = (value) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}-03:00`
}

export function parseInpresLocalDate(value) {
  const text = normalizeText(value)

  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match
    return formatLocalDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )
  }

  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    const [, day, month, year, hour, minute, second = '00'] = match
    return formatLocalDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )
  }

  throw new Error(`Unsupported INPRES local date: ${text || '(empty)'}`)
}

function earthquakeId(event) {
  const key = [
    event.occurredAt,
    event.latitude,
    event.longitude,
    event.depthKm ?? '',
    event.magnitude,
  ].join('|')
  return `inpres-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}

function findEarthquakeTable($) {
  let matched = null

  $('table').each((_, table) => {
    if (matched) return

    const headings = $(table)
      .find('thead tr')
      .first()
      .find('th')
      .toArray()
      .map((heading) => normalizeHeading($(heading).text()))

    if (headings.length === 0) return
    const complete = REQUIRED_HEADINGS.every((required) => headings.includes(required))
    if (complete) matched = { table, headings }
  })

  if (!matched) {
    throw new Error(`INPRES required heading set not found: ${REQUIRED_HEADINGS.join(', ')}`)
  }

  return matched
}

export function parseInpresEarthquakes(html) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('INPRES HTML must be a non-empty string')
  }

  const $ = load(html)
  const { table, headings } = findEarthquakeTable($)
  const index = Object.fromEntries(headings.map((heading, columnIndex) => [heading, columnIndex]))
  const events = []

  $(table)
    .find('tbody tr')
    .each((_, row) => {
      const cells = $(row)
        .find('td')
        .toArray()
        .map((cell) => normalizeText($(cell).text()))

      if (cells.length === 0) return
      if (cells.length < headings.length) {
        throw new Error('INPRES earthquake row has fewer cells than required headings')
      }

      const occurredAt = parseInpresLocalDate(cells[index['fecha y hora']])
      const latitude = parseFiniteNumber(cells[index.latitud], 'latitude')
      const longitude = parseFiniteNumber(cells[index.longitud], 'longitude')
      const depthKm = parseFiniteNumber(cells[index.prof], 'depth', { nullable: true })
      const magnitude = parseFiniteNumber(cells[index.magn], 'magnitude')
      const intensityText = normalizeText(cells[index.intensidad]) || null
      const province = normalizeText(cells[index.provincia]) || null

      const event = {
        id: '',
        kind: 'earthquake',
        occurredAt,
        latitude,
        longitude,
        magnitude,
        depthKm,
        place: null,
        province,
        intensityText,
      }
      event.id = earthquakeId(event)
      events.push(event)
    })

  return events
}
