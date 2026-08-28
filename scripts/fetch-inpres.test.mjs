import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fetchInpresEarthquakes } from './fetch-inpres.mjs'

const fixture = await readFile(resolve(process.cwd(), 'scripts/fixtures/inpres-recent.html'), 'utf8')

describe('fetchInpresEarthquakes', () => {
  it('fetches and parses the official recent-earthquakes table', async () => {
    const fetchImpl = async () => new Response(fixture, { status: 200 })

    const events = await fetchInpresEarthquakes(fetchImpl)

    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ kind: 'earthquake', magnitude: 4.2, province: 'SAN JUAN' })
  })

  it('fails closed on a non-success HTTP response', async () => {
    const fetchImpl = async () => new Response('down', { status: 503 })

    await expect(fetchInpresEarthquakes(fetchImpl)).rejects.toThrow(/503/)
  })
})
