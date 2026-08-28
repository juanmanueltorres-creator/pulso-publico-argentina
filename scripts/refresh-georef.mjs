import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { refreshGeorefSnapshot } from './refresh-georef-lib.mjs'

const SNAPSHOT_PATH = resolve('public/data/signals.json')
const TEMP_PATH = `${SNAPSHOT_PATH}.tmp`

const fetchWithTimeout = (url, options = {}) =>
  fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  })

async function main() {
  const fetchedAt = new Date().toISOString()
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))
  const nextSnapshot = await refreshGeorefSnapshot(snapshot, fetchWithTimeout, fetchedAt)

  await writeFile(TEMP_PATH, `${JSON.stringify(nextSnapshot, null, 2)}\n`, 'utf8')
  await rename(TEMP_PATH, SNAPSHOT_PATH)

  const signal = nextSnapshot.signals.find((item) => item.id === 'georef-api-usage')
  console.log(`GeoRef refreshed: ${signal.value} consultas · observed ${signal.observedAt}`)
}

main().catch((error) => {
  console.error(`GeoRef refresh failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
