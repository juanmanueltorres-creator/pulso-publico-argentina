import type { CSSProperties } from 'react'
import type { TerritorialViewMode, WeatherVariable } from '../types/weather'

interface TerritorialLegendProps {
  mode: TerritorialViewMode
  weatherVariable?: WeatherVariable
}

const WEATHER_SCALE_STYLE: CSSProperties = {
  display: 'grid',
  gap: '0.22rem',
  minWidth: '15rem',
  padding: '0.45rem 0.55rem',
  border: '1px solid rgba(211, 164, 98, 0.18)',
  borderRadius: '0.4rem',
  background: 'rgba(255,255,255,0.018)',
}

const SCALE_BAR_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '0.55rem',
  borderRadius: '999px',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
}

const SCALE_LABELS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.55rem',
  fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
  fontSize: '0.58rem',
}

const ARROW_EXAMPLE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.36rem 0.5rem',
  border: '1px solid rgba(110, 197, 233, 0.22)',
  borderRadius: '0.4rem',
  background: 'rgba(110, 197, 233, 0.035)',
}

function WeatherScale({
  ariaLabel,
  gradient,
  labels,
  direction,
}: {
  ariaLabel: string
  gradient: string
  labels: string[]
  direction: string
}) {
  return (
    <span role="img" aria-label={ariaLabel} style={WEATHER_SCALE_STYLE}>
      <span style={{ color: 'var(--muted)', fontSize: '0.63rem' }}>{direction}</span>
      <span aria-hidden="true" style={{ ...SCALE_BAR_STYLE, background: gradient }} />
      <span style={SCALE_LABELS_STYLE}>
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </span>
    </span>
  )
}

function WindArrowExample() {
  return (
    <span role="img" aria-label="Ejemplo de flecha de viento: cola y punta" style={ARROW_EXAMPLE_STYLE}>
      <span>cola = de dónde viene</span>
      <span aria-hidden="true" style={{ color: '#64c7c0', fontSize: '1.1rem', letterSpacing: '-0.15em' }}>
        ───▶
      </span>
      <span>punta = hacia dónde se mueve</span>
    </span>
  )
}

export function TerritorialLegend({ mode, weatherVariable = 'temperature' }: TerritorialLegendProps) {
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

  if (mode === 'weather') {
    return (
      <div className="territorial-legend" aria-label="Leyenda meteorológica" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span>Modelo meteorológico ECMWF distribuido mediante Open-Meteo.</span>
        <span>Contexto modelado sobre la malla Pulso; no estación de superficie.</span>

        {weatherVariable === 'temperature' ? (
          <>
            <span>Temperatura modelada para la hora activa. El color permite comparar zonas rápidamente.</span>
            <WeatherScale
              ariaLabel="Escala visual de temperatura"
              gradient="linear-gradient(90deg, #4f7cac 0%, #73bfb8 35%, #f2c14e 68%, #ef8a47 84%, #d95d39 100%)"
              labels={['0 °C', '20 °C', '40 °C']}
              direction="más frío ← temperatura → más cálido"
            />
          </>
        ) : weatherVariable === 'humidity' ? (
          <>
            <span>Humedad relativa modelada para la hora activa. La paleta es distinta de temperatura.</span>
            <WeatherScale
              ariaLabel="Escala visual de humedad"
              gradient="linear-gradient(90deg, #6b5547 0%, #b59b5b 30%, #5f9d87 60%, #4f9fbf 82%, #8bd3dd 100%)"
              labels={['0 %', '50 %', '100 %']}
              direction="más seco ← humedad relativa → más húmedo"
            />
          </>
        ) : (
          <>
            <span>La dirección textual indica la dirección desde la que sopla el viento; es decir, de dónde sopla.</span>
            <WindArrowExample />
            <WeatherScale
              ariaLabel="Escala visual de velocidad del viento"
              gradient="linear-gradient(90deg, #7aa6b8 0%, #64c7c0 35%, #f2c14e 67%, #ef8354 100%)"
              labels={['0 km/h', '30 km/h', '60 km/h']}
              direction="menor ← velocidad del viento → mayor"
            />
            <span>La longitud visual de cada vector es constante y no representa velocidad.</span>
            <span>El color representa velocidad modelada; velocidad y ráfagas exactas se leen en el detalle.</span>
          </>
        )}
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
