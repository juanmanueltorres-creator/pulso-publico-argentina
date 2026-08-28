import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInpresEarthquakes, parseInpresLocalDate } from './inpres.mjs'

const fixture = await readFile(resolve(process.cwd(), 'scripts/fixtures/inpres-recent.html'), 'utf8')

describe('parseInpresLocalDate', () => {
  it('normalizes the current INPRES date format with explicit UTC-3 offset', () => {
    expect(parseInpresLocalDate('2026-08-28 01:15:30')).toBe('2026-08-28T01:15:30-03:00')
  })

  it('keeps compatibility with the historical DD/MM/YYYY format', () => {
    expect(parseInpresLocalDate('28/08/2026 01:15')).toBe('2026-08-28T01:15:00-03:00')
  })
})

describe('parseInpresEarthquakes', () => {
  it('parses magnitude, depth, province and intensity from headings instead of fixed positions', () => {
    const [event] = parseInpresEarthquakes(fixture)

    expect(event).toMatchObject({
      kind: 'earthquake',
      occurredAt: '2026-08-28T01:15:30-03:00',
      latitude: -31.4,
      longitude: -68.6,
      magnitude: 4.2,
      depthKm: 86,
      province: 'SAN JUAN',
      intensityText: 'II a III',
      place: null,
    })
    expect(event.id).toMatch(/^inpres-[a-f0-9]{16}$/)
  })

  it('produces deterministic event ids', () => {
    expect(parseInpresEarthquakes(fixture)[0].id).toBe(parseInpresEarthquakes(fixture)[0].id)
  })

  it('fails closed when a required heading changes', () => {
    expect(() => parseInpresEarthquakes(fixture.replace('Magn.', 'Valor'))).toThrow(/required heading/i)
  })
})
