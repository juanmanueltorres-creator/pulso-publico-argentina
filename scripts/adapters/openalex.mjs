function requireValidTimestamp(value) {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new Error('OpenAlex fetchedAt must be a valid ISO date')
  }

  return new Date(value).toISOString()
}

function requireValidYear(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error('OpenAlex publication year must be a valid integer year')
  }

  return year
}

export function parseOpenAlexWorks(payload, fetchedAt = new Date().toISOString(), year = new Date().getUTCFullYear()) {
  const count = payload?.meta?.count

  if (!Number.isInteger(count) || count < 0) {
    throw new Error('OpenAlex meta.count must be a non-negative integer')
  }

  const observedAt = requireValidTimestamp(fetchedAt)
  const publicationYear = requireValidYear(year)
  const filter = `institutions.country_code:AR,publication_year:${publicationYear}`

  return {
    schemaVersion: '1.0',
    id: 'openalex-argentina-works',
    category: 'science',
    title: 'Producción científica indexada',
    value: count,
    unit: 'works',
    periodLabel: `${publicationYear} · afiliación institucional argentina`,
    status: 'updated',
    availability: 'available',
    observedAt,
    publishedAt: null,
    fetchedAt: observedAt,
    source: {
      name: 'OpenAlex',
      url: `https://api.openalex.org/works?filter=${filter}`,
      kind: 'open-index',
    },
    method: {
      type: 'api',
      note: `Conteo meta.count de works con filtro ${filter}.`,
    },
    limitations: [
      'OpenAlex es un índice bibliográfico, no un censo total de la producción científica argentina.',
      'El conteo incluye works con al menos una afiliación institucional argentina y puede incluir afiliaciones de otros países.',
      'Los conteos pueden cambiar por ingestión, curación y correcciones retroactivas del índice.',
      'El año en curso es parcial hasta que termina el período y la indexación puede tener rezago.',
    ],
  }
}
