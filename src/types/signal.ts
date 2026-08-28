export type SignalCategory =
  | 'energy'
  | 'science'
  | 'innovation'
  | 'public-infrastructure'

export type SignalStatus = 'live' | 'updated' | 'estimated' | 'historical'

export type SignalAvailability = 'available' | 'stale' | 'unavailable'

export type SignalSourceKind = 'official' | 'open-index'

export type SignalMethodType = 'api' | 'csv' | 'scrape' | 'calculation'

export interface SignalEnvelope {
  schemaVersion: '1.0'
  id: string
  category: SignalCategory
  title: string
  value: number | null
  unit: string
  periodLabel: string
  status: SignalStatus
  availability: SignalAvailability
  observedAt: string | null
  publishedAt: string | null
  fetchedAt: string
  source: {
    name: string
    url: string
    kind: SignalSourceKind
  }
  method: {
    type: SignalMethodType
    note: string
  }
  limitations: string[]
}

export interface SignalSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  signals: SignalEnvelope[]
}
