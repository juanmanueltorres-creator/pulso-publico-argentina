import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function writeJsonAtomic(path, value) {
  const tempPath = `${path}.tmp`

  await mkdir(dirname(path), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, path)
}
