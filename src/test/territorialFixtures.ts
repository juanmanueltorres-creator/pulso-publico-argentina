import type { EarthquakeEvent, ThermalHotspotEvent } from '../types/territorial'

export const earthquakeEvent: EarthquakeEvent = {
  id: 'eq-1',
  kind: 'earthquake',
  occurredAt: '2026-08-28T10:15:00Z',
  latitude: -31.4,
  longitude: -68.6,
  magnitude: 4.6,
  depthKm: 87,
  place: 'San Juan',
  province: 'San Juan',
  intensityText: null,
}

export const earthquakeEvent2: EarthquakeEvent = {
  id: 'eq-2',
  kind: 'earthquake',
  occurredAt: '2026-08-27T21:05:00Z',
  latitude: -32.9,
  longitude: -69.1,
  magnitude: 3.2,
  depthKm: 18,
  place: 'Mendoza',
  province: 'Mendoza',
  intensityText: null,
}

export const hotspotEvent: ThermalHotspotEvent = {
  id: 'hot-1',
  kind: 'thermal-hotspot',
  occurredAt: '2026-08-28T14:32:00Z',
  latitude: -27.45,
  longitude: -58.92,
  confidence: 'nominal',
  frpMw: 46,
  sensor: 'VIIRS',
  satellite: 'NOAA-20',
}

export const hotspotEventHigh: ThermalHotspotEvent = {
  id: 'hot-2',
  kind: 'thermal-hotspot',
  occurredAt: '2026-08-28T15:02:00Z',
  latitude: -24.8,
  longitude: -65.4,
  confidence: 'high',
  frpMw: 81.4,
  sensor: 'VIIRS',
  satellite: 'Suomi NPP',
}

export const hotspotEventLow: ThermalHotspotEvent = {
  id: 'hot-3',
  kind: 'thermal-hotspot',
  occurredAt: '2026-08-28T12:18:00Z',
  latitude: -30.2,
  longitude: -61.1,
  confidence: 'low',
  frpMw: 7.2,
  sensor: 'VIIRS',
  satellite: 'NOAA-20',
}

export const earthquakeEvents = [earthquakeEvent, earthquakeEvent2]
export const hotspotEvents = [hotspotEvent, hotspotEventHigh, hotspotEventLow]
