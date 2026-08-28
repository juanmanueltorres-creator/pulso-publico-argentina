import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeJsonAtomic } from './write-json-atomic.mjs'

describe('writeJsonAtomic', () => {
  it('writes valid JSON to the destination and leaves no tmp file behind', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pulso-territorial-'))
    const destination = join(directory, 'earthquakes.json')

    try {
      await writeJsonAtomic(destination, { ok: true, events: [{ id: 'eq-1' }] })

      expect(JSON.parse(await readFile(destination, 'utf8'))).toEqual({
        ok: true,
        events: [{ id: 'eq-1' }],
      })
      expect(await readdir(directory)).toEqual(['earthquakes.json'])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
