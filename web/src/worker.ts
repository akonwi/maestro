interface Env {
  API_ORIGIN?: string
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env.API_ORIGIN)
    }
    return env.ASSETS.fetch(request)
  },
}

async function proxyApi(
  request: Request,
  configuredOrigin: string | undefined,
): Promise<Response> {
  if (!configuredOrigin) {
    return Response.json(
      { error: 'API_ORIGIN is not configured' },
      { status: 503 },
    )
  }

  let origin: URL
  try {
    origin = new URL(configuredOrigin)
  } catch {
    return Response.json({ error: 'API_ORIGIN is invalid' }, { status: 503 })
  }

  const incoming = new URL(request.url)
  const upstream = new URL(origin)
  upstream.pathname = `${origin.pathname.replace(/\/$/, '')}${incoming.pathname.slice(4) || '/'}`
  upstream.search = incoming.search

  const upstreamRequest = new Request(upstream, request)
  upstreamRequest.headers.set('x-forwarded-host', incoming.host)
  upstreamRequest.headers.set(
    'x-forwarded-proto',
    incoming.protocol.slice(0, -1),
  )
  return fetch(upstreamRequest)
}
