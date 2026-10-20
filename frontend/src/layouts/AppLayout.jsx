import { useState } from 'react'
import { navigationItems } from '../app/app.routes'
import Brand from '../components/shared/Brand'
import { useAuth } from '../features/auth/useAuth'

export default function AppLayout({ children }) {
  const [activeItem, setActiveItem] = useState('Home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const { user, ready, login, logout } = useAuth()

  const submitLogin = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      await login({ email, password })
      setPassword('')
      setLoginNotice(false)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    setAuthBusy(true)
    setAuthError('')
    try { await logout() } catch (error) { setAuthError(error.message) }
    finally { setAuthBusy(false) }
  }

  const page = children

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="nav-wrap">
          <Brand />
          <button className="mobile-menu" type="button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen((value) => !value)}>
            <span /><span />
          </button>
          <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
            {navigationItems.map((item) => (
              <button key={item} type="button" className={activeItem === item ? 'active' : ''} onClick={() => { setActiveItem(item); setMenuOpen(false) }}>{item}</button>
            ))}
          </nav>
          <div className="header-tools">
            <label className="search-box" title="Search will be enabled when the backend search filter is added"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search coming soon" aria-label="Search anime" disabled /></label>
            {user ? <button className="login-button" type="button" disabled={authBusy} onClick={handleLogout}>Logout</button> : <button className="login-button" type="button" disabled={!ready} onClick={() => { setAuthError(''); setLoginNotice(true) }}>Login <span>→</span></button>}
          </div>
        </div>
      </header>
      {page}
      <footer className="site-footer"><Brand /><span>Discover something unforgettable.</span><span>© 2026 AniVerse</span></footer>
      {authError && !loginNotice && <p className="auth-header-error" role="alert">{authError}</p>}
      {loginNotice && <div className="notice-backdrop" role="presentation" onClick={() => setLoginNotice(false)}><section className="login-notice" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(event) => event.stopPropagation()}><button className="close-notice" type="button" aria-label="Close" onClick={() => setLoginNotice(false)}>×</button><p className="eyebrow"><span />WELCOME BACK</p><h2 id="login-title">Your anime world is waiting.</h2><p>Sign in to your AniVerse account.</p><form className="login-form" onSubmit={submitLogin}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{authError && <p className="auth-form-error" role="alert">{authError}</p>}<button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'} <span>→</span></button></form></section></div>}
    </div>
  )
}
