import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap() {
  const routes = ['/', '/pricing/', '/faq/', '/help/', '/status/', '/terms/', '/privacy/', '/refund/', '/acceptable-use/']

  return routes.map((route) => ({
    url: `${siteUrl}${route === '/' ? '' : route}`,
    lastModified: new Date('2026-07-14'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/pricing/' ? 0.9 : 0.7,
  }))
}
