import type { EarthquakeEvent, ThermalHotspotEvent } from '../types/territorial'

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export function explainEarthquake(event: EarthquakeEvent): string {
  const magnitude = NUMBER_FORMATTER.format(event.magnitude)
  const depth = event.depthKm === null ? 'profundidad no informada' : `${NUMBER_FORMATTER.format(event.depthKm)} km de profundidad`
  const place = event.place ?? event.province

  return `Sismo de magnitud ${magnitude}, con ${depth}${place ? `, registrado en ${place}` : ''}. La magnitud y la profundidad describen el evento, pero por sí solas no determinan su impacto.`
}

export function explainHotspot(event: ThermalHotspotEvent): string {
  const details = [
    event.sensor ? `sensor ${event.sensor}` : null,
    event.frpMw === null ? null : `FRP ${NUMBER_FORMATTER.format(event.frpMw)} MW`,
    `confianza ${event.confidence}`,
  ].filter(Boolean)

  return `Foco de calor detectado${details.length > 0 ? ` · ${details.join(' · ')}` : ''}. Una detección térmica no implica un incendio confirmado.`
}
