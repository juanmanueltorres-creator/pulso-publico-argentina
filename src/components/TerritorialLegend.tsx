import type { TerritorialKind } from '../types/territorial'

interface TerritorialLegendProps {
  mode: TerritorialKind
}

export function TerritorialLegend({ mode }: TerritorialLegendProps) {
  if (mode === 'earthquake') {
    return (
      <div className="territorial-legend" aria-label="Leyenda de sismos" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span className="territorial-legend__mark territorial-legend__mark--earthquake" aria-hidden="true" />
        <span>Tamaño = magnitud</span>
        <span>Escala visual reforzada desde M4+; el tamaño no representa daño previsto.</span>
        <span>La profundidad y la intensidad aparecen en el detalle.</span>
      </div>
    )
  }

  return (
    <div className="territorial-legend" aria-label="Leyenda de focos de calor" tabIndex={0}>
      <strong>Cómo leer este mapa</strong>
      <span>Tamaño = cantidad de detecciones agrupadas</span>
      <span>Tono = proporción de detecciones con confianza alta</span>
      <span className="territorial-legend__tone-scale" aria-label="Escala de tono de confianza alta">
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-low" aria-hidden="true" />
          <span>&lt; 1% alta</span>
        </span>
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-medium" aria-hidden="true" />
          <span>1–3% alta</span>
        </span>
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-high" aria-hidden="true" />
          <span>≥ 3% alta</span>
        </span>
      </span>
      <span>En puntos individuales, el tono refleja la confianza de esa detección.</span>
      <span>Más grande no significa más peligro. Confianza de detección no equivale a probabilidad de incendio.</span>
      <span>FRP aporta contexto en el detalle; no representa peligro ni confirma un incendio.</span>
    </div>
  )
}
