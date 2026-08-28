import { describe, expect, it } from 'vitest'
import evidenceSnapshot from '../../public/data/evidence.json'
import villaguayGeometryRaw from '../../public/data/evidence/territories/villaguay.geojson?raw'
import villaguaySource from '../../public/data/evidence/territories/villaguay.source.json'
import { validateEvidenceSnapshot } from './validateEvidenceSnapshot'

const villaguayGeometry = JSON.parse(villaguayGeometryRaw) as {
  type: string
  features: Array<{
    properties: { adminCode: string }
    geometry: { type: string; coordinates: unknown }
  }>
}

function allCoordinatesFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (!Array.isArray(value)) return false
  return value.length > 0 && value.every(allCoordinatesFinite)
}

describe('Villaguay evidence data contract', () => {
  it('publishes one validated external AgroENSO reference keyed by official department code', () => {
    const snapshot = validateEvidenceSnapshot(evidenceSnapshot)

    expect(snapshot.evidences).toHaveLength(1)
    const evidence = snapshot.evidences[0]
    expect(evidence.id).toBe('agroenso-maize-nino-villaguay')
    expect(evidence.territory.adminCode).toBe('30113')
    expect(evidence.territory.adminName).toBe('Villaguay')
    expect(evidence.provenance.resultKind).toBe('external-reference')
    expect(evidence.result.value).toBe(24)
    expect(evidence.result.statisticalSignificance).toBeNull()
  })

  it('publishes a finite territorial reference geometry for the same official code', () => {
    expect(villaguayGeometry.type).toBe('FeatureCollection')
    expect(villaguayGeometry.features).toHaveLength(1)

    const feature = villaguayGeometry.features[0]
    expect(feature.properties.adminCode).toBe('30113')
    expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type)
    expect(allCoordinatesFinite(feature.geometry.coordinates)).toBe(true)
  })

  it('documents geometry provenance and deliberate simplification', () => {
    expect(villaguaySource.adminCode).toBe('30113')
    expect(villaguaySource.crs).toBe('EPSG:4326')
    expect(villaguaySource.identitySource).toMatch(/GeoRef|INDEC/i)
    expect(villaguaySource.geometryUpstream).toMatch(/IGN/i)
    expect(villaguaySource.geometryDistribution).toMatch(/CONAE/i)
    expect(villaguaySource.simplification).toMatch(/TopoJSON|arcos|endpoints|junction/i)
    expect(villaguaySource.limitations.join(' ')).toMatch(/catastral|referencia territorial/i)
  })
})
