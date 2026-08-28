import type { TerritorialKind } from '../types/territorial'

interface TerritorialLegendProps {
  mode: TerritorialKind
}

export function TerritorialLegend({ mode }: TerritorialLegendProps) {
  if (mode === 'earthquake') {
    return (
      <div className="territorial-legend" aria-label="Leyenda de sismos">
        <span className="territorial-legend__mark territorial-legend__mark--earthquake" aria-hidden="true" />
        <span>El tamaño representa magnitud. La profundidad aparece en el detalle.</span>
      </div>
    )
  }

  return (
    <div className="territorial-legend" aria-label="Leyenda de focos de calor">
      <span className="territorial-legend__mark territorial-legend__mark--hotspot" aria-hidden="true" />
      <span>Se muestran todas las detecciones; confianza y FRP aportan contexto, no confirmación de incendio.</span>
    </div>
  )
}
