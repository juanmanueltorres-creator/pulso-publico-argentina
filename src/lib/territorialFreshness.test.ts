import { describe, expect, it } from 'vitest'
import type { EarthquakeEvent, TerritorialSnapshot } from '../types/territorial'
import { territorialAvailability } from './territorialFreshness'

const earthquakeSnapshot = {
  schemaVersion: '1.0',
  kind: 'earthquake',
  generatedAt: '2026-08-28T04:00:00.000Z',
  sourceCheckedAt: '2026-08-28T04:00:00.000Z',
  window: { hours: 168 },
  freshness: { staleAfterMinutes: 240 },
  source: {
    name: 'INPRES',
    url: 'https://www.inpres.gob.ar/sismos_consultados',
    kind: 'official',
  },
  method: { type: 'scrape', note: 'Tabla oficial de sismos recientes.' },
  limitations: [],
  events: [],
} satisfies TerritorialSnapshot<EarthquakeEvent>

describe('territorialAvailability', () => {
  it('becomes stale exactly at the declared threshold', () => {
    expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T07:59:59Z'))).toBe(
      'available',
    )
    expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T08:00:00Z'))).toBe(
      'stale',
    )
  })
})
