export async function requestAuth(path, { method = 'GET', body, token, signal } = {}) {
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed. Please try again.')
    error.status = response.status
    throw error
  }

  return { data, renewedAccessToken: response.headers.get('X-Access-Token') }
}
