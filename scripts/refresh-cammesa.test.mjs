import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { refreshCammesaSnapshotFile } from './refresh-cammesa.mjs'

describe('refreshCammesaSnapshotFile', () => {
  it('reads extracted CAMMESA data and atomically updates the snapshot file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pulso-cammesa-'))
    const snapshotPath = join(directory, 'signals.json')
    const extractedPath = join(directory, 'cammesa.json')
    const fetchedAt = '2026-08-28T03:30:00.000Z'

    await writeFile(
      snapshotPath,
      JSON.stringify({
        schemaVersion: '1.0',
        generatedAt: '2026-08-28T03:00:00.000Z',
        signals: [
          { id: 'cammesa-renewables', value: null, availability: 'unavailable' },
          { id: 'inpi-patents', value: 323, availability: 'available' },
        ],
      }),
      'utf8',
    )
    await writeFile(
      extractedPath,
      JSON.stringify({ period: '2026-07', totalGwh: 1791.245147 }),
      'utf8',
    )

    await refreshCammesaSnapshotFile(snapshotPath, extractedPath, fetchedAt)

    const next = JSON.parse(await readFile(snapshotPath, 'utf8'))
    expect(next.generatedAt).toBe(fetchedAt)
    expect(next.signals[0]).toMatchObject({
      id: 'cammesa-renewables',
      value: 1791.245147,
      unit: 'GWh',
      periodLabel: 'Julio 2026 · último dato publicado',
      availability: 'available',
      fetchedAt,
    })
    expect(next.signals[1]).toEqual({
      id: 'inpi-patents',
      value: 323,
      availability: 'available',
    })
  })
})
