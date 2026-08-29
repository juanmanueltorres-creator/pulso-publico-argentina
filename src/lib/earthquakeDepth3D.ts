import type { EarthquakeEvent } from '../types/territorial'
import { earthquakeDepthColorRgb } from './earthquakeDepthScale'

export type EarthquakeDisplayMode = '2d' | '3d'

export const EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION = 6

const MAX_MERCATOR_LATITUDE = 85.051129
const SELECTED_SURFACE_COLOR: [number, number, number] = [248, 235, 198]

export interface EarthquakeDepth3DVertex {
  x: number
  y: number
  elevation: number
  color: [number, number, number]
  size: number
}

export interface EarthquakeDepth3DGeometry {
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

  return { stems, anchors, points }
}
