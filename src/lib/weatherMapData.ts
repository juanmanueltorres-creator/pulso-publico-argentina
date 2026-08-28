import type { ThermalHotspotEvent } from '../types/territorial'
import type { WeatherPoint, WeatherSnapshot, WeatherVariable } from '../types/weather'
import type { HotspotWeatherContext } from './weatherContext'

const WIND_VECTOR_ANGULAR_DEGREES = 0.12

function featureCollection(features: object[]) {
  return {
    type: 'FeatureCollection',
    features,
  }
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null
}

function selectedWeatherValue(
  point: WeatherPoint,
  frameIndex: number,
  variable: WeatherVariable,
): number | null {
  if (variable === 'temperature') return finiteOrNull(point.values.temperatureC[frameIndex])
  if (variable === 'humidity') return finiteOrNull(point.values.relativeHumidityPct[frameIndex])
  return finiteOrNull(point.values.windSpeedKmh[frameIndex])
}

function frameProperties(point: WeatherPoint, frameIndex: number, frameTimestamp?: string) {
  return {
    id: point.id,
    frameIndex,
    frameTimestamp: frameTimestamp ?? null,
    temperatureC: finiteOrNull(point.values.temperatureC[frameIndex]),
    relativeHumidityPct: finiteOrNull(point.values.relativeHumidityPct[frameIndex]),
    windSpeedKmh: finiteOrNull(point.values.windSpeedKmh[frameIndex]),
    windDirectionDeg: finiteOrNull(point.values.windDirectionDeg[frameIndex]),
    windGustKmh: finiteOrNull(point.values.windGustKmh[frameIndex]),
    precipitationMm: finiteOrNull(point.values.precipitationMm[frameIndex]),
  }
}

export function weatherFrameToFeatureCollection(
  snapshot: WeatherSnapshot,
  frameIndex: number,
  variable: WeatherVariable,
): object {
  const frameTimestamp = snapshot.timestamps[frameIndex]

  const features = snapshot.points.flatMap((point) => {
    const weatherValue = selectedWeatherValue(point, frameIndex, variable)
    if (weatherValue === null) return []

    return [
      {
        type: 'Feature',
        id: point.id,
        geometry: {
          type: 'Point',
          coordinates: [point.queryCoordinate.longitude, point.queryCoordinate.latitude],
        },
        properties: {
          ...frameProperties(point, frameIndex, frameTimestamp),
          weatherValue,
          variable,
        },
      },
    ]
  })

  return featureCollection(features)
}

function destinationCoordinate(
  latitude: number,
  longitude: number,
  bearingDegrees: number,
): [number, number] {
  const radians = (value: number) => (value * Math.PI) / 180
  const degrees = (value: number) => (value * 180) / Math.PI
  const angularDistance = radians(WIND_VECTOR_ANGULAR_DEGREES)
  const bearing = radians(bearingDegrees)
  const lat1 = radians(latitude)
  const lon1 = radians(longitude)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [degrees(lon2), degrees(lat2)]
}

export function weatherWindVectorsToFeatureCollection(
  snapshot: WeatherSnapshot,
  frameIndex: number,
): object {
  const frameTimestamp = snapshot.timestamps[frameIndex]

  const features = snapshot.points.flatMap((point) => {
    const windSpeedKmh = finiteOrNull(point.values.windSpeedKmh[frameIndex])
    const windDirectionDeg = finiteOrNull(point.values.windDirectionDeg[frameIndex])
    if (windSpeedKmh === null || windDirectionDeg === null) return []

    const origin: [number, number] = [
      point.queryCoordinate.longitude,
      point.queryCoordinate.latitude,
    ]
    const endpoint = destinationCoordinate(
      point.queryCoordinate.latitude,
      point.queryCoordinate.longitude,
      windDirectionDeg,
    )

    return [
      {
        type: 'Feature',
        id: point.id,
        geometry: {
          type: 'LineString',
          coordinates: [origin, endpoint],
        },
        properties: {
          id: point.id,
          frameIndex,
          frameTimestamp: frameTimestamp ?? null,
          windSpeedKmh,
          windDirectionDeg,
          windGustKmh: finiteOrNull(point.values.windGustKmh[frameIndex]),
          directionSemantics: 'from',
        },
      },
    ]
  })

  return featureCollection(features)
}

export function weatherNeighborsToFeatureCollection(
  context: HotspotWeatherContext,
  frameIndex: number,
): object {
  return featureCollection(
    context.neighbors.map((neighbor, index) => ({
      type: 'Feature',
      id: neighbor.point.id,
      geometry: {
        type: 'Point',
        coordinates: [
          neighbor.point.queryCoordinate.longitude,
          neighbor.point.queryCoordinate.latitude,
        ],
      },
      properties: {
        ...frameProperties(neighbor.point, frameIndex, context.frameTimestamp),
        rank: index + 1,
        distanceKm: neighbor.distanceKm,
        isPrimary: neighbor.point.id === context.primary.point.id,
      },
    })),
  )
}

export function weatherLinkToFeatureCollection(
  hotspot: ThermalHotspotEvent,
  context: HotspotWeatherContext,
): object {
  return featureCollection([
    {
      type: 'Feature',
      id: `weather-link:${hotspot.id}:${context.primary.point.id}`,
      geometry: {
        type: 'LineString',
        coordinates: [
          [hotspot.longitude, hotspot.latitude],
          [
            context.primary.point.queryCoordinate.longitude,
            context.primary.point.queryCoordinate.latitude,
          ],
        ],
      },
      properties: {
        hotspotId: hotspot.id,
        weatherPointId: context.primary.point.id,
        distanceKm: context.primary.distanceKm,
        frameIndex: context.frameIndex,
        frameTimestamp: context.frameTimestamp,
        timeDifferenceMinutes: context.timeDifferenceMinutes,
      },
    },
  ])
}

export function selectedHotspotToFeatureCollection(
  hotspot: ThermalHotspotEvent | null,
): object {
  if (!hotspot) return featureCollection([])

  return featureCollection([
    {
      type: 'Feature',
      id: hotspot.id,
      geometry: {
        type: 'Point',
        coordinates: [hotspot.longitude, hotspot.latitude],
      },
      properties: {
        id: hotspot.id,
        kind: hotspot.kind,
        occurredAt: hotspot.occurredAt,
        confidence: hotspot.confidence,
        frpMw: hotspot.frpMw,
        sensor: hotspot.sensor,
        satellite: hotspot.satellite,
      },
    },
  ])
}
