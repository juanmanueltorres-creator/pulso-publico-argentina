import type { MarineSnapshot, MarineVariable } from '../types/marine'
import { marineNumericValue } from './loadMarineSnapshot'

export function marinePointsToFeatureCollection(
  snapshot: MarineSnapshot | null,
  variable: MarineVariable,
  selectedId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: (snapshot?.points ?? []).map((point) => {
      const value = marineNumericValue(point, variable)
      const label = value === null ? '' : variable === 'waves'
        ? `${value.toFixed(1)} m`
        : variable === 'currents' ? `${value.toFixed(1)} km/h`
          : `${value.toFixed(1)} °C`
      return {
        type: 'Feature' as const,
        id: point.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [point.queryCoordinate.longitude, point.queryCoordinate.latitude],
        },
        properties: {
          id: point.id,
          label,
          value,
          selected: point.id === selectedId,
          available: value !== null,
          variable,
        },
      }
    }),
  }
}
