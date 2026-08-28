const ROOT = 'https://cdsrenovables.cammesa.com/renovableschart/'

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/javascript,text/javascript,*/*;q=0.8',
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
    },
    signal: AbortSignal.timeout(15_000),
  })

  const text = await response.text()
  console.log(`fetch ${url} -> ${response.status} ${response.headers.get('content-type')} bytes=${Buffer.byteLength(text, 'utf8')}`)
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
  return text
}

function absoluteUrl(value, base) {
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

function uniq(items) {
  return [...new Set(items)]
}

function extractScripts(html, base) {
  return uniq(
    [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
      .map((match) => absoluteUrl(match[1], base))
      .filter(Boolean),
  )
}

function relevantLines(text) {
  const matcher = /fetch\(|ajax|axios|xmlhttprequest|websocket|socket|\.json\b|\.csv\b|\/api\b|api\/|http[s]?:\/\/|generation|generacion|renovable|potencia|demanda|mw\b/i
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ index: index + 1, line: line.trim() }))
    .filter(({ line }) => matcher.test(line))
    .slice(0, 120)
}

async function main() {
  const html = await fetchText(ROOT)

  console.log('--- iframe html hints ---')
  for (const { index, line } of relevantLines(html).slice(0, 60)) {
    console.log(`${index}: ${line.slice(0, 1200)}`)
  }

  const scripts = extractScripts(html, ROOT)
  console.log('--- scripts ---')
  for (const script of scripts) console.log(script)

  console.log('--- script endpoint hints ---')
  for (const script of scripts.slice(0, 15)) {
    try {
      const js = await fetchText(script)
      const hints = relevantLines(js)
      if (hints.length === 0) continue
      console.log(`### ${script}`)
      for (const { index, line } of hints.slice(0, 80)) {
        console.log(`${index}: ${line.slice(0, 1600)}`)
      }
    } catch (error) {
      console.log(`skip ${script}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
