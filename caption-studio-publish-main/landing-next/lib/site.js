export const siteUrl = 'https://lekhacaptions.com'
export const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lekhacaptions.com/Dashboard?entry=editor'
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@lekhacaptions.com'
export const legalBusinessName = process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME || 'Lekha Captions'
export const legalBusinessAddress = process.env.NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS || 'Business address available from support'
export const governingVenue = process.env.NEXT_PUBLIC_GOVERNING_VENUE || 'India'
export const grievanceOfficerName = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || 'Grievance Officer'
export const grievanceEmail = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || supportEmail

export const siteDescription =
  'Create polished, animated video captions in languages from around the world with an editor built for creators, agencies, and businesses.'

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
      locale: 'en_US',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lekha Captions animated multilingual captions' }],
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
