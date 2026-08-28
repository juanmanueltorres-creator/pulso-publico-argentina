export function weatherSnapshotFixture() {
  const timestamps = Array.from({ length: 24 }, (_, index) =>
    new Date(Date.UTC(2026, 7, 27, index)).toISOString(),
  )

  const series = (start: number, step = 1): Array<number | null> =>
    timestamps.map((_, index) => start + index * step)

  return {
    schemaVersion: '1.0' as const,
    generatedAt: '2026-08-28T00:30:00.000Z',
    sourceCheckedAt: '2026-08-28T00:30:00.000Z',
    dataThrough: timestamps[23],
    window: { hours: 24 as const, stepHours: 1 as const },
    freshness: { staleAfterMinutes: 480 },
    grid: { spacingDegrees: 0.5 as const, pointCount: 2 },
    timestamps,
    source: {
      provider: 'Open-Meteo',
      dataset: 'ECMWF IFS HRES 9 km',
      url: 'https://open-meteo.com/en/docs/historical-forecast-api',
      kind: 'numerical-weather-model' as const,
      license: 'CC BY 4.0',
    },
    method: {
      type: 'historical-forecast-grid' as const,
      temporalResolutionMinutes: 60 as const,
      note: 'Fixture meteorológico modelado de prueba.',
    },
    limitations: ['Es contexto modelado, no una medición de estación.'],
    points: [
      {
        id: 'wx:-31.50:-64.00',
        queryCoordinate: { latitude: -31.5, longitude: -64 },
        providerCoordinate: { latitude: -31.48, longitude: -64.02 },
        values: {
          temperatureC: series(18, 0.25),
          relativeHumidityPct: series(60, -1),
          windSpeedKmh: series(10, 0.5),
          windDirectionDeg: series(180, 2),
          windGustKmh: series(15, 0.6),
          precipitationMm: timestamps.map((_, index) => (index % 6 === 0 ? 0.4 : 0)),
        },
      },
      {
        id: 'wx:-32.00:-64.00',
        queryCoordinate: { latitude: -32, longitude: -64 },
        providerCoordinate: null,
        values: {
          temperatureC: series(17, 0.2),
          relativeHumidityPct: series(65, -1),
          windSpeedKmh: series(8, 0.4),
          windDirectionDeg: series(160, 2),
          windGustKmh: series(13, 0.5),
          precipitationMm: timestamps.map(() => 0),
        },
      },
    ],
  }
}
