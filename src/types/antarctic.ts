export type AntarcticVariable = 'temperature' | 'wind' | 'clouds'

export interface AntarcticPoint {
  id: string
  name: string
  site: string
  queryCoordinate: { latitude: number; longitude: number }
  providerCoordinate: { latitude: number; longitude: number } | null
  validAt: string | null
  values: {
    temperatureC: number | null
    windSpeedKmh: number | null
    windDirectionDeg: number | null
    cloudCoverPct: number | null
  }
}
export interface AntarcticSnapshot {
  schemaVersion: '1.0'
  sourceCheckedAt: string | null
  source: {
    provider: 'Open-Meteo'
    dataset: string
    url: string
    kind: 'numerical-weather-model'
  }
  locationSource: { provider: string; url: string }
  limitations: string[]
  points: AntarcticPoint[]
}
