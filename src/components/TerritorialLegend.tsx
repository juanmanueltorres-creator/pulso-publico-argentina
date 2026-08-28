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
        <span>La profundidad y la intensidad aparecen en el detalle.</span>
      </div>
    )
  }

  return (
    <div className="territorial-legend" aria-label="Leyenda de focos de calor" tabIndex={0}>
      <strong>Cómo leer este mapa</strong>
      <span className="territorial-legend__mark territorial-legend__mark--hotspot" aria-hidden="true" />
      <span>Tamaño y color = confianza de detección</span>
      <span>FRP aporta contexto en el detalle; no representa peligro ni confirma un incendio.</span>
    </div>
  )
}
