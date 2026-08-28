import type { ThermalHotspotEvent } from '../types/territorial'
import type { WeatherPoint, WeatherSnapshot } from '../types/weather'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface WeatherNeighbor {
  point: WeatherPoint
  distanceKm: number
}

export interface HotspotWeatherContext {
  hotspotId: string
  frameIndex: number
  frameTimestamp: string
  timeDifferenceMinutes: number
  primary: WeatherNeighbor
  neighbors: WeatherNeighbor[]
}

const EARTH_RADIUS_KM = 6371.0088
const MAX_NEIGHBORS = 6

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const radians = (value: number) => (value * Math.PI) / 180
  const dLat = radians(b.latitude - a.latitude)
  const dLon = radians(b.longitude - a.longitude)
  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function nearestFrameIndex(occurredAt: string, timestamps: string[]): number | null {
  const eventTime = Date.parse(occurredAt)
  if (!Number.isFinite(eventTime) || timestamps.length === 0) return null

  let bestIndex: number | null = null
  let bestDifference = Number.POSITIVE_INFINITY

  for (let index = 0; index < timestamps.length; index += 1) {
    const frameTime = Date.parse(timestamps[index])
    if (!Number.isFinite(frameTime)) continue

    const difference = Math.abs(frameTime - eventTime)
    if (difference < bestDifference) {
      bestDifference = difference
      bestIndex = index
    }
  }

  return bestIndex
}

function hasUsableCoreValue(point: WeatherPoint, frameIndex: number): boolean {
  return [
    point.values.temperatureC[frameIndex],
    point.values.relativeHumidityPct[frameIndex],
    point.values.windSpeedKmh[frameIndex],
  ].some((value) => value !== null && Number.isFinite(value))
}

export function findWeatherContext(
  hotspot: ThermalHotspotEvent,
  snapshot: WeatherSnapshot,
  neighborCount = MAX_NEIGHBORS,
): HotspotWeatherContext | null {
  const frameIndex = nearestFrameIndex(hotspot.occurredAt, snapshot.timestamps)
  if (frameIndex === null) return null

  const frameTimestamp = snapshot.timestamps[frameIndex]
  const frameTime = Date.parse(frameTimestamp)
  const eventTime = Date.parse(hotspot.occurredAt)
  if (!Number.isFinite(frameTime) || !Number.isFinite(eventTime)) return null

  const requestedCount = Number.isFinite(neighborCount) ? Math.floor(neighborCount) : MAX_NEIGHBORS
  const limit = Math.min(MAX_NEIGHBORS, Math.max(1, requestedCount))

  const hotspotCoordinate: Coordinate = {
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
  }

  const neighbors = snapshot.points
    .filter(
      (point) =>
        Number.isFinite(point.queryCoordinate.latitude) &&
        Number.isFinite(point.queryCoordinate.longitude),
    )
    .map((point) => ({
      point,
      distanceKm: haversineKm(hotspotCoordinate, point.queryCoordinate),
    }))
    .filter((neighbor) => Number.isFinite(neighbor.distanceKm))
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm || a.point.id.localeCompare(b.point.id),
    )
    .slice(0, limit)

  if (neighbors.length === 0) return null

  const primary = neighbors.find((neighbor) => hasUsableCoreValue(neighbor.point, frameIndex))
  if (!primary) return null

  return {
    hotspotId: hotspot.id,
    frameIndex,
    frameTimestamp,
    timeDifferenceMinutes: Math.abs(frameTime - eventTime) / 60_000,
    primary,
    neighbors,
  }
}
