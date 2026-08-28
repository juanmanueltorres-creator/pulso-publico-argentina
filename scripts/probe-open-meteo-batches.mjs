import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { buildOpenMeteoUrl } from './fetch-open-meteo-weather.mjs'
import { generateWeatherGrid } from './lib/weather-grid.mjs'

const GEOMETRY_PATH = resolve('public/data/argentina-provinces.geojson')
const BATCH_SIZES = [1, 10, 25, 50, 100]
const REQUEST_TIMEOUT_MS = 30_000

async function probe(points, checkedAt) {
  const url = buildOpenMeteoUrl(points, checkedAt)
  const startedAt = performance.now()

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    const body = await response.text()
    const elapsedMs = Math.round(performance.now() - startedAt)

    console.log(
      JSON.stringify({
        batchSize: points.length,
        status: response.status,
        ok: response.ok,
        elapsedMs,
        bytes: Buffer.byteLength(body),
        retryAfter: response.headers.get('retry-after'),
      }),
    )
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    console.log(
      JSON.stringify({
        batchSize: points.length,
        status: null,
        ok: false,
        elapsedMs,
        errorName: error?.name ?? null,
        errorMessage: error?.message ?? String(error),
      }),
    )
  }
}

const geometry = JSON.parse(await readFile(GEOMETRY_PATH, 'utf8'))
const grid = generateWeatherGrid(geometry, 0.5)
const checkedAt = new Date().toISOString()

console.log(JSON.stringify({ gridPointCount: grid.length, checkedAt }))

for (const batchSize of BATCH_SIZES) {
  await probe(grid.slice(0, batchSize), checkedAt)
  await new Promise((resolveSleep) => setTimeout(resolveSleep, 2_000))
}
