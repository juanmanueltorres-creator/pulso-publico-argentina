import type { EarthquakeEvent } from '../types/territorial'
import { earthquakeDepthColorRgb } from './earthquakeDepthScale'

export type EarthquakeDisplayMode = '2d' | '3d'

export const EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION = 6
export const EARTHQUAKE_DEPTH_REFERENCE_KM = [70, 150, 300] as const

const MAX_MERCATOR_LATITUDE = 85.051129
const SELECTED_SURFACE_COLOR: [number, number, number] = [248, 235, 198]
const DEPTH_GUIDE_COLOR: [number, number, number] = [164, 146, 112]
const GUIDE_PADDING_RATIO = 0.08
const MIN_GUIDE_PADDING = 0.004

export interface EarthquakeDepth3DVertex {
  x: number
  y: number
  elevation: number
  color: [number, number, number]
  size: number
}

export interface EarthquakeDepth3DGeometry {
  guides: EarthquakeDepth3DVertex[]
  stems: EarthquakeDepth3DVertex[]
  anchors: EarthquakeDepth3DVertex[]
  points: EarthquakeDepth3DVertex[]
}

function toMercator(longitude: number, latitude: number): [number, number] {
  const clampedLatitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude))
  const latitudeRadians = (clampedLatitude * Math.PI) / 180
  const x = (longitude + 180) / 360
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)) / (2 * Math.PI)
  return [x, y]
}

function pointSize(magnitude: number): number {
  return Math.max(4, Math.min(16, 4 + magnitude * 1.45))
}

function guideVertex(x: number, y: number, elevation: number): EarthquakeDepth3DVertex {
  return { x, y, elevation, color: DEPTH_GUIDE_COLOR, size: 0 }
}

function buildDepthGuides(points: EarthquakeDepth3DVertex[]): EarthquakeDepth3DVertex[] {
  if (points.length === 0) return []

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const padX = Math.max((maxX - minX) * GUIDE_PADDING_RATIO, MIN_GUIDE_PADDING)
  const padY = Math.max((maxY - minY) * GUIDE_PADDING_RATIO, MIN_GUIDE_PADDING)
  const left = Math.max(0, minX - padX)
  const right = Math.min(1, maxX + padX)
  const top = Math.max(0, minY - padY)
  const bottom = Math.min(1, maxY + padY)
  const guides: EarthquakeDepth3DVertex[] = []

  for (const depthKm of EARTHQUAKE_DEPTH_REFERENCE_KM) {
    const elevation = -depthKm * 1000 * EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION
    const topLeft = guideVertex(left, top, elevation)
    const topRight = guideVertex(right, top, elevation)
    const bottomRight = guideVertex(right, bottom, elevation)
    const bottomLeft = guideVertex(left, bottom, elevation)
    guides.push(
      topLeft,
      topRight,
      topRight,
      bottomRight,
      bottomRight,
      bottomLeft,
      bottomLeft,
      topLeft,
    )
  }

  return guides
}

export function buildEarthquakeDepth3DGeometry(
  events: EarthquakeEvent[],
  selectedId: string | null = null,
): EarthquakeDepth3DGeometry {
  const stems: EarthquakeDepth3DVertex[] = []
  const anchors: EarthquakeDepth3DVertex[] = []
  const points: EarthquakeDepth3DVertex[] = []

  for (const event of events) {
    if (event.depthKm === null || !Number.isFinite(event.depthKm)) continue

    const [x, y] = toMercator(event.longitude, event.latitude)
    const elevation = -event.depthKm * 1000 * EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION
    const color = earthquakeDepthColorRgb(event.depthKm)
    const size = pointSize(event.magnitude)
    const hypocenter: EarthquakeDepth3DVertex = { x, y, elevation, color, size }

    points.push(hypocenter)

    if (event.id !== selectedId) continue

    const surface: EarthquakeDepth3DVertex = { x, y, elevation: 0, color, size }
    const anchor: EarthquakeDepth3DVertex = {
      x,
      y,
      elevation: 0,
      color: SELECTED_SURFACE_COLOR,
      size: size + 7,
    }
    stems.push(surface, hypocenter)
    anchors.push(anchor)
  }

  return { guides: buildDepthGuides(points), stems, anchors, points }
}
