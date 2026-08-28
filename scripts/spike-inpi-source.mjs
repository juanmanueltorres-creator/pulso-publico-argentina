const PAGE_URL = 'https://datos.inpi.gob.ar/Home/Ingresos_Patentes'

function uniq(values) {
  return [...new Set(values)]
}

async function main() {
  const response = await fetch(PAGE_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
    },
    signal: AbortSignal.timeout(15_000),
  })

  console.log(`status=${response.status}`)
  console.log(`content-type=${response.headers.get('content-type')}`)

  if (!response.ok) {
    throw new Error(`INPI page failed with HTTP ${response.status}`)
  }

  const html = await response.text()
  console.log(`html-bytes=${Buffer.byteLength(html, 'utf8')}`)

  const scripts = uniq(
    [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]),
  )
  console.log('--- script srcs ---')
  for (const src of scripts) console.log(src)

  const hrefs = uniq(
    [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((value) => /csv|patent|export|download|ingreso/i.test(value)),
  )
  console.log('--- relevant hrefs ---')
  for (const href of hrefs) console.log(href)

  const formActions = uniq(
    [...html.matchAll(/<form[^>]+action=["']([^"']+)["']/gi)].map((match) => match[1]),
  )
  console.log('--- form actions ---')
  for (const action of formActions) console.log(action)

  const quotedCandidates = uniq(
    [...html.matchAll(/["']([^"'\n]{1,220})["']/g)]
      .map((match) => match[1])
      .filter((value) => /csv|export|download|patent|ingreso/i.test(value)),
  )
  console.log('--- quoted candidates ---')
  for (const candidate of quotedCandidates.slice(0, 120)) console.log(candidate)

  const lines = html.split(/\r?\n/)
  console.log('--- lines mentioning csv/export/download ---')
  for (const [index, line] of lines.entries()) {
    if (/csv|export|download/i.test(line)) {
      const clean = line.replace(/\s+/g, ' ').trim()
      console.log(`${index + 1}: ${clean.slice(0, 600)}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
