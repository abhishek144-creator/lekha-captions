import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, Zap, Crown, Star, Loader2 } from 'lucide-react'
import { createPageUrl } from '@/utils'
import { useAuth } from '@/lib/AuthContext'
import { toast } from '@/components/ui/use-toast'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'
import planCatalog from '../../../shared/planCatalog.json'

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
  return String(Math.round(minor / 100))
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyInrPrice: formatInrPrice(planCatalog.starter.inr_paise), yearlyInrPrice: formatInrPrice(planCatalog.starter_yearly.inr_paise),
    monthlyUsdPrice: `$${(planCatalog.starter.usd_cents / 100).toFixed(2)}`, yearlyUsdPrice: `$${(planCatalog.starter_yearly.usd_cents / 100).toFixed(2)}`,
    monthlyPaise: planCatalog.starter.inr_paise, yearlyPaise: planCatalog.starter_yearly.inr_paise,
    monthlyUsdCents: planCatalog.starter.usd_cents, yearlyUsdCents: planCatalog.starter_yearly.usd_cents,
    credits: planCatalog.starter.credits,
    description: 'Perfect for getting started',
    icon: Zap,
    features: [
      '15 video credits / month',
      'Max 2 min per video',
      'Max 3 videos / day',
      'No watermark',
      '25+ caption styles',
      'All 115+ languages',
      '1080p HD export',
      '2 hr download link',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'creator',
    name: 'Creator',
    monthlyInrPrice: formatInrPrice(planCatalog.creator.inr_paise), yearlyInrPrice: formatInrPrice(planCatalog.creator_yearly.inr_paise),
    monthlyUsdPrice: `$${(planCatalog.creator.usd_cents / 100).toFixed(2)}`, yearlyUsdPrice: `$${(planCatalog.creator_yearly.usd_cents / 100).toFixed(2)}`,
    monthlyPaise: planCatalog.creator.inr_paise, yearlyPaise: planCatalog.creator_yearly.inr_paise,
    monthlyUsdCents: planCatalog.creator.usd_cents, yearlyUsdCents: planCatalog.creator_yearly.usd_cents,
    credits: planCatalog.creator.credits,
    description: 'Best value for serious creators',
    icon: Crown,
    features: [
      '45 video credits / month',
      'Max 3 min per video',
      'Max 5 videos / day',
      'No watermark',
      '25+ caption styles',
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
    monthlyInrPrice: formatInrPrice(planCatalog.pro.inr_paise), yearlyInrPrice: formatInrPrice(planCatalog.pro_yearly.inr_paise),
    monthlyUsdPrice: `$${(planCatalog.pro.usd_cents / 100).toFixed(2)}`, yearlyUsdPrice: `$${(planCatalog.pro_yearly.usd_cents / 100).toFixed(2)}`,
    monthlyPaise: planCatalog.pro.inr_paise, yearlyPaise: planCatalog.pro_yearly.inr_paise,
    monthlyUsdCents: planCatalog.pro.usd_cents, yearlyUsdCents: planCatalog.pro_yearly.usd_cents,
    credits: planCatalog.pro.credits,
    description: 'For high-volume creators',
    icon: Star,
    features: [
      '120 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      'No watermark',
      '25+ caption styles',
      'All 115+ languages',
      '1080p HD + 4K export',
      'Translation feature',
      '72 hr download link',
    ],
    cta: 'Go Pro',
    popular: false,
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

export default function PricingSection() {
  const [processingPlan, setProcessingPlan] = useState(null)
  const [billing, setBilling] = useState('monthly')
  const [selectedPlan, setSelectedPlan] = useState(null)
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
        description: `${plan.name} Plan${billing === 'yearly' ? ' Â· Yearly' : ''}`,
        prefill: {
          name: currentUser?.displayName || '',
          email: currentUser?.email || ''
        },
        theme: { color: '#F5A623' },
        handler: async (response) => {
          try {
            const verifyToken = await currentUser.getIdToken(true)
            const data = await apiRequest(`${API_BASE}/api/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${verifyToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                id_token: verifyToken,
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
            toast({
              title: 'Payment received',
              description: 'Verification is still pending. Your account will update automatically after reconciliation.',
            })
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

  return (
    <section id="pricing" aria-label="Pricing" className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute right-1/4 top-20 h-64 w-64 rounded-full bg-[#BF953F]/10 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5A623]">Creator-friendly pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Simple plans. Serious output.
          </h2>
          <p className="mt-4 text-[#949494] mb-8">
            Choose the plan that fits your content schedule.
          </p>

          {/* Billing Toggle */}
          <div className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-[#1A1A1A] p-1 mx-auto mb-8">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'yearly'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="rounded-full bg-[#F5A623] px-1.5 py-0.5 text-xs font-semibold text-black">Save up to {maxYearlyDiscount}%</span>
            </button>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="relative flex cursor-pointer flex-col rounded-2xl bg-[#11100f]/75 p-6 backdrop-blur-xl md:p-8"
              onClick={() => setSelectedPlan(plan.id)}
              style={(plan.popular || selectedPlan === plan.id) ? {
                background: 'linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%) border-box',
                border: '2px solid transparent',
                boxShadow: '0 0 20px rgba(191,149,63,0.15)'
              } : { border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full text-black text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%)' }}>
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl ${plan.popular ? 'bg-white' : 'bg-zinc-800'} flex items-center justify-center mb-6`}>
                <plan.icon className={`w-6 h-6 ${plan.popular ? 'text-black' : 'text-white'}`} />
              </div>

              <h3 className="text-base md:text-xl font-semibold text-white mb-1">{plan.name}</h3>
              <p className="text-[#949494] text-sm mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl md:text-4xl font-bold text-white">
                  {billing === 'yearly'
                    ? (isInternational ? plan.yearlyUsdPrice : `₹${formatInrPrice(plan.yearlyPaise)}`)
                    : (isInternational ? plan.monthlyUsdPrice : `₹${formatInrPrice(plan.monthlyPaise)}`)}
                </span>
                <span className="text-gray-400">{billing === 'yearly' ? '/yr' : '/mo'}</span>
              </div>
              {billing === 'yearly' ? (
                <p className="text-xs text-[#F5A623] mb-5">
                  {isInternational
                    ? `${plan.yearlyUsdPrice} billed yearly · ~${getDiscountPercent(plan.monthlyUsdCents, plan.yearlyUsdCents)}% off`
                    : `₹${formatInrPrice(plan.yearlyPaise)} billed yearly · ~${getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)}% off`}
                </p>
              ) : (
                <div className="mb-5" />
              )}

              <ul className="mb-10 flex-1 space-y-3">
                {getPlanFeatures(plan, billing).map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white">
                    <Check className="w-4 h-4 text-[#F5A623] flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan)}
                disabled={processingPlan === plan.id}
                className={`mt-auto w-full py-6 rounded-[4px] font-semibold ${plan.popular
                  ? 'bg-white hover:bg-gray-100 text-black'
                  : 'bg-transparent border border-white text-white hover:bg-white/10'
                }`}
              >
                {processingPlan === plan.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  plan.cta
                )}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 overflow-hidden rounded-2xl border border-white/10 bg-[#11100f]/75 backdrop-blur-xl"
        >
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Compare every plan</h3>
            <p className="mt-1 text-sm text-[#949494]">Everything you need to choose your creative cadence.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161616]">
                  <th className="text-left p-4 text-[#949494] font-medium">Feature</th>
                  <th className="text-center p-4 text-white font-semibold">Starter</th>
                  <th className="text-center p-4 text-white font-semibold">Creator</th>
                  <th className="text-center p-4 text-white font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
                ].map(([feature, starter, creator, pro], i) => (
                  <tr key={i} className="hover:bg-zinc-800/30">
                    <td className="p-4 text-white">{feature}</td>
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
