import type { WeatherSnapshot } from '../types/weather'
import { validateWeatherSnapshot } from './validateWeatherSnapshot'

export async function loadWeatherSnapshot(
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<WeatherSnapshot> {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const response = await fetcher(`${normalizedBase}data/weather.json`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to load weather snapshot: HTTP ${response.status}`)
  }

  return validateWeatherSnapshot(await response.json())
}
