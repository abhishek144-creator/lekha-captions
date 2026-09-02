import { PageHero } from '@/components/PageHero'
import { StatusClient } from '@/components/StatusClient'
import { pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Service status',
  description: 'Current availability and readiness checks for Lekha Captions production services.',
  path: '/status',
})

export default function StatusPage() {
  return (
    <>
      <PageHero
        eyebrow="Service status"
        title="Live production availability."
        description="Direct checks from this independently hosted page show whether the API and processing dependencies are ready for customers."
      />
      <section className="content-section">
        <div className="container status-layout">
          <StatusClient />
          <aside className="status-support">
            <p className="eyebrow">Need help?</p>
            <h2>Report a customer-impacting issue.</h2>
            <p>If your account is affected while these checks appear healthy, include the time, action, and any request reference in your message.</p>
            <a className="button button-outline" href={`mailto:${supportEmail}`}>Email support</a>
          </aside>
        </div>
      </section>
    </>
  )
}
