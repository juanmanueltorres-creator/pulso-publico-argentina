const BASE_URL = 'https://datos.inpi.gob.ar'

async function fetchJson(path, params) {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/javascript,*/*;q=0.1',
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
      'x-requested-with': 'XMLHttpRequest',
      referer: `${BASE_URL}/Home/Ingresos_Patentes`,
    },
    signal: AbortSignal.timeout(15_000),
  })

  console.log(`fetch ${url} -> ${response.status} ${response.headers.get('content-type')}`)
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
  return response.json()
}

function inspect(label, data) {
  console.log(`--- ${label} ---`)
  console.log(`array=${Array.isArray(data)} length=${Array.isArray(data) ? data.length : 'n/a'}`)
  if (!Array.isArray(data) || data.length === 0) {
    console.log(JSON.stringify(data).slice(0, 1200))
    return
  }

  console.log(`keys=${Object.keys(data[0]).join(',')}`)
  console.log(`first=${JSON.stringify(data[0])}`)
  console.log(`penultimate=${JSON.stringify(data.at(-2))}`)
  console.log(`last=${JSON.stringify(data.at(-1))}`)
}

async function main() {
  const monthly = await fetchJson('/Home/getEstadisticasCSV', {
    tipoTramite: 'Patentes',
    mes: 1,
    ano: 0,
  })
  inspect('monthly patent filings', monthly)

  const annual = await fetchJson('/Home/getEstadisticasCSV', {
    tipoTramite: 'Patentes',
    mes: 0,
    ano: 1,
  })
  inspect('annual patent filings', annual)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
