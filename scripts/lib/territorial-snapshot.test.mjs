import { describe, expect, it } from 'vitest'
import { prepareTerritorialPublication, territorialPayloadEqual } from './territorial-snapshot.mjs'

const previous = {
  schemaVersion: '1.0',
  kind: 'earthquake',
  generatedAt: '2026-08-28T04:00:00Z',
  sourceCheckedAt: '2026-08-28T04:00:00Z',
  window: { hours: 168 },
  freshness: { staleAfterMinutes: 240 },
  source: { name: 'INPRES', url: 'https://www.inpres.gob.ar/sismos_consultados', kind: 'official' },
  method: { type: 'scrape', note: 'Eventos recientes publicados por INPRES.' },
  limitations: ['El impacto no se deduce sólo de magnitud y profundidad.'],
  events: [
    {
      id: 'eq-1',
      kind: 'earthquake',
      occurredAt: '2026-08-28T01:15:30-03:00',
      latitude: -31.4,
      longitude: -68.6,
      magnitude: 4.2,
      depthKm: 86,
      place: null,
      province: 'San Juan',
      intensityText: 'II a III',
    },
  ],
}

const newEvent = {
  id: 'eq-2',
  kind: 'earthquake',
  occurredAt: '2026-08-28T01:45:00-03:00',
  latitude: -32.1,
  longitude: -68.9,
  magnitude: 2.8,
  depthKm: 20,
  place: null,
  province: 'Mendoza',
  intensityText: null,
}

describe('territorial publication rules', () => {
  it('ignores generated/source-check timestamps when comparing semantic payloads', () => {
    const touched = {
      ...previous,
      generatedAt: '2026-08-28T05:00:00Z',
      sourceCheckedAt: '2026-08-28T05:00:00Z',
    }

    expect(territorialPayloadEqual(previous, touched)).toBe(true)
  })

  it('publishes material event changes immediately', () => {
    const result = prepareTerritorialPublication(
      previous,
      { ...previous, events: [newEvent] },
      '2026-08-28T05:00:00Z',
    )

    expect(result.publish).toBe(true)
    expect(result.snapshot.generatedAt).toBe('2026-08-28T05:00:00Z')
    expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T05:00:00Z')
    expect(result.snapshot.events).toEqual([newEvent])
  })

  it('suppresses an unchanged hourly timestamp-only write', () => {
    const result = prepareTerritorialPublication(previous, previous, '2026-08-28T05:00:00Z')

    expect(result.publish).toBe(false)
    expect(result.snapshot).toEqual(previous)
  })

  it('publishes the freshness heartbeat exactly at 180 minutes', () => {
    const result = prepareTerritorialPublication(previous, previous, '2026-08-28T07:00:00Z')

    expect(result.publish).toBe(true)
    expect(result.snapshot.generatedAt).toBe('2026-08-28T07:00:00Z')
    expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T07:00:00Z')
  })
})
