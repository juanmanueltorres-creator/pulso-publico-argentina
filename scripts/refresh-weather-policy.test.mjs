import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production weather refresh retry budget', () => {
  it('keeps the live fetch policy bounded inside the workflow budget', async () => {
    const source = await readFile(resolve('scripts/refresh-weather.mjs'), 'utf8')

    expect(source).toContain('AbortSignal.timeout(10_000)')
    expect(source).toContain('batchDelayMs: 12_000')
    expect(source).toContain('maxRetries: 2')
    expect(source).toContain('retryDelayMs: 10_000')
  })
})
