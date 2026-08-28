import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { refreshConaeHotspotSnapshot } from './refresh-conae-hotspots-lib.mjs'
import { writeJsonAtomic } from './lib/write-json-atomic.mjs'

const SNAPSHOT_PATH = resolve('public/data/hotspots.json')
const GEOMETRY_PATH = resolve('public/data/argentina-provinces.geojson')

const fetchWithTimeout = (url, options = {}) =>
  fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  })

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

  const result = await refreshConaeHotspotSnapshot(
    previous,
    argentinaGeometry,
    fetchWithTimeout,
    checkedAt,
  )

  if (!result.publish) {
    console.log(`CONAE checked: unchanged · ${result.snapshot.events.length} focos de calor en 24 h`)
    return
  }

  await writeJsonAtomic(SNAPSHOT_PATH, result.snapshot)
  console.log(`CONAE refreshed: ${result.snapshot.events.length} focos de calor en 24 h`)
}

main().catch((error) => {
  console.error(`CONAE refresh failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
