import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { refreshWeatherSnapshot } from './refresh-weather-lib.mjs'
import { writeJsonAtomic } from './lib/write-json-atomic.mjs'

const SNAPSHOT_PATH = resolve('public/data/weather.json')
const GEOMETRY_PATH = resolve('public/data/argentina-provinces.geojson')

const fetchWithTimeout = (url, options = {}) =>
  fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  })

const WEATHER_FETCH_OPTIONS = {
  batchDelayMs: 12_000,
  maxRetries: 2,
  retryDelayMs: 60_000,
}

async function readPreviousSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function main() {
  const checkedAt = new Date().toISOString()
  const [previous, argentinaGeometry] = await Promise.all([
    readPreviousSnapshot(),
    readFile(GEOMETRY_PATH, 'utf8').then(JSON.parse),
  ])

  const result = await refreshWeatherSnapshot(
    previous,
    argentinaGeometry,
    fetchWithTimeout,
    checkedAt,
    WEATHER_FETCH_OPTIONS,
  )

  if (!result.publish) {
    console.log(
      `Weather checked: unchanged · ${result.snapshot.grid.pointCount} modeled points · through ${result.snapshot.dataThrough}`,
    )
    return
  }

  await writeJsonAtomic(SNAPSHOT_PATH, result.snapshot)
  console.log(
    `Weather refreshed: ${result.snapshot.grid.pointCount} modeled points · 24 hourly frames · through ${result.snapshot.dataThrough}`,
  )
}

main().catch((error) => {
  console.error(`Weather refresh failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
