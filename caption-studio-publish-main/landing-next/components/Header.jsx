import Link from 'next/link'
import { appUrl } from '@/lib/site'
import { Brand } from './Brand'

const nav = [
  ['FAQ', '/faq/'],
  ['Help & Support', '/help/'],
  ['Terms', '/terms/'],
]

export function Header() {
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className="nav-actions">
          <a className="button button-small button-outline" href={appUrl}>
            <span className="desktop-cta-label">Open editor</span>
            <span className="mobile-cta-label">Try free</span>
          </a>
        </div>
      </div>
    </header>
  )
}
