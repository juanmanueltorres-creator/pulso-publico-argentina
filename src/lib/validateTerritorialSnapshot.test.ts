import { describe, expect, it } from 'vitest'
import type {
  EarthquakeEvent,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import { validateTerritorialSnapshot } from './validateTerritorialSnapshot'

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
  limitations: ['Epicentros dentro del límite nacional usado por Pulso Público.'],
  events: [
    {
      id: 'eq-1',
      kind: 'earthquake',
      occurredAt: '2026-08-28T00:15:00-03:00',
      latitude: -31.4,
      longitude: -68.6,
      magnitude: 4.2,
      depthKm: 86,
      place: null,
      province: 'San Juan',
      intensityText: 'II a III',
    },
  ],
} satisfies TerritorialSnapshot<EarthquakeEvent>

const hotspotSnapshot = {
  schemaVersion: '1.0',
  kind: 'thermal-hotspot',
  generatedAt: '2026-08-28T04:00:00.000Z',
  sourceCheckedAt: '2026-08-28T04:00:00.000Z',
  window: { hours: 24 },
  freshness: { staleAfterMinutes: 240 },
  source: {
    name: 'CONAE',
    url: 'https://catalogos.conae.gov.ar/catalogo/catalogoGeoServiciosOGC.html',
    kind: 'official',
  },
  method: { type: 'wfs', note: 'VIIRS 24 h.' },
  limitations: ['Una anomalía térmica no implica un incendio confirmado.'],
  events: [
    {
      id: 'hot-1',
      kind: 'thermal-hotspot',
      occurredAt: '2026-08-28T03:10:00Z',
      latitude: -30.1,
      longitude: -62.2,
      confidence: 'high',
      frpMw: 18.5,
      sensor: 'VIIRS',
      satellite: 'NOAA20',
    },
  ],
} satisfies TerritorialSnapshot<ThermalHotspotEvent>

describe('validateTerritorialSnapshot', () => {
  it('accepts both approved territorial event contracts', () => {
    const earthquake = validateTerritorialSnapshot(earthquakeSnapshot, 'earthquake')
    const hotspot = validateTerritorialSnapshot(hotspotSnapshot, 'thermal-hotspot')

    expect(earthquake.events[0].magnitude).toBe(4.2)
    expect(hotspot.events[0].confidence).toBe('high')
  })

  it('rejects impossible coordinates, invalid confidence and kind mismatches', () => {
    expect(() =>
      validateTerritorialSnapshot(
        {
          ...earthquakeSnapshot,
          events: [{ ...earthquakeSnapshot.events[0], latitude: -95 }],
        },
        'earthquake',
      ),
    ).toThrow(/latitude/i)

    expect(() =>
      validateTerritorialSnapshot(
        {
          ...hotspotSnapshot,
          events: [{ ...hotspotSnapshot.events[0], confidence: 'critical' }],
        },
        'thermal-hotspot',
      ),
    ).toThrow(/confidence/i)

    expect(() => validateTerritorialSnapshot(earthquakeSnapshot, 'thermal-hotspot')).toThrow(
      /kind/i,
    )
  })

  it('rejects invalid event and snapshot timestamps', () => {
    expect(() =>
      validateTerritorialSnapshot(
        { ...earthquakeSnapshot, sourceCheckedAt: 'yesterday' },
        'earthquake',
      ),
    ).toThrow(/sourceCheckedAt/i)

    expect(() =>
      validateTerritorialSnapshot(
        {
          ...earthquakeSnapshot,
          events: [{ ...earthquakeSnapshot.events[0], occurredAt: 'unknown' }],
        },
        'earthquake',
      ),
    ).toThrow(/occurredAt/i)
  })

  it('rejects invalid numeric event fields and unsupported windows', () => {
    expect(() =>
      validateTerritorialSnapshot(
        {
          ...earthquakeSnapshot,
          window: { hours: 24 },
        },
        'earthquake',
      ),
    ).toThrow(/window/i)

    expect(() =>
      validateTerritorialSnapshot(
        {
          ...hotspotSnapshot,
          events: [{ ...hotspotSnapshot.events[0], frpMw: Number.POSITIVE_INFINITY }],
        },
        'thermal-hotspot',
      ),
    ).toThrow(/frp/i)
  })
})
