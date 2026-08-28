const PAGE_URL = 'https://datos.inpi.gob.ar/Home/Ingresos_Patentes'
const SCRIPT_URL = 'https://datos.inpi.gob.ar/Scripts/Home/Estadisticas/Ingresos_Patentes.js'

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: {
      accept,
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
    },
    signal: AbortSignal.timeout(15_000),
  })

  console.log(`fetch ${url} -> ${response.status} ${response.headers.get('content-type')}`)
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
  return response.text()
}

async function main() {
  await fetchText(PAGE_URL, 'text/html,application/xhtml+xml')
  const js = await fetchText(SCRIPT_URL, 'text/javascript,application/javascript,*/*')
  const lines = js.split(/\r?\n/)

  console.log('--- first 125 lines of official dashboard JS ---')
  for (let index = 0; index < Math.min(lines.length, 125); index += 1) {
    console.log(`${index + 1}: ${lines[index].replace(/\s+/g, ' ').trim().slice(0, 1200)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
