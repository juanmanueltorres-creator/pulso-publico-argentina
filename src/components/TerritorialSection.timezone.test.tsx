import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: () => <div data-testid="territorial-map" />,
}))

describe('TerritorialSection Argentina time display', () => {
  it('shows meteorological timestamps in Argentina time and labels the timezone', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => Promise.reject(new Error('not needed for this test'))}
        loadHotspots={async () => Promise.reject(new Error('not needed for this test'))}
        loadWeather={async () => weatherSnapshotFixture()}
        now={new Date('2026-08-28T01:00:00Z')}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Meteorología' }))

    expect(await screen.findByText(/Datos hasta.*8:00.*hora ARG/i)).toBeInTheDocument()
  })
})
