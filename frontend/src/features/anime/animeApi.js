export async function getHomeListing({ signal } = {}) {
  const response = await fetch('/api/home', {
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
