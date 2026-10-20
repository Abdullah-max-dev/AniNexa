import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './AuthContext'
import { requestAuth } from './authApi'

const RETRY_DELAY_MS = 30_000

function expiryDelay(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload))
    if (!Number.isFinite(exp)) throw new Error('Missing expiration')
    return Math.max(0, exp * 1000 - Date.now() + 1000)
  } catch {
    return 15 * 60 * 1000
  }
}

export default function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const tokenRef = useRef(null)
  const generationRef = useRef(0)

  const storeToken = useCallback((token) => {
    tokenRef.current = token
    setAccessToken(token)
  }, [])

  const clearAuth = useCallback(() => {
    generationRef.current += 1
    storeToken(null)
    setUser(null)
  }, [storeToken])

  // All protected calls send the in-memory token and accept a renewed token
  // from the existing authentication middleware's response header.
  const authFetch = useCallback(async (path, options = {}) => {
    const generation = generationRef.current
    try {
      const result = await requestAuth(path, { ...options, token: tokenRef.current })
      if (generation === generationRef.current && result.renewedAccessToken) {
        storeToken(result.renewedAccessToken)
      }
      return result
    } catch (error) {
      if (error.status === 401 && generation === generationRef.current) clearAuth()
      throw error
    }
  }, [clearAuth, storeToken])

  useEffect(() => {
    const controller = new AbortController()
    const generation = generationRef.current
    authFetch('/auth/me', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted && generation === generationRef.current) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setReady(true)
      })
    return () => controller.abort()
  }, [authFetch])

  useEffect(() => {
    if (!accessToken) return undefined
    let timer
    let cancelled = false
    const controller = new AbortController()

    const refreshAfterExpiry = async () => {
      try {
        const { renewedAccessToken } = await authFetch('/auth/me', { signal: controller.signal })
        // Server clock may still consider the token valid; retry shortly.
        if (!cancelled && (!renewedAccessToken || tokenRef.current === accessToken)) {
          timer = setTimeout(refreshAfterExpiry, 5000)
        }
      } catch (error) {
        // Temporary network or server errors must not log the user out.
        if (!cancelled && error.name !== 'AbortError' && error.status !== 401) {
          timer = setTimeout(refreshAfterExpiry, RETRY_DELAY_MS)
        }
      }
    }

    timer = setTimeout(refreshAfterExpiry, expiryDelay(accessToken))
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [accessToken, authFetch])

  const login = useCallback(async (credentials) => {
    const generation = ++generationRef.current
    const { data } = await requestAuth('/auth/login', { method: 'POST', body: credentials, token: tokenRef.current })
    if (!data.accessToken) throw new Error('Login response did not include an access token.')
    if (generation === generationRef.current) {
      storeToken(data.accessToken)
      setUser(data.user)
      setReady(true)
    }
    return data
  }, [storeToken])

  const logout = useCallback(async (allDevices = false) => {
    const generation = ++generationRef.current
    const path = allDevices ? '/auth/logout-all' : '/auth/logout'
    try {
      await requestAuth(path, { method: 'POST', token: tokenRef.current })
      if (generation === generationRef.current) clearAuth()
    } catch (error) {
      if (error.status === 401 && generation === generationRef.current) clearAuth()
      throw error
    }
  }, [clearAuth])

  const value = useMemo(() => ({ user, accessToken, ready, login, logout, authFetch }), [user, accessToken, ready, login, logout, authFetch])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
