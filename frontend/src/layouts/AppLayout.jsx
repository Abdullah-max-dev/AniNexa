import { useState } from 'react'
import { navigationItems } from '../app/app.routes'
import Brand from '../components/shared/Brand'

export default function AppLayout({ children }) {
  const [activeItem, setActiveItem] = useState('Home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState(false)

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
            <button className="login-button" type="button" onClick={() => setLoginNotice(true)}>Login <span>→</span></button>
          </div>
        </div>
      </header>
      {page}
      <footer className="site-footer"><Brand /><span>Discover something unforgettable.</span><span>© 2026 AniVerse</span></footer>
      {loginNotice && <div className="notice-backdrop" role="presentation" onClick={() => setLoginNotice(false)}><section className="login-notice" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(event) => event.stopPropagation()}><button className="close-notice" type="button" aria-label="Close" onClick={() => setLoginNotice(false)}>×</button><p className="eyebrow"><span />COMING SOON</p><h2 id="login-title">Your anime world is waiting.</h2><p>Login and personal watchlists will be available in the next version.</p><button className="primary-button" type="button" onClick={() => setLoginNotice(false)}>Got it <span>→</span></button></section></div>}
    </div>
  )
}
