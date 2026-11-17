import { describe, expect, it, vi } from 'vitest'
import published from '../../public/data/antarctic.json'
import { antarcticSnapshotFixture } from '../test/antarcticFixtures'
import { antarcticPointsToFeatureCollection } from './antarcticMapData'
import { loadAntarcticSnapshot, validateAntarcticSnapshot } from './loadAntarcticSnapshot'

describe('Antarctic public weather data', () => {
  it('accepts both newly published data and an initially empty snapshot', () => {
    expect(validateAntarcticSnapshot(published).points).toHaveLength(6)
    const empty = validateAntarcticSnapshot(antarcticSnapshotFixture())
    expect(empty.sourceCheckedAt).toBeNull()
    expect(empty.points.every((p) => p.values.temperatureC === null)).toBe(true)
  })

  it('rejects duplicate bases, changed coordinates, impossible cloud or temperature', () => {
    const duplicate = antarcticSnapshotFixture()
    duplicate.points[1].id = duplicate.points[0].id
    expect(() => validateAntarcticSnapshot(duplicate)).toThrow(/duplicate/i)
    const shifted = antarcticSnapshotFixture()
    shifted.points[0].queryCoordinate.latitude += 1
    expect(() => validateAntarcticSnapshot(shifted)).toThrow(/coordinates/i)
    const impossible = antarcticSnapshotFixture()
    impossible.points[0].validAt = '2026-11-16T22:00:00.000Z'
    impossible.points[0].values.cloudCoverPct = 110
    expect(() => validateAntarcticSnapshot(impossible)).toThrow(/cloudCoverPct/i)
  })

  it('marks missing readings unavailable; uses source coordinate and labelled model values', () => {
    const empty = antarcticSnapshotFixture()
    const mapped = antarcticPointsToFeatureCollection(empty, 'temperature', null)
    expect(mapped.features).toHaveLength(6)
    expect(mapped.features[0].geometry.coordinates).toEqual([-44.74, -60.7378])
    expect(mapped.features[0].properties).toMatchObject({ available: false, label: '' })
    empty.points[0].validAt = '2026-11-16T22:00:00.000Z'
    empty.points[0].values.temperatureC = -12.3
    const enriched = antarcticPointsToFeatureCollection(empty, 'temperature', 'orcadas')
    expect(enriched.features[0].properties).toMatchObject({ available: true, label: '-12°', selected: true })
    empty.points[0].values.windSpeedKmh = 13.7
    const wind = antarcticPointsToFeatureCollection(empty, 'wind', null)
    expect(wind.features[0].properties).toMatchObject({ available: true, label: '14 km/h' })
    const cloud = antarcticPointsToFeatureCollection(empty, 'clouds', null)
    expect(cloud.features[0].properties).toMatchObject({ available: false, label: '' })
  })

  it('rejects invalid http fetch', async () => {
    const err = vi.fn(async () => new Response('down', { status: 503 }))
    await expect(loadAntarcticSnapshot(err as typeof fetch)).rejects.toThrow('503')
  })
})
