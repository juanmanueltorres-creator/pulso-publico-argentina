import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateArgentinaFeatureCollection } from './lib/geo.mjs'

const IGN_WFS_BASE = 'https://wms.ign.gob.ar/geoserver/ows'
const IGN_LAYER = 'ign:provincia'

export const ARGENTINA_WFS_URL =
  `${IGN_WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature` +
  `&typeNames=${IGN_LAYER}&outputFormat=application%2Fjson&srsName=EPSG%3A4326`

export async function fetchArgentinaGeometry(fetchImpl = fetch) {
  const response = await fetchImpl(ARGENTINA_WFS_URL, {
    headers: { accept: 'application/geo+json,application/json' },
  })

  if (!response?.ok) {
    throw new Error(`IGN WFS request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const payload = validateArgentinaFeatureCollection(await response.json())
  if (payload.features.length !== 24) {
    throw new Error(`IGN provincia layer must contain 24 features; received ${payload.features.length}`)
  }

  return payload
}

async function main() {
  const outputPath = resolve(process.argv[2] ?? 'public/data/argentina-provinces.geojson')
  const tempPath = `${outputPath}.tmp`
  const geometry = await fetchArgentinaGeometry()

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(geometry)}\n`, 'utf8')
  await rename(tempPath, outputPath)

  console.log(`IGN Argentina geometry written: ${geometry.features.length} province features`)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(`IGN geometry fetch failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
