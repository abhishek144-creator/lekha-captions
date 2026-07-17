'use client'

import { useEffect, useState } from 'react'
import { appUrl } from '@/lib/site'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPaise: 29900,
    yearlyPaise: 250000,
    monthlyUsdCents: 399,
    yearlyUsdCents: 3999,
    credits: 15,
    description: 'Perfect for getting started',
    icon: 'zap',
    features: [
      '15 video credits / month',
      'Max 2 min per video',
      'Max 3 videos / day',
      'No watermark',
      '100+ caption styles',
      'All 115+ languages',
      '1080p HD export',
      '2 hr download link',
    ],
    cta: 'Get Started',
  },
  {
    id: 'creator',
    name: 'Creator',
    monthlyPaise: 49900,
    yearlyPaise: 450000,
    monthlyUsdCents: 499,
    yearlyUsdCents: 4999,
    credits: 45,
    description: 'Best value for serious creators',
    icon: 'crown',
    features: [
      '45 video credits / month',
      'Max 3 min per video',
      'Max 5 videos / day',
      'No watermark',
      '100+ caption styles',
      'All 115+ languages',
      '1080p HD + 4K export',
      'Translation feature',
      '24 hr download link',
    ],
    cta: 'Go Creator',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPaise: 79900,
    yearlyPaise: 650000,
    monthlyUsdCents: 599,
    yearlyUsdCents: 5999,
    credits: 120,
    description: 'For high-volume creators',
    icon: 'star',
    features: [
      '120 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      'No watermark',
      '100+ caption styles',
      'All 115+ languages',
      '1080p HD + 4K export',
      'Translation feature',
      '72 hr download link',
    ],
    cta: 'Go Pro',
  },
]

const YEARLY_CREDIT_MULTIPLIER = 12
const INDIAN_LANGUAGES = ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'as', 'ur']

function getDiscountPercent(monthlyMinor, yearlyMinor) {
  const baseline = monthlyMinor * 12
  if (!baseline || !yearlyMinor) return 0
  return Math.round((1 - yearlyMinor / baseline) * 100)
}

function formatInr(minor) {
  return `\u20B9${Math.round(minor / 100)}`
}

function formatUsd(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

function detectInternationalUser() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const lang = navigator.language || ''
    const isIndian = ['Asia/Calcutta', 'Asia/Kolkata'].includes(tz) || INDIAN_LANGUAGES.some((value) => lang.startsWith(value))
    return !isIndian
  } catch {
    return false
  }
}

function getPlanCredits(plan, billing) {
  return billing === 'yearly' ? plan.credits * YEARLY_CREDIT_MULTIPLIER : plan.credits
}

function getCreditPeriodLabel(billing) {
  return billing === 'yearly' ? 'year' : 'month'
}

function getPlanFeatures(plan, billing) {
  return [`${getPlanCredits(plan, billing)} video credits / ${getCreditPeriodLabel(billing)}`, ...plan.features.slice(1)]
}

function PricingIcon({ kind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.8' }

  if (kind === 'crown') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path {...common} d="M4 18h16l-1.4-8-4.1 3-2.5-5-2.5 5-4.1-3L4 18Z" />
      </svg>
    )
  }

  if (kind === 'star') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3 2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.6 6.2 20.7l1.1-6.4L2.6 9.8l6.5-.9L12 3Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path {...common} d="M12 3v6l4-4m-4 4L8 5m4 4v12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

