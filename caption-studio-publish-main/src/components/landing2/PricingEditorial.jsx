import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { createPageUrl } from '@/utils'
import { useAuth } from '@/lib/AuthContext'
import { toast } from '@/components/ui/use-toast'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'
import SectionHeader from './SectionHeader'

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const createIdempotencyKey = (scope, planId) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${scope}:${planId}:${crypto.randomUUID()}`
  }
  return `${scope}:${planId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setTimeout(() => resolve(true), 100)
    script.onerror = () => reject(new Error('Failed to load Razorpay'))
    document.head.appendChild(script)
  })
}

const detectInternationalUser = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const lang = navigator.language || ''
    const indianTZ = ['Asia/Calcutta', 'Asia/Kolkata']
    const indianLangs = ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'as', 'ur']
    const isIndian = indianTZ.includes(tz) || indianLangs.some(l => lang.startsWith(l))
    return !isIndian
  } catch { return false }
}

function getDiscountPercent(monthlyMinor, yearlyMinor) {
  const baseline = monthlyMinor * 12
  if (!baseline || !yearlyMinor) return 0
  return Math.round((1 - (yearlyMinor / baseline)) * 100)
}

function formatInrPrice(minor) {
  return `₹${Math.round(minor / 100)}`
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyUsdPrice: '$3.99', yearlyUsdPrice: '$39.99',
    monthlyPaise: 29900, yearlyPaise: 250000,
    monthlyUsdCents: 399, yearlyUsdCents: 3999,
    credits: 15,
    description: 'Perfect for getting started',
    features: [
      '15 video credits / month',
      'Max 2 min per video',
      'Max 3 videos / day',
      'No watermark',
      '25+ caption styles',
      'All 115+ languages',
      '1080p HD export',
      '2 hr download link'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    id: 'creator',
    name: 'Creator',
    monthlyUsdPrice: '$4.99', yearlyUsdPrice: '$49.99',
    monthlyPaise: 49900, yearlyPaise: 450000,
    monthlyUsdCents: 499, yearlyUsdCents: 4999,
    credits: 45,
    description: 'Best value for serious creators',
    features: [
      '45 video credits / month',
      'Max 3 min per video',
      'Max 5 videos / day',
      'No watermark',
      '25+ caption styles',
      'All 115+ languages',
      '1080p HD + 4K export',
      'Translation feature',
      '24 hr download link'
    ],
    cta: 'Go Creator',
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyUsdPrice: '$5.99', yearlyUsdPrice: '$59.99',
    monthlyPaise: 79900, yearlyPaise: 650000,
    monthlyUsdCents: 599, yearlyUsdCents: 5999,
    credits: 120,
    description: 'For power users & teams',
    features: [
      '120 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      'No watermark',
      '25+ caption styles',
      'All 115+ languages',
      '1080p HD + 4K export',
      'Translation feature',
      'API access · 3 team seats',
      '72 hr download link'
    ],
    cta: 'Go Pro',
    popular: false
  }
]

const YEARLY_CREDIT_MULTIPLIER = 12

function getPlanCredits(plan, billing) {
  return billing === 'yearly' ? plan.credits * YEARLY_CREDIT_MULTIPLIER : plan.credits
}

function getCreditPeriodLabel(billing) {
  return billing === 'yearly' ? 'year' : 'month'
}

function getPlanFeatures(plan, billing) {
  const creditsLabel = `${getPlanCredits(plan, billing)} video credits / ${getCreditPeriodLabel(billing)}`
  return [creditsLabel, ...plan.features.slice(1)]
}

const COMPARISON_ROWS = (billing) => [
  [
    billing === 'yearly' ? 'Yearly Credits' : 'Monthly Credits',
    String(getPlanCredits(plans[0], billing)),
    String(getPlanCredits(plans[1], billing)),
    String(getPlanCredits(plans[2], billing))
  ],
  ['Max Video Length', '2 min', '3 min', '3 min'],
  ['Daily Limit', '3/day', '5/day', 'Unlimited'],
  ['Export Quality', '1080p', '1080p + 4K', '1080p + 4K'],
  ['Languages', '115+', '115+', '115+'],
  ['Translation', '—', '✓', '✓'],
  ['API Access', '—', '—', '✓'],
  ['Team Seats', '—', '—', '3'],
  ['Download Link Valid', '2 hours', '24 hours', '72 hours']
]

