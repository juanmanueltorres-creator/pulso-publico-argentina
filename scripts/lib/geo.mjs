function isCoordinatePair(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  )
}

function validateRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || ring.some((point) => !isCoordinatePair(point))) {
    throw new Error('geometry ring must contain at least four finite coordinate pairs')
  }
}

function validatePolygonCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('Polygon geometry must contain rings')
  }
  coordinates.forEach(validateRing)
}

function validateGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    throw new Error('feature geometry must be a Polygon or MultiPolygon')
  }

  if (geometry.type === 'Polygon') {
    validatePolygonCoordinates(geometry.coordinates)
    return
  }

  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error('MultiPolygon geometry must contain polygons')
    }
    geometry.coordinates.forEach(validatePolygonCoordinates)
    return
  }

  throw new Error(`unsupported geometry type: ${String(geometry.type)}`)
}

export function validateArgentinaFeatureCollection(input) {
  if (!input || typeof input !== 'object' || input.type !== 'FeatureCollection') {
    throw new Error('Argentina geometry must be a GeoJSON FeatureCollection')
  }
  if (!Array.isArray(input.features) || input.features.length === 0) {
    throw new Error('Argentina FeatureCollection must contain features')
  }

  for (const feature of input.features) {
    if (!feature || typeof feature !== 'object' || feature.type !== 'Feature') {
      throw new Error('every Argentina geometry item must be a GeoJSON Feature')
    }
    validateGeometry(feature.geometry)
  }

  return input
}

function pointInRing([x, y], ring) {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function pointInPolygon(point, coordinates) {
  if (!pointInRing(point, coordinates[0])) return false
  return !coordinates.slice(1).some((hole) => pointInRing(point, hole))
}

function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates)
  }

  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
}

export function pointInFeatureCollection(point, featureCollection) {
  if (!isCoordinatePair(point)) {
    throw new Error('point must be [longitude, latitude] with finite numbers')
  }

  const validated = validateArgentinaFeatureCollection(featureCollection)
  return validated.features.some((feature) => pointInGeometry(point, feature.geometry))
}
