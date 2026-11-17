import { describe, expect, it, vi } from 'vitest'
import emptyMarineSnapshot from '../../public/data/marine.json'
import { loadMarineSnapshot, validateMarineSnapshot } from './loadMarineSnapshot'
import { marinePointsToFeatureCollection } from './marineMapData'

const valid = () => structuredClone(emptyMarineSnapshot)

describe('Pulso Marino public contract', () => {
  it('keeps a complete six-point null-only initial snapshot without inventing readings', () => {
    const snapshot = validateMarineSnapshot(valid())
    expect(snapshot.points).toHaveLength(6)
    expect(snapshot.sourceCheckedAt).toBeNull()
    expect(snapshot.points[0].values.waveHeightM).toBeNull()
    expect(snapshot.points[0].values.currentVelocityKmh).toBeNull()
    expect(snapshot.points[0].values.seaSurfaceTemperatureC).toBeNull()
  })
  it('rejects missing points, duplicate identifiers and out-of-range readings', () => {
    const shorter = valid() as any
    shorter.points.pop()
    expect(() => validateMarineSnapshot(shorter)).toThrow(/incomplete/i)
    const duplicate = valid() as any
    duplicate.points[1].id = duplicate.points[0].id
    expect(() => validateMarineSnapshot(duplicate)).toThrow(/duplicate/i)
    const wrong = valid() as any
    wrong.points[0].validAt = '2026-11-17T00:00:00.000Z'
    wrong.points[0].values.waveHeightM = -1
    expect(() => validateMarineSnapshot(wrong)).toThrow(/waveHeightM/)
  })
  it('shows offshore marker positions with empty labels for absent data', () => {
    const snapshot = validateMarineSnapshot(valid())
    const features = marinePointsToFeatureCollection(snapshot, 'waves', null)
    expect(features.features).toHaveLength(6)
    expect(features.features.every((feature) => feature.properties.value === null)).toBe(true)
    expect(features.features.every((feature) => feature.properties.label === '')).toBe(true)
    expect(features.features[0].geometry.coordinates).toEqual([-56.5, -38.1])
  })
  it('shows a modelled value only for the explicitly selected variable', () => {
    const payload = valid() as any
    payload.sourceCheckedAt = '2026-11-17T00:00:00.000Z'
    payload.points[0].validAt = '2026-11-17T00:00:00.000Z'
    payload.points[0].values.waveHeightM = 2.8
    const snapshot = validateMarineSnapshot(payload)
    const wave = marinePointsToFeatureCollection(snapshot, 'waves', payload.points[0].id)
    expect(wave.features[0].properties).toMatchObject({ label: '2.8 m', available: true, selected: true })
    const current = marinePointsToFeatureCollection(snapshot, 'currents', payload.points[0].id)
    expect(current.features[0].properties).toMatchObject({ label: '', available: false })
  })
  it('rejects failed remote snapshot loading', async () => {
    const fail = vi.fn(async () => new Response('unavailable', { status: 503 }))
    await expect(loadMarineSnapshot(fail as typeof fetch)).rejects.toThrow('503')
  })
})
