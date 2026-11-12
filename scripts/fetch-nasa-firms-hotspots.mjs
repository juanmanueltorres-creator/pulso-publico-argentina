import { createHash } from 'node:crypto'

// Public near-real-time VIIRS NOAA-20 regional CSV, available without a MAP_KEY.
// NASA FIRMS is a distinct provider and must not be labelled as CONAE.
export const NASA_FIRMS_NOAA20_URL =
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv'

const REQUIRED_FIELDS = [
  'latitude', 'longitude', 'acq_date', 'acq_time',
  'satellite', 'confidence', 'frp',
]
const BOUNDS = { south: -55.2, north: -21.7, west: -73.7, east: -53.5 }
const MAX_CSV_BYTES = 15 * 1024 * 1024

function parseAcquisitionUtc(date, time) {
  const timeText = String(time).trim().padStart(4, '0')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}$/.test(timeText)) {
    throw new Error('NASA FIRMS CSV contains invalid acquisition date/time')
  }
  const timestamp = new Date(date + 'T' + timeText.slice(0, 2) + ':' +
    timeText.slice(2) + ':00.000Z')
  if (!Number.isFinite(timestamp.getTime()) ||
      timestamp.toISOString().slice(0, 10) !== date ||
      timestamp.getUTCHours() !== Number(timeText.slice(0, 2)) ||
      timestamp.getUTCMinutes() !== Number(timeText.slice(2))) {
    throw new Error('NASA FIRMS CSV contains invalid acquisition timestamp')
  }
  return timestamp.toISOString()
}

function parseConfidence(text) {
  const value = text.trim().toLowerCase()
  if (value === 'h' || value === 'high') return 'high'
  if (value === 'n' || value === 'nominal') return 'nominal'
  if (value === 'l' || value === 'low') return 'low'
  if (value === '') return 'unknown'
  throw new Error('Unexpected NASA FIRMS VIIRS confidence category: ' + value)
}

export function parseNasaFirmsNoaa20Csv(csv, checkedAt = new Date().toISOString()) {
  if (typeof csv !== 'string' || !csv.trim() ||
      Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    throw new Error('NASA FIRMS CSV must be nonempty and within size limit')
  }
  const checkedAtMs = Date.parse(checkedAt)
  if (!Number.isFinite(checkedAtMs)) throw new Error('checkedAt must be valid')

  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const columns = lines[0].split(',').map((column) => column.trim().toLowerCase())
  const indices = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, columns.indexOf(field)]))
  if (Object.values(indices).some((index) => index < 0)) {
    throw new Error('NASA FIRMS CSV missing required VIIRS fields')
  }
  if (lines.length < 2) {
    throw new Error('NASA FIRMS NOAA-20 CSV contains no regional detections; cannot verify coverage')
  }
  let latest = Number.NEGATIVE_INFINITY
  const events = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = lines[i].split(',')
    if (values.length !== columns.length) {
      throw new Error('NASA FIRMS CSV row ' + (i + 1) + ' has unexpected column count')
    }
    const pick = (name) => values[indices[name]].trim()
    const latitude = Number(pick('latitude'))
    const longitude = Number(pick('longitude'))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('NASA FIRMS CSV row ' + (i + 1) + ' has invalid coordinates')
    }
    if (!['N20', 'NOAA20', 'NOAA-20'].includes(pick('satellite'))) {
      throw new Error('NASA FIRMS CSV row ' + (i + 1) + ' has unexpected satellite')
    }
    const occurredAt = parseAcquisitionUtc(pick('acq_date'), pick('acq_time'))
    const ms = Date.parse(occurredAt)
    latest = Math.max(latest, ms)
    if (ms > checkedAtMs + 5 * 60_000) {
      throw new Error('NASA FIRMS CSV contains future detections')
    }
    if (latitude < BOUNDS.south || latitude > BOUNDS.north ||
        longitude < BOUNDS.west || longitude > BOUNDS.east) continue

    const confidence = parseConfidence(pick('confidence'))
    const frpText = pick('frp')
    const frpMw = frpText === '' ? null : Number(frpText)
    if (frpMw !== null && (!Number.isFinite(frpMw) || frpMw < 0)) {
      throw new Error('NASA FIRMS CSV row ' + (i + 1) + ' has invalid FRP')
    }
    const key = [occurredAt, latitude, longitude, 'NOAA20'].join('|')
    events.push({
      id: 'nasa-firms-' + createHash('sha256').update(key).digest('hex').slice(0, 16),
      kind: 'thermal-hotspot',
      occurredAt,
      latitude,
      longitude,
      confidence,
      frpMw,
      sensor: 'VIIRS',
      satellite: 'NOAA20',
    })
  }
  if (latest < checkedAtMs - 24 * 60 * 60_000) {
    throw new Error('NASA FIRMS NOAA-20 file is stale: no observations in the last 24 hours')
  }
  const deduped = new Map(events.map((event) => [event.id, event]))
  return [...deduped.values()].sort(
    (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
  )
}

export async function fetchNasaFirmsNoaa20Hotspots(
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
) {
  const response = await fetchImpl(NASA_FIRMS_NOAA20_URL, {
    headers: { accept: 'text/csv,text/plain,*/*' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!response?.ok) {
    throw new Error('NASA FIRMS NOAA-20 CSV request failed: HTTP ' + (response?.status ?? 'unknown'))
  }
  const reportedSize = Number(response.headers?.get?.('content-length') ?? '0')
  if (Number.isFinite(reportedSize) && reportedSize > MAX_CSV_BYTES) {
    throw new Error('NASA FIRMS NOAA-20 CSV exceeds size limit')
  }
  return parseNasaFirmsNoaa20Csv(await response.text(), checkedAt)
}
