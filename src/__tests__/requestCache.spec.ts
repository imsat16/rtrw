import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestCache } from '@/lib/requestCache'

const url = 'https://example.supabase.co/rest/v1/residents?limit=10&offset=0'
const ok = () =>
  new Response(JSON.stringify([{ id: 'resident' }]), {
    headers: { 'Content-Type': 'application/json' },
  })
afterEach(() => vi.useRealTimers())

describe('session REST memory cache', () => {
  it('deduplicates simultaneous requests and returns independently readable responses', async () => {
    const fetcher = vi.fn(async () => ok())
    const cache = createRequestCache(fetcher)
    const responses = await Promise.all([cache.fetch(url), cache.fetch(url), cache.fetch(url)])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual(
      Array(3).fill([{ id: 'resident' }]),
    )
    await cache.fetch(url)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('separates page, limit, count headers and authenticated sessions', async () => {
    const fetcher = vi.fn(async () => ok())
    const cache = createRequestCache(fetcher)
    for (const [target, headers] of [
      [url, {}],
      [url.replace('offset=0', 'offset=10'), {}],
      [url.replace('limit=10', 'limit=25'), {}],
      [url, { Prefer: 'count=exact' }],
      [url, { Authorization: 'Bearer user-a' }],
      [url, { Authorization: 'Bearer user-b' }],
    ] as const)
      await cache.fetch(target, { headers })
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it('expires, clears on logout, and bounds memory', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(async () => ok())
    const cache = createRequestCache(fetcher, 120_000, 2)
    await cache.fetch(url)
    vi.advanceTimersByTime(120_001)
    await cache.fetch(url)
    cache.clear()
    await cache.fetch(url)
    await cache.fetch(`${url}&q=2`)
    await cache.fetch(`${url}&q=3`)
    await cache.fetch(url)
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it.each(['PATCH', 'POST', 'DELETE'])(
    'invalidates GET results after a %s, including failures',
    async (method) => {
      const fetcher = vi.fn(async () => ok())
      const cache = createRequestCache(fetcher)
      await cache.fetch(url)
      fetcher.mockResolvedValueOnce(new Response('failure', { status: 500 }))
      await cache.fetch(url, { method })
      await cache.fetch(url)
      expect(fetcher).toHaveBeenCalledTimes(3)
    },
  )

  it('invalidates reads after managed-user Edge Function writes', async () => {
    const fetcher = vi.fn(async () => ok())
    const cache = createRequestCache(fetcher)
    await cache.fetch(url)
    await cache.fetch('https://example.supabase.co/functions/v1/create-user', { method: 'POST' })
    await cache.fetch(url)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not cache failed responses or network errors', async () => {
    const fetcher = vi
      .fn(async () => ok())
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockRejectedValueOnce(new Error('offline'))
    const cache = createRequestCache(fetcher)
    expect((await cache.fetch(url)).status).toBe(403)
    await expect(cache.fetch(url)).rejects.toThrow('offline')
    await cache.fetch(url)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not put a read started before a write back into the cache', async () => {
    let resolveRead!: (response: Response) => void
    const fetcher = vi
      .fn(async () => ok())
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRead = resolve
          }),
      )
    const cache = createRequestCache(fetcher)
    const pending = cache.fetch(url)
    await cache.fetch(url, { method: 'PATCH' })
    resolveRead(ok())
    await pending
    await cache.fetch(url)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})
