export async function getAnimeListing({ page = 1, limit = 20, signal } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const response = await fetch(`/api/anime?${query}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Anime could not be loaded. Please try again.')
  }

  return payload
}
