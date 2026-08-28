import type { BaseTerritorialEvent, EarthquakeEvent, ThermalHotspotEvent } from '../types/territorial'

export function earthquakeRadius(magnitude: number): number {
  return Math.max(3, Math.min(18, 2 + magnitude * 2))
}

function displayProperties(event: BaseTerritorialEvent): Record<string, string | number | null> {
  if (event.kind === 'earthquake') {
    const earthquake = event as EarthquakeEvent
    return {
      id: earthquake.id,
      kind: earthquake.kind,
      occurredAt: earthquake.occurredAt,
      magnitude: earthquake.magnitude,
      depthKm: earthquake.depthKm,
      place: earthquake.place,
      province: earthquake.province,
      intensityText: earthquake.intensityText,
    }
  }

  const hotspot = event as ThermalHotspotEvent
  return {
    id: hotspot.id,
    kind: hotspot.kind,
    occurredAt: hotspot.occurredAt,
    confidence: hotspot.confidence,
    frpMw: hotspot.frpMw,
    sensor: hotspot.sensor,
    satellite: hotspot.satellite,
  }
}

export function eventsToFeatureCollection(events: BaseTerritorialEvent[]): object {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: {
        type: 'Point',
        coordinates: [event.longitude, event.latitude],
      },
      properties: displayProperties(event),
    })),
  }
}