export function HomePricingSection() {
  const [billing, setBilling] = useState('monthly')
  const [selectedPlan, setSelectedPlan] = useState('creator')
  const [isInternational, setIsInternational] = useState(false)

  useEffect(() => {
    setIsInternational(detectInternationalUser())
  }, [])

  const maxYearlyDiscount = isInternational
    ? Math.max(...plans.map((plan) => getDiscountPercent(plan.monthlyUsdCents, plan.yearlyUsdCents)))
    : Math.max(...plans.map((plan) => getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)))

  return (
    <section className="sync-section sync-pricing" aria-label="Pricing">
      <div className="sync-pricing-glow" aria-hidden="true" />
      <div className="container sync-pricing-shell">
        <div className="sync-section-heading">
          <p className="eyebrow">Creator-friendly pricing</p>
          <h2>Simple plans. Serious output.</h2>
          <p>Choose the plan that fits your content schedule.</p>
        </div>

        <div className="sync-pricing-toggle" role="tablist" aria-label="Billing period">
          <button className={billing === 'monthly' ? 'is-active' : ''} onClick={() => setBilling('monthly')} type="button">
            Monthly
          </button>
          <button className={billing === 'yearly' ? 'is-active' : ''} onClick={() => setBilling('yearly')} type="button">
            <span>Yearly</span>
            <b>Save up to {maxYearlyDiscount}%</b>
          </button>
        </div>

        <div className="sync-pricing-grid">
          {plans.map((plan) => {
            const selected = selectedPlan === plan.id
            const price = billing === 'yearly'
              ? (isInternational ? formatUsd(plan.yearlyUsdCents) : formatInr(plan.yearlyPaise))
              : (isInternational ? formatUsd(plan.monthlyUsdCents) : formatInr(plan.monthlyPaise))
            const cadence = billing === 'yearly' ? '/yr' : '/mo'
            const note = billing === 'yearly'
              ? (
                isInternational
                  ? `${formatUsd(plan.yearlyUsdCents)} billed yearly · ~${getDiscountPercent(plan.monthlyUsdCents, plan.yearlyUsdCents)}% off`
                  : `${formatInr(plan.yearlyPaise)} billed yearly · ~${getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)}% off`
              )
              : ''

            return (
              <article
                className={`sync-pricing-card${plan.popular ? ' is-popular' : ''}${selected ? ' is-selected' : ''}`}
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && <span className="sync-popular-pill">Most Popular</span>}
                <div className={`sync-pricing-icon${plan.popular ? ' invert' : ''}`}>
                  <PricingIcon kind={plan.icon} />
                </div>
                <h3>{plan.name}</h3>
                <p className="sync-plan-description">{plan.description}</p>
                <div className="sync-price-row">
                  <strong>{price}</strong>
                  <span>{cadence}</span>
                </div>
                <p className={`sync-price-note${note ? ' is-visible' : ''}`}>{note || '\u00A0'}</p>
                <ul>
                  {getPlanFeatures(plan, billing).map((feature) => (
                    <li key={`${plan.id}-${billing}-${feature}`}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a className={`sync-pricing-cta${plan.popular ? ' primary' : ''}`} href={appUrl}>
                  {plan.cta}
                </a>
              </article>
            )
          })}
        </div>

        <div className="sync-comparison">
          <div className="sync-comparison-head">
            <h3>Compare every plan</h3>
            <p>Everything you need to choose your creative cadence.</p>
          </div>
          <div className="sync-comparison-table-wrap">
            <table className="sync-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Starter</th>
                  <th>Creator</th>
                  <th>Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    billing === 'yearly' ? 'Yearly Credits' : 'Monthly Credits',
                    String(getPlanCredits(plans[0], billing)),
                    String(getPlanCredits(plans[1], billing)),
                    String(getPlanCredits(plans[2], billing)),
                  ],
                  ['Max Video Length', '2 min', '3 min', '3 min'],
                  ['Daily Limit', '3/day', '5/day', 'Unlimited'],
                  ['Export Quality', '1080p', '1080p + 4K', '1080p + 4K'],
                  ['Languages', '115+', '115+', '115+'],
                  ['Translation', '—', '✓', '✓'],
                  ['Download Link Valid', '2 hours', '24 hours', '72 hours'],
                ].map(([feature, starter, creator, pro]) => (
                  <tr key={feature}>
                    <td>{feature}</td>
                    <td>{starter}</td>
                    <td>{creator}</td>
                    <td>{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
