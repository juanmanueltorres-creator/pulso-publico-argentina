import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { refreshInpresSnapshot } from './refresh-inpres-lib.mjs'
import { writeJsonAtomic } from './lib/write-json-atomic.mjs'

const SNAPSHOT_PATH = resolve('public/data/earthquakes.json')
const GEOMETRY_PATH = resolve('public/data/argentina-provinces.geojson')

const fetchWithTimeout = (url, options = {}) =>
  fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
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

  const result = await refreshInpresSnapshot(
    previous,
    argentinaGeometry,
    fetchWithTimeout,
    checkedAt,
  )

  if (!result.publish) {
    console.log(`INPRES checked: unchanged · ${result.snapshot.events.length} sismos en 168 h`)
    return
  }

  await writeJsonAtomic(SNAPSHOT_PATH, result.snapshot)
  console.log(`INPRES refreshed: ${result.snapshot.events.length} sismos en 168 h`)
}

main().catch((error) => {
  console.error(`INPRES refresh failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
