import type {
  EarthquakeEvent,
  TerritorialKind,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import { validateTerritorialSnapshot } from './validateTerritorialSnapshot'

const FILE_BY_KIND = {
  earthquake: 'earthquakes.json',
  'thermal-hotspot': 'hotspots.json',
} as const

function snapshotUrl(baseUrl: string, kind: TerritorialKind): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}data/${FILE_BY_KIND[kind]}`
}

export function loadTerritorialSnapshot(
  kind: 'earthquake',
  fetcher?: typeof fetch,
  baseUrl?: string,
): Promise<TerritorialSnapshot<EarthquakeEvent>>
export function loadTerritorialSnapshot(
  kind: 'thermal-hotspot',
  fetcher?: typeof fetch,
  baseUrl?: string,
): Promise<TerritorialSnapshot<ThermalHotspotEvent>>
export async function loadTerritorialSnapshot(
  kind: TerritorialKind,
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<TerritorialSnapshot<EarthquakeEvent> | TerritorialSnapshot<ThermalHotspotEvent>> {
  const response = await fetcher(snapshotUrl(baseUrl, kind), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load ${kind} snapshot: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return kind === 'earthquake'
    ? validateTerritorialSnapshot(payload, 'earthquake')
    : validateTerritorialSnapshot(payload, 'thermal-hotspot')
}