export default function PricingEditorial() {
  const [processingPlan, setProcessingPlan] = useState(null)
  const [billing, setBilling] = useState('monthly')
  const [isInternational, setIsInternational] = useState(false)
  const maxYearlyDiscount = isInternational
    ? Math.max(...plans.map((plan) => getDiscountPercent(plan.monthlyUsdCents, plan.yearlyUsdCents)))
    : Math.max(...plans.map((plan) => getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)))
  const { currentUser } = useAuth()

  useEffect(() => {
    loadRazorpayScript().catch(() => {})
    setIsInternational(detectInternationalUser())
  }, [])

  const handleSelectPlan = async (plan) => {
    setProcessingPlan(plan.id)

    try {
      await loadRazorpayScript()
      if (!window.Razorpay) {
        toast({ variant: 'destructive', title: 'Payment system unavailable', description: 'Please refresh and try again.' })
        setProcessingPlan(null)
        return
      }

      const planId = billing === 'yearly' ? `${plan.id}_yearly` : plan.id
      const currency = isInternational ? 'USD' : 'INR'
      const amount = billing === 'yearly'
        ? (currency === 'USD' ? plan.yearlyUsdCents : plan.yearlyPaise)
        : (currency === 'USD' ? plan.monthlyUsdCents : plan.monthlyPaise)
      let keyId = RAZORPAY_KEY_ID
      const paymentAttemptKey = createIdempotencyKey('landing-plan', planId)

      if (!currentUser) {
        toast({ variant: 'destructive', title: 'Login required', description: 'Please log in first to purchase a plan.' })
        window.location.href = createPageUrl('Login')
        setProcessingPlan(null)
        return
      }

      const idToken = await currentUser.getIdToken(true)
      const orderData = await apiRequest(`${API_BASE}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan_id: planId, id_token: idToken, currency, idempotency_key: paymentAttemptKey })
      })
      if (!orderData.success) throw new Error(orderData.error || 'Failed to create payment order')
      if (!orderData.order?.id) {
        throw new Error('Unable to create a secure payment order. Please try again.')
      }
      keyId = orderData.key_id || keyId
      if (!keyId) {
        throw new Error('Razorpay payment key is not set. Please configure VITE_RAZORPAY_KEY_ID.')
      }

      const options = {
        key: keyId,
        amount: orderData.order.amount || amount,
        currency,
        order_id: orderData.order.id,
        name: 'Lekha Captions',
        description: `${plan.name} Plan${billing === 'yearly' ? ' · Yearly' : ''}`,
        prefill: {
          name: currentUser?.displayName || '',
          email: currentUser?.email || ''
        },
        theme: { color: '#F5A623' },
        handler: async (response) => {
          try {
            const data = await apiRequest(`${API_BASE}/api/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                id_token: idToken,
                plan_id: planId,
                idempotency_key: paymentAttemptKey
              })
            })
            if (data.success) {
              toast({ title: 'Payment successful', description: 'Credits added to your account.' })
              window.location.href = createPageUrl('Dashboard')
            } else {
              toast({ variant: 'destructive', title: 'Payment verification failed', description: 'Please contact support.' })
            }
          } catch (err) {
            console.error('Verify error:', err)
            notifyApiError(err, 'Payment verification error')
          }
          setProcessingPlan(null)
        },
        modal: {
          ondismiss: () => setProcessingPlan(null)
        }
      }

      const razorpay = new window.Razorpay(options)
      razorpay.on('payment.failed', (resp) => {
        console.error('Payment failed:', resp.error)
        setProcessingPlan(null)
      })
      razorpay.open()
    } catch (error) {
      console.error('Payment initiation failed:', error)
      notifyApiError(error, 'Payment initiation failed')
      setProcessingPlan(null)
    }
  }

  const priceFor = (plan) => {
    if (billing === 'yearly') {
      return isInternational ? plan.yearlyUsdPrice : formatInrPrice(plan.yearlyPaise)
    }
    return isInternational ? plan.monthlyUsdPrice : formatInrPrice(plan.monthlyPaise)
  }

  return (
    <section id="pricing" aria-label="Pricing" className="bg-[#111111] py-28">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          index="04"
          kicker="PRICING"
          title="Priced for creators, not studios."
          blurb="Transparent plans that scale with your posting schedule. Pay in ₹ or $, cancel anytime."
        />

        {/* billing toggle */}
        <div className="flex items-center gap-1 mb-14 border border-white/10 rounded-full p-1 w-fit bg-[#0D0D0D]">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              billing === 'monthly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
              billing === 'yearly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Yearly
            <span className="font-mono text-[10px] tracking-wide px-2 py-0.5 rounded-full lv2-gold-bg text-black">
              SAVE {maxYearlyDiscount}%
            </span>
          </button>
        </div>

        {/* plans */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-white/10 rounded-3xl md:border md:border-white/10 md:bg-[#0D0D0D] overflow-visible">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative flex flex-col p-8 lg:p-10 rounded-3xl md:rounded-none ${
                plan.popular
                  ? 'bg-gradient-to-b from-[#F5A623]/[0.08] to-transparent border border-[#F5A623]/30 md:border-y-0 md:border-x md:border-[#F5A623]/30 md:-my-px'
                  : 'border border-white/10 md:border-0 bg-[#0D0D0D] md:bg-transparent'
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[3px] lv2-gold-bg md:rounded-none rounded-t-3xl" aria-hidden="true" />
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.25em] px-4 py-1 rounded-full lv2-gold-bg text-black font-semibold">
                    MOST POPULAR
                  </span>
                </>
              )}

              <p className="font-mono text-[11px] tracking-[0.3em] text-[#949494] mb-6">
                {String(idx + 1).padStart(2, '0')} / {plan.name.toUpperCase()}
              </p>

              <div className="flex items-baseline gap-2">
                <span className="lv2-display text-5xl lg:text-6xl text-white">{priceFor(plan)}</span>
                <span className="text-[#949494] text-sm">{billing === 'yearly' ? '/yr' : '/mo'}</span>
              </div>
              {billing === 'yearly' ? (
                <p className="mt-2 text-xs text-[#F5A623]">
                  billed yearly · ~{isInternational
                    ? getDiscountPercent(plan.monthlyUsdCents, plan.yearlyUsdCents)
                    : getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)}% off
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#949494]">{plan.description}</p>
              )}

              <div className="my-7 h-px bg-white/10" aria-hidden="true" />

              <ul className="space-y-3 flex-1 mb-10">
                {getPlanFeatures(plan, billing).map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/85">
                    <Check className="w-4 h-4 text-[#F5A623] shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={processingPlan === plan.id}
                className={`w-full py-4 rounded-full font-semibold text-sm transition-all flex items-center justify-center ${
                  plan.popular
                    ? 'lv2-gold-bg text-black hover:brightness-110'
                    : 'border border-white/20 text-white hover:bg-white/5 hover:border-white/40'
                }`}
              >
                {processingPlan === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 rounded-3xl border border-white/10 overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/10 bg-[#0D0D0D]">
            <p className="font-mono text-[11px] tracking-[0.3em] text-[#949494]">FULL COMPARISON</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0B0B0C]">
                  <th className="text-left p-4 font-mono text-[11px] tracking-[0.2em] text-[#949494] font-medium">FEATURE</th>
                  {plans.map((p) => (
                    <th key={p.id} className={`text-center p-4 font-semibold ${p.popular ? 'text-[#F5A623]' : 'text-white'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COMPARISON_ROWS(billing).map(([feature, starter, creator, pro], i) => (
                  <tr key={i} className="hover:bg-white/[0.03]">
                    <td className="p-4 text-white/85">{feature}</td>
                    <td className="p-4 text-center text-[#949494]">{starter}</td>
                    <td className="p-4 text-center text-white font-medium">{creator}</td>
                    <td className="p-4 text-center text-white font-medium">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
