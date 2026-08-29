import type { ExpressionSpecification } from 'maplibre-gl'

export const EARTHQUAKE_DEPTH_UNKNOWN_COLOR = '#8896b4'
export const EARTHQUAKE_DEPTH_MAX_KM = 500

export const EARTHQUAKE_DEPTH_STOPS = [
  [0, '#d95d39'],
  [35, '#ef8a47'],
  [70, '#f2c14e'],
  [150, '#73bfb8'],
  [300, '#4f7cac'],
  [EARTHQUAKE_DEPTH_MAX_KM, '#5d4b8c'],
] as const

export function earthquakeDepthColorExpression(): ExpressionSpecification {
  const stops = EARTHQUAKE_DEPTH_STOPS.flatMap(([depth, color]) => [depth, color])

  return [
    'case',
    ['!=', ['get', 'depthKm'], null],
    [
      'interpolate',
      ['linear'],
      ['to-number', ['get', 'depthKm'], 0],
      ...stops,
    ],
    EARTHQUAKE_DEPTH_UNKNOWN_COLOR,
  ] as unknown as ExpressionSpecification
}

export function earthquakeDepthLegendGradient(): string {
  const stops = EARTHQUAKE_DEPTH_STOPS.map(
    ([depth, color]) => `${color} ${((depth / EARTHQUAKE_DEPTH_MAX_KM) * 100).toFixed(1)}%`,
  )
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
