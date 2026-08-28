export type TerritorialKind = 'earthquake' | 'thermal-hotspot'

export type HotspotConfidence = 'low' | 'nominal' | 'high' | 'unknown'

export interface BaseTerritorialEvent {
  id: string
  kind: TerritorialKind
  occurredAt: string
  latitude: number
  longitude: number
}

export interface EarthquakeEvent extends BaseTerritorialEvent {
  kind: 'earthquake'
  magnitude: number
  depthKm: number | null
  place: string | null
  province: string | null
  intensityText: string | null
}

export interface ThermalHotspotEvent extends BaseTerritorialEvent {
  kind: 'thermal-hotspot'
  confidence: HotspotConfidence
  frpMw: number | null
  sensor: string | null
  satellite: string | null
}

export interface TerritorialSnapshot<TEvent extends BaseTerritorialEvent> {
  schemaVersion: '1.0'
  kind: TerritorialKind
  generatedAt: string
  sourceCheckedAt: string
  window: {
    hours: number
  }
  freshness: {
    staleAfterMinutes: number
  }
  source: {
    name: string
    url: string
    kind: 'official'
  }
  method: {
    type: 'scrape' | 'wfs'
    note: string
  }
  limitations: string[]
  events: TEvent[]
}
