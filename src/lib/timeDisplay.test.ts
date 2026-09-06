import { describe, expect, it } from 'vitest'
import { formatArgInstant, formatCalendarDate } from './timeDisplay'

describe('timeDisplay temporal contract adapter', () => {
  it('renders UTC instants in Argentina time with an explicit label', () => {
    expect(formatArgInstant('2026-09-05T23:00:00Z', 'observation')).toMatch(/20:00.*hora ARG/)
  })

  it('preserves an instant that already carries the Argentina offset', () => {
    expect(formatArgInstant('2026-09-05T20:00:00-03:00', 'observation')).toMatch(/20:00.*hora ARG/)
  })

  it('renders calendar observations without shifting them to the previous Argentina day', () => {
    expect(formatCalendarDate('2026-07-01T00:00:00.000Z', 'observation')).toMatch(/1 jul 2026/i)
    expect(formatCalendarDate('2026-07-01T00:00:00.000Z', 'observation')).not.toMatch(/30 jun/i)
  })
})
