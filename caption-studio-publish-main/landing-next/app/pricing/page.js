import { CtaBand } from '@/components/CtaBand'
import { JsonLd } from '@/components/JsonLd'
import { PageHero } from '@/components/PageHero'
import { appUrl, pageMetadata, siteUrl } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Pricing',
  description: 'Compare Lekha Captions plans for creators, agencies, and businesses. Get 115+ languages, animated caption styles, video editing, and high-quality export.',
  path: '/pricing',
})

// Yearly is the default everywhere (in-app pricing, the home pricing section and
// this page), so the headline figure here is the annual one and the monthly rate
// is the secondary line. Keep the amounts in step with
// landing-next/components/HomePricingSection.jsx.
const plans = [
  {
    name: 'Starter',
    price: '$39.99',
    inr: '₹2,500',
    monthlyPrice: '$3.99',
    monthlyInr: '₹299',
    savings: '~16% off monthly',
    description: 'A simple start for a steady social workflow.',
    features: ['180 video credits / year', 'Up to 2 minutes per video', '3 videos per day', '100+ caption styles', '115+ languages', '1080p HD export', 'No watermark'],
  },
  {
    name: 'Creator',
    price: '$49.99',
    inr: '₹4,500',
    monthlyPrice: '$4.99',
    monthlyInr: '₹499',
    savings: '~16% off monthly',
    description: 'The sweet spot for serious, multilingual creators.',
    popular: true,
    features: ['540 video credits / year', 'Up to 3 minutes per video', '5 videos per day', '100+ caption styles', '115+ languages', '1080p HD + 4K export', 'Translation tools', 'No watermark'],
  },
  {
    name: 'Pro',
    price: '$59.99',
    inr: '₹6,500',
    monthlyPrice: '$5.99',
    monthlyInr: '₹799',
    savings: '~17% off monthly',
    description: 'More capacity for agencies and high-volume output.',
    features: ['1,440 video credits / year', 'Up to 3 minutes per video', 'Unlimited videos per day', '100+ caption styles', '115+ languages', '1080p HD + 4K export', 'Translation tools', 'No watermark'],
  },
]

const comparison = [
  ['Yearly video credits', '180', '540', '1,440'],
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
          <div className="pricing-note">Yearly prices shown • Monthly billing is also available in the app</div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`price-card${plan.popular ? ' popular' : ''}`} key={plan.name}>
                {plan.popular && <span className="popular-label">MOST POPULAR</span>}
                <p className="price-kicker">{plan.name}</p>
                <h2>{plan.price}<small>/year</small></h2>
                <p className="usd-price">or {plan.inr}/year where local currency billing is available · {plan.savings}</p>
                <p className="usd-price">Prefer monthly? {plan.monthlyPrice}/month (or {plan.monthlyInr}/month)</p>
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
          <p className="pricing-disclaimer">Prices and plan availability may vary by region. Before payment authorization, checkout shows the final billing currency, applicable taxes, total payable amount, annual discount, and current purchase terms. Plans are one-time purchases and do not auto-renew.</p>
        </div>
      </section>
      <CtaBand title="Pick a plan when your workflow is ready." body="Start in the editor, experience the multilingual caption workflow, and choose the capacity that matches your output." />
    </>
  )
}
