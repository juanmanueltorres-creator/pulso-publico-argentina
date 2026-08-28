import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { refreshCammesaSnapshot } from './refresh-cammesa-lib.mjs'

export async function refreshCammesaSnapshotFile(
  snapshotPath,
  extractedPath,
  fetchedAt = new Date().toISOString(),
) {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const extracted = JSON.parse(await readFile(extractedPath, 'utf8'))
  const nextSnapshot = refreshCammesaSnapshot(snapshot, extracted, fetchedAt)
  const tempPath = `${snapshotPath}.tmp`

  await writeFile(tempPath, `${JSON.stringify(nextSnapshot, null, 2)}\n`, 'utf8')
  await rename(tempPath, snapshotPath)

  return nextSnapshot
}

async function main() {
  const snapshotPath = resolve(process.argv[2] ?? 'public/data/signals.json')
  const extractedArg = process.argv[3]
  if (!extractedArg) {
    throw new Error('usage: refresh-cammesa.mjs [snapshot.json] <cammesa-summary.json>')
  }

  const extractedPath = resolve(extractedArg)
  const nextSnapshot = await refreshCammesaSnapshotFile(snapshotPath, extractedPath)
  const signal = nextSnapshot.signals.find((item) => item.id === 'cammesa-renewables')
  console.log(`CAMMESA refreshed: ${signal.value} GWh · ${signal.periodLabel}`)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(`CAMMESA refresh failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
