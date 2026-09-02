import Link from 'next/link'
import { appUrl, supportEmail } from '@/lib/site'
import { Brand } from './Brand'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid footer-grid-current">
        <div className="footer-intro">
          <Brand />
          <p>Professional captions in 115+ languages. Built for every creator.</p>
        </div>
        <div className="footer-link-groups">
          <div className="footer-link-group">
            <h2>Product</h2>
            <Link href="/">Home</Link>
            <a href={appUrl}>Editor</a>
          </div>
          <div className="footer-link-group">
            <h2>Support</h2>
            <Link href="/faq/">FAQ</Link>
            <Link href="/help/">Help & Support</Link>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            <Link href="/terms/">Terms &amp; Conditions</Link>
            <Link href="/privacy/">Privacy Policy</Link>
            <Link href="/refund/">Refund &amp; Cancellation</Link>
            <Link href="/acceptable-use/">Acceptable Use</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>&copy; {new Date().getFullYear()} Lekha Captions. All rights reserved.</p>
        <p>Creator-friendly captions for audiences everywhere</p>
      </div>
    </footer>
  )
}
