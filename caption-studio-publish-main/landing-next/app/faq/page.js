import Link from 'next/link'
import { CtaBand } from '@/components/CtaBand'
import { JsonLd } from '@/components/JsonLd'
import { PageHero } from '@/components/PageHero'
import { faqs } from '@/lib/faq'
import { pageMetadata, siteUrl } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Frequently asked questions',
  description: 'Answers about Lekha Captions languages, video formats, caption editing, animated styles, exports, privacy, and getting started.',
  path: '/faq',
})

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${siteUrl}/faq/`,
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <PageHero eyebrow="Questions, answered" title="Everything you need to know." description="A quick guide to multilingual captioning, creative control, exports, and the Lekha workflow." />
      <section className="content-section">
        <div className="container narrow faq-list">
          {faqs.map(({ question, answer }, index) => (
            <details key={question} open={index === 0}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
          <div className="still-stuck"><h2>Still have a question?</h2><p>Browse practical setup and troubleshooting guidance in the help center.</p><Link className="text-link gold-link" href="/help/">Visit help center <span>→</span></Link></div>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
