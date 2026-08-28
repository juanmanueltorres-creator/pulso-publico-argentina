import type { TerritorialKind } from './territorial'

export type TerritorialViewMode = TerritorialKind | 'weather'
export type WeatherVariable = 'temperature' | 'wind' | 'humidity'

export interface WeatherSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  sourceCheckedAt: string
  dataThrough: string
  window: {
    hours: 24
    stepHours: 1
  }
  freshness: {
    staleAfterMinutes: number
  }
  grid: {
    spacingDegrees: 0.5
    pointCount: number
  }
  timestamps: string[]
  source: {
    provider: string
    dataset: string
    url: string
    kind: 'numerical-weather-model'
    license: string
  }
  method: {
    type: 'historical-forecast-grid'
    temporalResolutionMinutes: 60
    note: string
  }
  limitations: string[]
  points: WeatherPoint[]
}

export interface WeatherPoint {
  id: string
  queryCoordinate: {
    latitude: number
    longitude: number
  }
  providerCoordinate: {
    latitude: number
    longitude: number
  } | null
  values: {
    temperatureC: Array<number | null>
    relativeHumidityPct: Array<number | null>
    windSpeedKmh: Array<number | null>
    windDirectionDeg: Array<number | null>
    windGustKmh: Array<number | null>
    precipitationMm: Array<number | null>
  }
}
