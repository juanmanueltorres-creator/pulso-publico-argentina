export type MarineVariable = 'waves' | 'currents' | 'temperature'

export interface MarinePoint {
  id: string
  name: string
  region: string
  queryCoordinate: { latitude: number; longitude: number }
  providerCoordinate: { latitude: number; longitude: number } | null
  validAt: string | null
  values: {
    waveHeightM: number | null
    waveDirectionDeg: number | null
    wavePeriodS: number | null
    currentVelocityKmh: number | null
    currentDirectionDeg: number | null
    seaSurfaceTemperatureC: number | null
  }
}

export interface MarineSnapshot {
  schemaVersion: '1.0'
  sourceCheckedAt: string | null
  source: {
    provider: 'Open-Meteo'
    dataset: string
    url: string
    kind: 'numerical-ocean-model'
  }
  limitations: string[]
  points: MarinePoint[]
}
