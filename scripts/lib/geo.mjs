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

function squaredDistance(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = end[0]
      y = end[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

function simplifyOpenLine(points, toleranceSquared) {
  if (points.length <= 2) return [...points]

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop()
    let index = -1
    let maxDistance = toleranceSquared

    for (let i = first + 1; i < last; i += 1) {
      const distance = squaredSegmentDistance(points[i], points[first], points[last])
      if (distance > maxDistance) {
        index = i
        maxDistance = distance
      }
    }

    if (index !== -1) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  return points.filter((_, index) => keep[index] === 1)
}

function simplifyClosedRing(ring, toleranceSquared) {
  const open = ring.slice(0, -1)
  if (open.length <= 3) return ring.map((point) => [...point])

  let splitIndex = 1
  let maxDistance = -1
  for (let index = 1; index < open.length; index += 1) {
    const distance = squaredDistance(open[0], open[index])
    if (distance > maxDistance) {
      splitIndex = index
      maxDistance = distance
    }
  }

  const firstArc = open.slice(0, splitIndex + 1)
  const secondArc = [...open.slice(splitIndex), open[0]]
  const simplifiedFirst = simplifyOpenLine(firstArc, toleranceSquared)
  const simplifiedSecond = simplifyOpenLine(secondArc, toleranceSquared)
  const merged = [...simplifiedFirst.slice(0, -1), ...simplifiedSecond.slice(0, -1)]

  if (merged.length < 3) return ring.map((point) => [...point])
  return [...merged, [...merged[0]]]
}

function simplifyPolygonCoordinates(coordinates, toleranceSquared) {
  return coordinates.map((ring) => simplifyClosedRing(ring, toleranceSquared))
}

export function simplifyFeatureCollection(featureCollection, toleranceDegrees = 0.001) {
  if (typeof toleranceDegrees !== 'number' || !Number.isFinite(toleranceDegrees) || toleranceDegrees <= 0) {
    throw new Error('simplification tolerance must be a positive finite number')
  }

  const validated = validateArgentinaFeatureCollection(featureCollection)
  const toleranceSquared = toleranceDegrees * toleranceDegrees

  return {
    ...validated,
    features: validated.features.map((feature) => ({
      ...feature,
      geometry:
        feature.geometry.type === 'Polygon'
          ? {
              ...feature.geometry,
              coordinates: simplifyPolygonCoordinates(feature.geometry.coordinates, toleranceSquared),
            }
          : {
              ...feature.geometry,
              coordinates: feature.geometry.coordinates.map((polygon) =>
                simplifyPolygonCoordinates(polygon, toleranceSquared),
              ),
            },
    })),
  }
}
