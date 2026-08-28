import { describe, expect, it } from 'vitest'
import weatherSnapshotArtifact from '../../public/data/weather.json'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { validateWeatherSnapshot } from './validateWeatherSnapshot'

function mutableFixture(): any {
  return weatherSnapshotFixture()
}

describe('validateWeatherSnapshot', () => {
  it('accepts one aligned 24-frame snapshot', () => {
    const fixture = weatherSnapshotFixture()
    expect(validateWeatherSnapshot(fixture)).toEqual(fixture)
  })

  it('validates the published national weather artifact', () => {
    const snapshot = validateWeatherSnapshot(weatherSnapshotArtifact)

    expect(snapshot.timestamps).toHaveLength(24)
    expect(snapshot.grid.spacingDegrees).toBe(0.5)
    expect(snapshot.grid.pointCount).toBe(snapshot.points.length)
    expect(snapshot.grid.pointCount).toBeGreaterThan(1000)
    expect(snapshot.freshness.staleAfterMinutes).toBe(480)
    expect(snapshot.source).toMatchObject({
      provider: 'Open-Meteo',
      dataset: 'ECMWF IFS HRES 9 km',
      kind: 'numerical-weather-model',
      upstream: 'ECMWF',
    })
  })

  it('preserves null instead of coercing it to zero', () => {
    const fixture = mutableFixture()
    fixture.points[0].values.temperatureC[4] = null
    expect(validateWeatherSnapshot(fixture).points[0].values.temperatureC[4]).toBeNull()
  })

  it('rejects an unsupported schema version', () => {
    const fixture = mutableFixture()
    fixture.schemaVersion = '2.0'
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('rejects invalid snapshot timestamps', () => {
    const fixture = mutableFixture()
    fixture.generatedAt = 'not-a-date'
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('requires exactly 24 common timestamps', () => {
    const fixture = mutableFixture()
    fixture.timestamps.pop()
    for (const point of fixture.points) {
      for (const series of Object.values(point.values) as Array<Array<number | null>>) series.pop()
    }
    fixture.dataThrough = fixture.timestamps.at(-1)
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('requires timestamps to be unique and strictly ascending', () => {
    const fixture = mutableFixture()
    fixture.timestamps[5] = fixture.timestamps[4]
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const reversed = mutableFixture()
    ;[reversed.timestamps[3], reversed.timestamps[4]] = [reversed.timestamps[4], reversed.timestamps[3]]
    expect(() => validateWeatherSnapshot(reversed)).toThrow()
  })

  it('requires dataThrough to equal the final represented frame', () => {
    const fixture = mutableFixture()
    fixture.dataThrough = fixture.timestamps[22]
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('requires the approved 24-hour window and one-hour step', () => {
    const fixture = mutableFixture()
    fixture.window.hours = 48
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const wrongStep = mutableFixture()
    wrongStep.window.stepHours = 3
    expect(() => validateWeatherSnapshot(wrongStep)).toThrow()
  })

  it('requires positive freshness and exactly 0.5 degree grid spacing', () => {
    const fixture = mutableFixture()
    fixture.freshness.staleAfterMinutes = 0
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const wrongGrid = mutableFixture()
    wrongGrid.grid.spacingDegrees = 1
    expect(() => validateWeatherSnapshot(wrongGrid)).toThrow()
  })

  it('requires unique non-empty point ids and consistent pointCount', () => {
    const fixture = mutableFixture()
    fixture.points[1].id = fixture.points[0].id
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const emptyId = mutableFixture()
    emptyId.points[0].id = '  '
    expect(() => validateWeatherSnapshot(emptyId)).toThrow()

    const wrongCount = mutableFixture()
    wrongCount.grid.pointCount = 99
    expect(() => validateWeatherSnapshot(wrongCount)).toThrow()
  })

  it('validates query and provider coordinates as WGS84', () => {
    const fixture = mutableFixture()
    fixture.points[0].queryCoordinate.latitude = -91
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const provider = mutableFixture()
    provider.points[0].providerCoordinate.longitude = 181
    expect(() => validateWeatherSnapshot(provider)).toThrow()
  })

  it('requires every weather series to align with all 24 frames', () => {
    const fixture = mutableFixture()
    fixture.points[0].values.windSpeedKmh.pop()
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('rejects NaN and Infinity while allowing null', () => {
    const fixture = mutableFixture()
    fixture.points[0].values.temperatureC[0] = Number.NaN
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const infinity = mutableFixture()
    infinity.points[0].values.temperatureC[0] = Number.POSITIVE_INFINITY
    expect(() => validateWeatherSnapshot(infinity)).toThrow()
  })

  it.each([
    ['relativeHumidityPct', 101],
    ['relativeHumidityPct', -1],
    ['windSpeedKmh', -0.1],
    ['windGustKmh', -0.1],
    ['windDirectionDeg', 361],
    ['windDirectionDeg', -1],
    ['precipitationMm', -0.1],
  ])('rejects out-of-domain %s value %s', (key, invalid) => {
    const fixture = mutableFixture()
    fixture.points[0].values[key][0] = invalid
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })

  it('accepts the boundary humidity and wind direction values', () => {
    const fixture = mutableFixture()
    fixture.points[0].values.relativeHumidityPct[0] = 0
    fixture.points[0].values.relativeHumidityPct[1] = 100
    fixture.points[0].values.windDirectionDeg[0] = 0
    fixture.points[0].values.windDirectionDeg[1] = 360
    expect(validateWeatherSnapshot(fixture).points[0].values.windDirectionDeg.slice(0, 2)).toEqual([0, 360])
  })

  it('requires numerical-weather-model source metadata', () => {
    const fixture = mutableFixture()
    fixture.source.kind = 'official'
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const emptyLicense = mutableFixture()
    emptyLicense.source.license = ''
    expect(() => validateWeatherSnapshot(emptyLicense)).toThrow()
  })

  it('requires historical-forecast-grid with 60-minute resolution', () => {
    const fixture = mutableFixture()
    fixture.method.type = 'station'
    expect(() => validateWeatherSnapshot(fixture)).toThrow()

    const wrongResolution = mutableFixture()
    wrongResolution.method.temporalResolutionMinutes = 30
    expect(() => validateWeatherSnapshot(wrongResolution)).toThrow()
  })

  it('requires limitations to be an array of strings', () => {
    const fixture = mutableFixture()
    fixture.limitations = ['ok', 42]
    expect(() => validateWeatherSnapshot(fixture)).toThrow()
  })
})
