import bases from '../data/antarcticBases.json'
import type { AntarcticSnapshot } from '../types/antarctic'

/** Stable synthetic fixture, intentionally independent from the live published snapshot. */
export function antarcticSnapshotFixture(): AntarcticSnapshot {
  return {
    schemaVersion: '1.0',
    sourceCheckedAt: null,
    source: {
      provider: 'Open-Meteo',
      dataset: 'ECMWF IFS 0.25° · pronóstico meteorológico global',
      url: 'https://open-meteo.com/en/docs/ecmwf-api',
      kind: 'numerical-weather-model',
    },
    locationSource: {
      provider: 'IGN / Dirección Nacional del Antártico',
      url: 'https://www.ign.gob.ar/NuestrasActividades/Geografia/DatosArgentina/BasesAntartida',
    },
    limitations: ['No son observaciones de estaciones.'],
    points: bases.map((base) => ({
      id: base.id, name: base.name, site: base.site,
      queryCoordinate: { latitude: base.latitude, longitude: base.longitude },
      providerCoordinate: null, validAt: null,
      values: {
        temperatureC: null, windSpeedKmh: null, windDirectionDeg: null, cloudCoverPct: null,
      },
    })),
  }
}
