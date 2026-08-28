import { pointInFeatureCollection } from './geo.mjs'

const VIEW_BOUNDS = {
  minLongitude: -73.7,
  minLatitude: -55.3,
  maxLongitude: -53.5,
  maxLatitude: -21.7,
}

function snapUp(value, spacing) {
  return Math.ceil(value / spacing) * spacing
}

function snapDown(value, spacing) {
  return Math.floor(value / spacing) * spacing
}

export function generateWeatherGrid(argentinaGeometry, spacingDegrees = 0.5) {
  if (!Number.isFinite(spacingDegrees) || spacingDegrees <= 0) {
    throw new Error('weather grid spacing must be a positive finite number')
  }

  const points = []
  const minLatitude = snapUp(VIEW_BOUNDS.minLatitude, spacingDegrees)
  const maxLatitude = snapDown(VIEW_BOUNDS.maxLatitude, spacingDegrees)
  const minLongitude = snapUp(VIEW_BOUNDS.minLongitude, spacingDegrees)
  const maxLongitude = snapDown(VIEW_BOUNDS.maxLongitude, spacingDegrees)

  for (let latitudeCursor = minLatitude; latitudeCursor <= maxLatitude + 1e-9; latitudeCursor += spacingDegrees) {
    for (
      let longitudeCursor = minLongitude;
      longitudeCursor <= maxLongitude + 1e-9;
      longitudeCursor += spacingDegrees
    ) {
      const latitude = Number(latitudeCursor.toFixed(6))
      const longitude = Number(longitudeCursor.toFixed(6))

      if (!pointInFeatureCollection([longitude, latitude], argentinaGeometry)) continue

      points.push({
        id: `wx:${latitude.toFixed(2)}:${longitude.toFixed(2)}`,
        latitude,
        longitude,
      })
    }
  }

  return points.sort(
    (left, right) => left.latitude - right.latitude || left.longitude - right.longitude,
  )
}
