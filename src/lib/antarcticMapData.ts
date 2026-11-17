import { antarcticNumericValue } from './loadAntarcticSnapshot'
import type { AntarcticSnapshot, AntarcticVariable } from '../types/antarctic'

export function antarcticPointsToFeatureCollection(
  snapshot: AntarcticSnapshot | null,
  variable: AntarcticVariable,
  selectedId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: (snapshot?.points ?? []).map((point) => {
      const value = antarcticNumericValue(point, variable)
      const label = value === null ? '' : variable === 'temperature'
        ? `${Math.round(value)}°`
        : variable === 'wind' ? `${Math.round(value)} km/h`
          : `${Math.round(value)}%`
      return {
        type: 'Feature' as const,
        id: point.id,
        geometry: { type: 'Point' as const,
          coordinates: [point.queryCoordinate.longitude, point.queryCoordinate.latitude] },
        properties: {
          id: point.id, name: point.name, label, value,
          available: value !== null, selected: point.id === selectedId, variable,
        },
      }
    }),
  }
}
