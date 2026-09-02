import Link from 'next/link'
import { PageHero } from '@/components/PageHero'
import { pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Acceptable use policy',
  description: 'The content, safety, rights, and platform-integrity rules that apply when using Lekha Captions.',
  path: '/acceptable-use',
})

const sections = [
  ['Rights and consent', 'Upload only media you own or are authorized to process. Obtain any permissions required from speakers, performers, subjects, or rights holders.'],
  ['Prohibited content', 'Do not use the Service for unlawful material, sexual exploitation, non-consensual intimate imagery, credible threats, targeted harassment, fraud, impersonation, or content that infringes another person’s rights.'],
  ['Platform integrity', 'Do not bypass quotas, probe other accounts, distribute malware, automate abusive traffic, interfere with service operation, or attempt unauthorized access.'],
  ['Enforcement', 'We may reject files, restrict processing, suspend accounts, preserve limited evidence, or report conduct when necessary for safety, platform integrity, or legal compliance.'],
  ['Reporting', `Report suspected abuse or security problems to ${supportEmail}. Include only the information needed to investigate and do not email sensitive credentials.`],
]

export default function AcceptableUsePage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Acceptable use policy" description="Rules that protect creators, rights holders, customers, and the service." />
      <article className="legal-content container narrow">
        <p className="legal-date">Version 2026-09-02 • Effective September 2, 2026</p>
        {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <p className="legal-crosslink">See also our <Link href="/terms/">Terms and Conditions</Link> and <Link href="/privacy/">Privacy Policy</Link>.</p>
      </article>
    </>
  )
}
