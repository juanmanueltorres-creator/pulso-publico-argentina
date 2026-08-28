const BUNDLE = 'https://cdsrenovables.cammesa.com/renovableschart/main.a5124ecd4411e075.js'

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/javascript,text/javascript,*/*;q=0.8',
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
    },
    signal: AbortSignal.timeout(15_000),
  })

  const text = await response.text()
  console.log(`fetch ${url} -> ${response.status} ${response.headers.get('content-type')} bytes=${Buffer.byteLength(text, 'utf8')}`)
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
  return text
}

function uniq(values) {
  return [...new Set(values)]
}

async function main() {
  const js = await fetchText(BUNDLE)

  const strings = uniq(
    [...js.matchAll(/["'`]([^"'`\\\n]{2,500})["'`]/g)]
      .map((match) => match[1])
      .filter((value) => /http|api|service|chart|data|renov|gener|demanda|potencia|total|source|histo/i.test(value)),
  )

  console.log('--- relevant string literals ---')
  for (const value of strings.slice(0, 300)) console.log(value)

  console.log('--- URL/path candidates ---')
  const paths = uniq(
    [...js.matchAll(/(?:https?:\/\/[^"'`\s)]+|\/[A-Za-z0-9_.~-]+(?:\/[A-Za-z0-9_.?=&%~-]+){1,8})/g)]
      .map((match) => match[0])
      .filter((value) => /api|service|chart|data|renov|gener|demanda|histo/i.test(value)),
  )
  for (const value of paths.slice(0, 200)) console.log(value)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
