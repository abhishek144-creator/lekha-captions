import { CtaBand } from '@/components/CtaBand'
import { JsonLd } from '@/components/JsonLd'
import { PageHero } from '@/components/PageHero'
import { appUrl, pageMetadata, siteUrl } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Pricing',
  description: 'Compare Lekha Captions plans for creators, agencies, and businesses. Get 115+ languages, animated caption styles, video editing, and high-quality export.',
  path: '/pricing',
})

const plans = [
  {
    name: 'Starter',
    price: '₹299',
    usd: '$3.99',
    description: 'A simple start for a steady social workflow.',
    features: ['15 video credits / month', 'Up to 2 minutes per video', '3 videos per day', '100+ caption styles', '115+ languages', '1080p HD export', 'No watermark'],
  },
  {
    name: 'Creator',
    price: '₹499',
    usd: '$4.99',
    description: 'The sweet spot for serious, multilingual creators.',
    popular: true,
    features: ['45 video credits / month', 'Up to 3 minutes per video', '5 videos per day', '100+ caption styles', '115+ languages', '1080p HD + 4K export', 'Translation tools', 'No watermark'],
  },
  {
    name: 'Pro',
    price: '₹799',
    usd: '$5.99',
    description: 'More capacity for agencies and high-volume output.',
    features: ['120 video credits / month', 'Up to 3 minutes per video', 'Unlimited videos per day', '100+ caption styles', '115+ languages', '1080p HD + 4K export', 'Translation tools', 'No watermark'],
  },
]

const comparison = [
  ['Monthly video credits', '15', '45', '120'],
  ['Maximum video length', '2 min', '3 min', '3 min'],
  ['Daily video limit', '3', '5', 'Unlimited'],
  ['Languages', '115+', '115+', '115+'],
  ['Animated styles', '100+', '100+', '100+'],
  ['Export quality', '1080p', '1080p + 4K', '1080p + 4K'],
  ['Translation tools', '—', 'Included', 'Included'],
]

export default function PricingPage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Lekha Captions pricing',
        url: `${siteUrl}/pricing/`,
        description: 'Plans for multilingual animated video captioning.',
      }} />
      <PageHero eyebrow="Creator-friendly pricing" title="Simple plans. Serious output." description="Choose the captioning capacity that fits your publishing cadence. Every plan includes the style library and all 115+ supported languages." />
      <section className="content-section pricing-content">
        <div className="container">
          <div className="pricing-note">Monthly prices shown • Annual options are available in the app</div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`price-card${plan.popular ? ' popular' : ''}`} key={plan.name}>
                {plan.popular && <span className="popular-label">MOST POPULAR</span>}
                <p className="price-kicker">{plan.name}</p>
                <h2>{plan.price}<small>/month</small></h2>
                <p className="usd-price">or {plan.usd}/month for international billing</p>
                <p className="plan-description">{plan.description}</p>
                <a className={`button${plan.popular ? '' : ' button-outline'}`} href={appUrl}>Start creating <span>→</span></a>
                <ul>
                  {plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <div className="comparison-wrap">
            <div className="section-heading"><p className="eyebrow">Compare plans</p><h2>Find the right creative cadence.</h2></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Feature</th><th>Starter</th><th>Creator</th><th>Pro</th></tr></thead>
                <tbody>{comparison.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th key={cell}>{cell}</th> : <td key={`${row[0]}-${cell}-${index}`}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
          <p className="pricing-disclaimer">Prices and plan availability may vary by region. The editor shows the final billing currency, taxes, annual discounts, and current purchase terms before checkout.</p>
        </div>
      </section>
      <CtaBand title="Pick a plan when your workflow is ready." body="Start in the editor, experience the multilingual caption workflow, and choose the capacity that matches your output." />
    </>
  )
}
