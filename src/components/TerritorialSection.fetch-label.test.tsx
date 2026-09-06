import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: () => <div data-testid="territorial-map" />,
}))

describe('TerritorialSection fetch timestamp semantics', () => {
  it('explains a stale source check as Pulso synchronization time, separate from represented time', async () => {
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

    expect(await screen.findByText(/Sin actualización reciente.*Última actualización de Pulso/i)).toBeInTheDocument()
    expect(screen.queryByText(/Fuente consultada \(última consulta\)/i)).not.toBeInTheDocument()
  })
})
