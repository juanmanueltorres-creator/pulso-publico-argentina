const PAGE_URL = 'https://datos.inpi.gob.ar/Home/Ingresos_Patentes'
const SCRIPT_URL = 'https://datos.inpi.gob.ar/Scripts/Home/Estadisticas/Ingresos_Patentes.js'

function uniq(values) {
  return [...new Set(values)]
}

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
  const html = await fetchText(PAGE_URL, 'text/html,application/xhtml+xml')
  console.log(`html-bytes=${Buffer.byteLength(html, 'utf8')}`)

  const scripts = uniq(
    [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]),
  )
  console.log('--- script srcs ---')
  for (const src of scripts) console.log(src)

  const js = await fetchText(SCRIPT_URL, 'text/javascript,application/javascript,*/*')
  console.log(`js-bytes=${Buffer.byteLength(js, 'utf8')}`)

  console.log('--- JS lines mentioning csv/export/download/ajax/url ---')
  for (const [index, line] of js.split(/\r?\n/).entries()) {
    if (/csv|export|download|ajax|url\s*:|\.get\(|\.post\(|fetch\(/i.test(line)) {
      console.log(`${index + 1}: ${line.replace(/\s+/g, ' ').trim().slice(0, 900)}`)
    }
  }

  console.log('--- URL-like quoted values ---')
  const candidates = uniq(
    [...js.matchAll(/["'`]([^"'`\n]{1,300})["'`]/g)]
      .map((match) => match[1])
      .filter((value) => /^\/?[A-Za-z0-9_.~!$&'()*+,;=:@%/?-]+$/.test(value))
      .filter((value) => /home|patent|ingreso|csv|export|data|estad/i.test(value)),
  )
  for (const candidate of candidates.slice(0, 160)) console.log(candidate)

  console.log('--- button handlers ---')
  for (const [index, line] of js.split(/\r?\n/).entries()) {
    if (/#ano|#mes|id.?ano|id.?mes|\.on\(.?click|\.click\(/i.test(line)) {
      console.log(`${index + 1}: ${line.replace(/\s+/g, ' ').trim().slice(0, 900)}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
