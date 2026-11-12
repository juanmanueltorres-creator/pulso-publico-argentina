import { describe, expect, it } from 'vitest'
import {
  fetchNasaFirmsNoaa20Hotspots,
  parseNasaFirmsNoaa20Csv,
  NASA_FIRMS_NOAA20_URL,
} from './fetch-nasa-firms-hotspots.mjs'

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight'
const ROW = '-30.10000,-62.20000,300,0.56,0.69,2026-08-28,0310,N20,nominal,2.0NRT,285,1.88,N'
const OTHER = '-20.00000,-62.20000,300,0.56,0.69,2026-08-28,0200,N20,high,2.0NRT,285,5.5,N'
const CHECKED_AT = '2026-08-28T05:00:00Z'

describe('NASA FIRMS NOAA-20 public CSV adapter', () => {
  it('maps UTC acquisition and VIIRS categorical confidence and FRP', () => {
    const events = parseNasaFirmsNoaa20Csv([HEADER, ROW, OTHER].join('\n'), CHECKED_AT)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      occurredAt: '2026-08-28T03:10:00.000Z',
      kind: 'thermal-hotspot',
      confidence: 'nominal',
      frpMw: 1.88,
      sensor: 'VIIRS',
      satellite: 'NOAA20',
      latitude: -30.1,
      longitude: -62.2,
    })
    expect(events[0].id).toMatch(/^nasa-firms-[a-f0-9]{16}$/)
  })

  it('rejects header-only response instead of falsely publishing zero detections', () => {
    expect(() => parseNasaFirmsNoaa20Csv(HEADER, CHECKED_AT)).toThrow(/no regional detections/)
  })

  it('rejects stale files, wrong sensors and malformed metadata', () => {
    const stale = ROW.replace('2026-08-28', '2026-08-24')
    expect(() => parseNasaFirmsNoaa20Csv([HEADER, stale].join('\n'), CHECKED_AT))
      .toThrow(/stale/)
    expect(() => parseNasaFirmsNoaa20Csv([HEADER, ROW.replace(',N20,', ',SNPP,')].join('\n'), CHECKED_AT))
      .toThrow(/unexpected satellite/)
    expect(() => parseNasaFirmsNoaa20Csv('<html>Login</html>', CHECKED_AT))
      .toThrow(/missing required/)
    expect(() => parseNasaFirmsNoaa20Csv([HEADER, ROW.replace(',nominal,', ',100,')].join('\n'), CHECKED_AT))
      .toThrow(/confidence category/)
  })

  it('fetches the verified keyless official NOAA-20 24 h regional dataset', async () => {
    const seen = []
    const fetchImpl = async (url, options) => {
      seen.push({ url, options })
      return new Response([HEADER, ROW].join('\n'), {
        status: 200, headers: { 'content-type': 'text/csv' },
      })
    }
    const events = await fetchNasaFirmsNoaa20Hotspots(fetchImpl, CHECKED_AT)
    expect(seen[0].url).toBe(NASA_FIRMS_NOAA20_URL)
    expect(events).toHaveLength(1)
  })
})
