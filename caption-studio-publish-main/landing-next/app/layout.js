import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { siteDescription, siteUrl } from '@/lib/site'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Lekha Captions — Animated captions in 115+ languages',
    template: '%s | Lekha Captions',
  },
  description: siteDescription,
  applicationName: 'Lekha Captions',
  authors: [{ name: 'Lekha Captions', url: siteUrl }],
  creator: 'Lekha Captions',
  publisher: 'Lekha Captions',
  category: 'Video editing software',
  icons: {
    icon: '/lekha-icon.svg',
    shortcut: '/lekha-icon.svg',
    apple: '/lekha-icon.svg',
  },
  openGraph: {
    title: 'Lekha Captions — Animated captions in 115+ languages',
    description: siteDescription,
    url: '/',
    siteName: 'Lekha Captions',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lekha Captions animated captions in 115+ languages' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lekha Captions — Animated captions in 115+ languages',
    description: siteDescription,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
