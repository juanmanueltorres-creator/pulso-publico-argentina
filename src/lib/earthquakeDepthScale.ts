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

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

export function earthquakeDepthColorRgb(depthKm: number): [number, number, number] {
  if (depthKm <= EARTHQUAKE_DEPTH_STOPS[0][0]) {
    return hexToRgb(EARTHQUAKE_DEPTH_STOPS[0][1])
  }

  for (let index = 1; index < EARTHQUAKE_DEPTH_STOPS.length; index += 1) {
    const [upperDepth, upperColor] = EARTHQUAKE_DEPTH_STOPS[index]
    const [lowerDepth, lowerColor] = EARTHQUAKE_DEPTH_STOPS[index - 1]
    if (depthKm > upperDepth) continue

    const ratio = (depthKm - lowerDepth) / (upperDepth - lowerDepth)
    const lower = hexToRgb(lowerColor)
    const upper = hexToRgb(upperColor)
    return lower.map((value, channel) => Math.round(value + (upper[channel] - value) * ratio)) as [
      number,
      number,
      number,
    ]
  }

  return hexToRgb(EARTHQUAKE_DEPTH_STOPS[EARTHQUAKE_DEPTH_STOPS.length - 1][1])
}

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
