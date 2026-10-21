// Session-only REST cache. Responses and pending requests share the same key.
// Nothing is persisted to localStorage or shared with another browser session.
export function createRequestCache(fetcher: typeof fetch, ttl = 120_000, maxEntries = 80) {
  const entries = new Map<string, { expires: number; response: Promise<Response> }>()
  let generation = 0

  function clear() {
    generation++
    entries.clear()
  }

  const cachedFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const isRest = new URL(request.url).pathname.startsWith('/rest/v1/')
    const isWrite = !['GET', 'HEAD'].includes(request.method)
    if (isWrite && (isRest || new URL(request.url).pathname.startsWith('/functions/v1/'))) {
      clear()
      try {
        return await fetcher(request)
      } finally {
        // Also discard reads started before a write finished (including partial failures).
        clear()
      }
    }

    if (!isRest) return fetcher(request)
    const key = JSON.stringify([request.method, request.url, [...request.headers.entries()].sort()])
    const existing = entries.get(key)
    if (existing && existing.expires > Date.now()) return (await existing.response).clone()
    entries.delete(key)
    const version = generation
    const entry = {
      expires: Date.now() + ttl,
      response: fetcher(request)
        .then((response) => {
          if ((!response.ok || generation !== version) && entries.get(key) === entry)
            entries.delete(key)
          return response
        })
        .catch((error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key)
          throw error
        }),
    }
    entries.set(key, entry)
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
    return (await entry.response).clone()
  }

  return { fetch: cachedFetch, clear }
}

export const requestCache = createRequestCache((input, init) => globalThis.fetch(input, init))
