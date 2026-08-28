const DOWNLOAD_PAGE = 'https://cammesaweb.cammesa.com/download/energia-renovables-base-de-datos/'

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      accept: '*/*',
      'user-agent': 'pulso-publico-argentina-source-spike/0.1',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
}

function uniq(values) {
  return [...new Set(values)]
}

async function main() {
  const pageResponse = await fetchWithTimeout(DOWNLOAD_PAGE, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  })
  const html = await pageResponse.text()
  console.log(`page -> ${pageResponse.status} ${pageResponse.headers.get('content-type')} bytes=${Buffer.byteLength(html, 'utf8')}`)
  if (!pageResponse.ok) throw new Error(`download page failed with HTTP ${pageResponse.status}`)

  const hrefs = uniq(
    [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => match[1].replaceAll('&amp;', '&'))
      .filter((href) => /wpdmdl=|\.xlsx?|download/i.test(href)),
  )

  console.log('--- download candidates ---')
  for (const href of hrefs.slice(0, 80)) console.log(href)

  const ids = uniq([...html.matchAll(/wpdmdl=(\d+)/gi)].map((match) => match[1]))
  console.log(`wpdmdl ids=${ids.join(',')}`)

  if (ids.length === 0) throw new Error('No CAMMESA download id found in official page')

  for (const id of ids.slice(0, 5)) {
    const url = `https://cammesaweb.cammesa.com/?wpdmdl=${id}`
    const response = await fetchWithTimeout(url, { redirect: 'manual' })
    console.log(`download ${id} -> ${response.status} type=${response.headers.get('content-type')} length=${response.headers.get('content-length')} location=${response.headers.get('location')}`)

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const target = new URL(response.headers.get('location'), url).href
      const targetResponse = await fetchWithTimeout(target)
      const buffer = Buffer.from(await targetResponse.arrayBuffer())
      console.log(`target ${target} -> ${targetResponse.status} type=${targetResponse.headers.get('content-type')} bytes=${buffer.length} magic=${buffer.subarray(0, 8).toString('hex')}`)
    } else if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer())
      console.log(`body -> bytes=${buffer.length} magic=${buffer.subarray(0, 8).toString('hex')}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
