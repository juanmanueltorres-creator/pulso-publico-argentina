import locations from '../data/marineLocations.json'
import type { MarineSnapshot } from '../types/marine'

/** Stable synthetic fixture: never import mutable public/data/marine.json in tests expecting missing data. */
export function marineSnapshotFixture(): MarineSnapshot {
  return {
    schemaVersion: '1.0',
    sourceCheckedAt: null,
    source: {
      provider: 'Open-Meteo',
      dataset: 'Marine Weather API · selección automática de modelos oceánicos',
      url: 'https://open-meteo.com/en/docs/marine-weather-api',
      kind: 'numerical-ocean-model',
    },
    limitations: ['Pronóstico modelado; no usar para navegación.'],
    points: locations.map((location) => ({
      id: location.id,
      name: location.name,
      region: location.region,
      queryCoordinate: { latitude: location.latitude, longitude: location.longitude },
      providerCoordinate: null,
      validAt: null,
      values: {
        waveHeightM: null,
        waveDirectionDeg: null,
        wavePeriodS: null,
        currentVelocityKmh: null,
        currentDirectionDeg: null,
        seaSurfaceTemperatureC: null,
      },
    })),
  }
}
