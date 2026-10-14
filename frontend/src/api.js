let accessToken = null

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) {
    if (response.status === 401) accessToken = null
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    error.errors = data.errors
    throw error
  }
  const renewedToken = response.headers.get('X-Access-Token')
  if (renewedToken) accessToken = renewedToken
  if (path === '/auth/login') accessToken = data.accessToken
  if (path === '/auth/logout' || path === '/auth/logout-all') accessToken = null
  return data
}
export const authApi = {
  register: (details) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(details) }),
  login: (details) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(details) }),
  me: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  logoutAll: () => apiRequest('/auth/logout-all', { method: 'POST' }),
}
