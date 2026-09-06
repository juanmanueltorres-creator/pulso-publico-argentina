import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: () => <div data-testid="territorial-map" />,
}))

describe('TerritorialSection fetch timestamp semantics', () => {
  it('labels a stale source check as Fuente consultada so it is not confused with model time', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => Promise.reject(new Error('not needed'))}
        loadHotspots={async () => Promise.reject(new Error('not needed'))}
        loadWeather={async () => weatherSnapshotFixture()}
        now={new Date('2026-08-28T09:00:00Z')}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Meteorología' }))

    expect(await screen.findByText(/Datos desactualizados.*Fuente consultada/i)).toBeInTheDocument()
  })
})
