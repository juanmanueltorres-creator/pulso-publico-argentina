const LIVE_API = 'https://api.cammesa.com/demanda-svc/generacion/ObtieneGeneracionEnergiaPorRegion?id_region=1002'
const IFRAME_ROOT = 'https://cdsrenovables.cammesa.com/renovableschart/'

async function probe(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json,text/html,*/*;q=0.8',
        'user-agent': 'pulso-publico-argentina-source-spike/0.1',
      },
      signal: AbortSignal.timeout(12_000),
    })

    const text = await response.text()
    console.log(`fetch ${url} -> ${response.status} ${response.headers.get('content-type')} bytes=${Buffer.byteLength(text, 'utf8')}`)
    console.log(`body=${text.slice(0, 5000)}`)
    return response.ok
  } catch (error) {
    console.log(`fetch ${url} -> ERROR ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function main() {
  console.log('--- CAMMESA official Web API candidate ---')
  const apiOk = await probe(LIVE_API)

  console.log('--- renewable iframe reachability ---')
  const iframeOk = await probe(IFRAME_ROOT)

  if (!apiOk && !iframeOk) {
    throw new Error('Neither CAMMESA live candidate is reliably reachable from the refresh runner')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
