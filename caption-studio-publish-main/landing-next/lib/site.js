export const siteUrl = 'https://lekhacaptions.com'
export const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lekhacaptions.com'
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@lekhacaptions.com'

export const siteDescription =
  'Create accurate, animated video captions in 115+ languages, including leading Indic languages, with a fast editor built for creators, agencies, and businesses.'

export function pageMetadata({ title, description, path = '/' }) {
  const canonical = path === '/' ? '/' : `${path}/`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lekha Captions',
      locale: 'en_IN',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lekha Captions animated captions in 115+ languages' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
  }
}

export function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
