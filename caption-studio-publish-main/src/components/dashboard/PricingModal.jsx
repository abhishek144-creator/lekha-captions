import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Crown, Zap, Star, Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { toast } from '@/components/ui/use-toast'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'
import planCatalog from '../../../shared/planCatalog.json'

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true)
    return
  }

  const existingScript = document.querySelector('script[data-razorpay-checkout]')
  const script = existingScript || document.createElement('script')
  const timeout = window.setTimeout(() => {
    if (!existingScript) script.remove()
    reject(new Error('Payment checkout took too long to load. Check your connection and try again.'))
  }, 10000)

  script.onload = () => {
    window.clearTimeout(timeout)
    if (window.Razorpay) resolve(true)
    else reject(new Error('Payment checkout did not initialize. Please refresh and try again.'))
  }
  script.onerror = () => {
    window.clearTimeout(timeout)
    if (!existingScript) script.remove()
    reject(new Error('Payment checkout could not load. Check your connection and try again.'))
  }

  if (!existingScript) {
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    document.head.appendChild(script)
  }
})

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
    monthlyPrice: formatInrPrice(planCatalog.starter.inr_paise), yearlyPrice: formatInrPrice(planCatalog.starter_yearly.inr_paise),
    monthlyPaise: planCatalog.starter.inr_paise, yearlyPaise: planCatalog.starter_yearly.inr_paise,
    credits: planCatalog.starter.credits,
    icon: Zap,
    description: 'Perfect for getting started',
    features: [
      '15 video credits / month',
      'Max 2 min per video',
      'Max 3 videos / day',
      'No watermark · 25+ styles',
      'All 115+ languages',
      '2 hr download link',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    monthlyPrice: formatInrPrice(planCatalog.creator.inr_paise), yearlyPrice: formatInrPrice(planCatalog.creator_yearly.inr_paise),
    monthlyPaise: planCatalog.creator.inr_paise, yearlyPaise: planCatalog.creator_yearly.inr_paise,
    credits: planCatalog.creator.credits,
    icon: Crown,
    description: 'Best value for serious creators',
    popular: true,
    features: [
      '45 video credits / month',
      'Max 3 min per video',
      'Max 5 videos / day',
      'No watermark · 25+ styles',
      'All 115+ languages',
      'Translation feature',
      '24 hr download link',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: formatInrPrice(planCatalog.pro.inr_paise), yearlyPrice: formatInrPrice(planCatalog.pro_yearly.inr_paise),
    monthlyPaise: planCatalog.pro.inr_paise, yearlyPaise: planCatalog.pro_yearly.inr_paise,
    credits: planCatalog.pro.credits,
    icon: Star,
    description: 'For high-volume creators',
    features: [
      '120 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      'No watermark · 25+ styles',
      'All 115+ languages',
      'Translation feature',
      '72 hr download link',
    ],
  },
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

const TOPUP_MAP = {
  starter: { plan_id: 'topup_starter', credits: planCatalog.topup_starter.credits, price: formatInrPrice(planCatalog.topup_starter.inr_paise), limit: planCatalog.topup_starter.purchase_limit_30d },
  starter_yearly: { plan_id: 'topup_starter', credits: planCatalog.topup_starter.credits, price: formatInrPrice(planCatalog.topup_starter.inr_paise), limit: planCatalog.topup_starter.purchase_limit_30d },
  creator: { plan_id: 'topup_creator', credits: planCatalog.topup_creator.credits, price: formatInrPrice(planCatalog.topup_creator.inr_paise), limit: planCatalog.topup_creator.purchase_limit_30d },
  creator_yearly: { plan_id: 'topup_creator', credits: planCatalog.topup_creator.credits, price: formatInrPrice(planCatalog.topup_creator.inr_paise), limit: planCatalog.topup_creator.purchase_limit_30d },
  pro: { plan_id: 'topup_pro', credits: planCatalog.topup_pro.credits, price: formatInrPrice(planCatalog.topup_pro.inr_paise), limit: planCatalog.topup_pro.purchase_limit_30d },
  pro_yearly: { plan_id: 'topup_pro', credits: planCatalog.topup_pro.credits, price: formatInrPrice(planCatalog.topup_pro.inr_paise), limit: planCatalog.topup_pro.purchase_limit_30d },
}

function createIdempotencyKey(scope, planId) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${scope}:${planId}:${crypto.randomUUID()}`
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${scope}:${planId}:${hex}`
  }
  throw new Error('Secure random number generation is unavailable. Payment cannot be started safely.')
}

export default function PricingModal({ isOpen, onClose, onSelectPlan, user, message, userData = null }) {
  const [processingPlan, setProcessingPlan] = useState(null)
  const [billing, setBilling] = useState('yearly')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const maxYearlyDiscount = Math.max(...plans.map((plan) => getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)))

  const { refreshUserData } = useAuth()

  const refreshAfterVerifiedPayment = async () => {
    try {
      await refreshUserData?.()
    } catch (error) {
      console.error('Payment succeeded but account refresh failed:', error)
      toast({
        title: 'Payment confirmed',
        description: 'Credits are still syncing. Reopen your account shortly to refresh the balance.',
      })
    }
  }

  useEffect(() => {
    loadRazorpayScript().catch(() => {})
  }, [])

  const handlePayment = async (plan) => {
    setProcessingPlan(plan.id)
    try {
      const planId = billing === 'yearly' ? `${plan.id}_yearly` : plan.id
      await loadRazorpayScript()
      if (!window.Razorpay) {
        toast({ variant: 'destructive', title: 'Payment system unavailable', description: 'Please refresh and try again.' })
        setProcessingPlan(null)
        return
      }

      const currentUser = user || auth.currentUser
      if (!currentUser) {
        toast({ variant: 'destructive', title: 'Login required', description: 'Please log in first to purchase a plan.' })
        setProcessingPlan(null)
        return
      }

      const idToken = typeof currentUser.getIdToken === 'function'
        ? await currentUser.getIdToken(true)
        : ''
      const paymentAttemptKey = createIdempotencyKey('plan', planId)

      const createOrder = async (token) => apiRequest('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan_id: planId,
          id_token: token,
          currency: 'INR',
          idempotency_key: paymentAttemptKey,
        }),
      })

      let orderData = null
      try {
        const parsed = await createOrder(idToken)
        if (parsed.success && parsed.order?.id) orderData = parsed
        else throw new Error(parsed.error || 'Failed to create order')
      } catch (fetchErr) {
        console.warn('Backend order creation failed', fetchErr)
        throw fetchErr
      }

      if (!orderData?.order?.id) {
        throw new Error('Unable to create a secure payment order. Please try again.')
      }
      if (!Number.isSafeInteger(orderData.order.amount) || orderData.order.amount <= 0 || !['INR', 'USD'].includes(orderData.order.currency)) {
        throw new Error('Payment order returned an invalid amount or currency.')
      }

      onClose()

      // Razorpay does not invoke `handler` when checkout is closed before it
      // confirms a payment. Keep a local outcome flag for explicit feedback.
      let checkoutResolved = false

      const keyToUse = orderData.key_id || RAZORPAY_KEY_ID
      if (!keyToUse) {
        throw new Error('Razorpay payment key is not set. Please configure VITE_RAZORPAY_KEY_ID.')
      }

      const options = {
        key: keyToUse,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Lekha Captions',
        description: `${plan.name} Plan${billing === 'yearly' ? ' · Yearly' : ''}`,
        order_id: orderData.order.id,
        handler: async (response) => {
          checkoutResolved = true
          try {
            // Razorpay checkout can stay open long enough for the pre-checkout
            // token to expire — mint a fresh one for verification.
            const verifyToken = typeof currentUser.getIdToken === 'function'
              ? await currentUser.getIdToken(true)
              : idToken
            const verifyData = await apiRequest('/api/verify-payment', {
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
                idempotency_key: paymentAttemptKey,
              }),
            })
            if (verifyData.success) {
              toast({ title: 'Payment successful', description: `${verifyData.credits_added} credits added.` })
              if (onSelectPlan) onSelectPlan(planId)
              // No page reload: the user may have unsaved captions in the
              // editor (upgrading mid-edit is the common path). Refreshing
              // userData updates credits/plan gating in place.
              await refreshAfterVerifiedPayment()
            } else {
              toast({ variant: 'destructive', title: 'Payment verification failed', description: 'Please contact support.' })
            }
          } catch (e) {
            console.error('Payment verification pending:', e)
            toast({
              title: 'Payment received',
              description: 'Verification is pending. Credits will be applied by payment reconciliation.',
            })
          } finally {
            setProcessingPlan(null)
          }
        },
        prefill: { name: user?.displayName || '', email: user?.email || '' },
        theme: { color: '#F5A623' },
        modal: {
          ondismiss: () => {
            if (!checkoutResolved) {
              toast({
                variant: 'destructive',
                title: 'Payment not completed',
                description: 'Razorpay did not confirm this payment. If your bank was debited, do not retry and contact support with the Razorpay payment ID.',
              })
            }
            setProcessingPlan(null)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (resp) => {
        checkoutResolved = true
        toast({ variant: 'destructive', title: 'Payment failed', description: resp.error?.description || 'Unknown error' })
        setProcessingPlan(null)
      })
      rzp.open()
    } catch (error) {
      notifyApiError(error, 'Payment error')
      setProcessingPlan(null)
    }
  }

  const handlePromoRedeem = async () => {
    if (!promoCode.trim()) return
    if (promoCode.trim().length > 50) return
    setPromoLoading(true)
    setPromoStatus(null)
    try {
      const currentUser = user || auth.currentUser
      if (!currentUser) {
        setPromoStatus({ type: 'error', message: 'Please log in first.' })
        return
      }
      const idToken = await currentUser.getIdToken()
      const data = await apiRequest('/api/redeem-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, code: promoCode.trim() }),
      })
      setPromoStatus({
        type: 'success',
        message: `🎉 Promo activated! Your ${data.plan} plan is free until ${data.expires}`,
      })
      setPromoCode('')
      await refreshUserData()
    } catch (err) {
      setPromoStatus({ type: 'error', message: err.message || 'Redemption failed' })
    } finally {
      setPromoLoading(false)
    }
  }

  const handleTopup = async (topup) => {
    setProcessingPlan(topup.plan_id)
    try {
      await loadRazorpayScript()
      if (!window.Razorpay) {
        toast({ variant: 'destructive', title: 'Payment system unavailable' })
        setProcessingPlan(null)
        return
      }
      const currentUser = user || auth.currentUser
      if (!currentUser) {
        toast({ variant: 'destructive', title: 'Login required', description: 'Please log in first.' })
        setProcessingPlan(null)
        return
      }
      const idToken = await currentUser.getIdToken(true)
      const paymentAttemptKey = createIdempotencyKey('topup', topup.plan_id)
      const orderData = await apiRequest('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          plan_id: topup.plan_id,
          id_token: idToken,
          currency: 'INR',
          idempotency_key: paymentAttemptKey,
        }),
      })
      if (!orderData.success) throw new Error(orderData.error || 'Failed to create top-up order')
      if (!orderData.order?.id) throw new Error('Unable to create a secure top-up order. Please try again.')
      onClose()
      const keyToUse = orderData.key_id || RAZORPAY_KEY_ID
      if (!keyToUse) {
        throw new Error('Razorpay payment key is not set. Please configure VITE_RAZORPAY_KEY_ID.')
      }
      if (!Number.isSafeInteger(orderData.order.amount) || orderData.order.amount <= 0 || orderData.order.currency !== 'INR') {
        throw new Error('Top-up order returned an invalid amount or currency.')
      }
      let checkoutResolved = false
      const options = {
        key: keyToUse,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Lekha Captions',
        description: `Top-up · ${topup.credits} credits`,
        order_id: orderData.order.id,
        handler: async (response) => {
          checkoutResolved = true
          try {
            const verifyToken = typeof currentUser.getIdToken === 'function'
              ? await currentUser.getIdToken(true)
              : idToken
            const verifyData = await apiRequest('/api/verify-payment', {
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
                plan_id: topup.plan_id,
                idempotency_key: paymentAttemptKey,
              }),
            })
            if (verifyData.success) {
              toast({ title: 'Top-up successful', description: `${verifyData.credits_added} credits added.` })
              // No page reload — see handlePayment: preserve unsaved editor work.
              await refreshAfterVerifiedPayment()
            } else {
              toast({ variant: 'destructive', title: 'Top-up verification failed', description: 'Please contact support.' })
            }
          } catch (e) {
            console.error('Top-up verification pending:', e)
            toast({
              title: 'Payment received',
              description: 'Top-up verification is pending. Credits will be applied by payment reconciliation.',
            })
          }
          finally { setProcessingPlan(null) }
        },
        prefill: { name: user?.displayName || '', email: user?.email || '' },
        theme: { color: '#F5A623' },
        modal: {
          ondismiss: () => {
            if (!checkoutResolved) {
              toast({
                variant: 'destructive',
                title: 'Top-up payment not completed',
                description: 'Razorpay did not confirm this payment. If your bank was debited, do not retry and contact support with the Razorpay payment ID.',
              })
            }
            setProcessingPlan(null)
          },
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (resp) => {
        checkoutResolved = true
        toast({ variant: 'destructive', title: 'Top-up payment failed', description: resp.error?.description || 'Unknown error' })
        setProcessingPlan(null)
      })
      rzp.open()
    } catch (error) {
      notifyApiError(error, 'Top-up error')
      setProcessingPlan(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[860px] bg-zinc-950 border-white/10 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-gray-400">
            Professional captions for every language and every creator
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="mt-2 flex w-fit items-center justify-center gap-1 rounded-full border border-white/10 bg-zinc-900 p-1 mx-auto">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Yearly
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">Save up to {maxYearlyDiscount}%</span>
          </button>
        </div>

        {message && (
          <div className="mt-3 p-3 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/20 flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#F5A623] shrink-0" />
            <p className="text-sm text-[#F5A623] font-medium">{message}</p>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {plans.map(plan => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className="relative flex flex-col cursor-pointer rounded-xl bg-zinc-900 px-4 pb-4 pt-5 transition-all"
                onClick={() => {
                  setSelectedPlan(plan.id)
                  if (!processingPlan) handlePayment(plan)
                }}
                style={(plan.popular || selectedPlan === plan.id) ? {
                  background: 'linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%) border-box',
                  border: '2px solid transparent',
                  boxShadow: '0 0 16px rgba(191,149,63,0.12)'
                } : { border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex whitespace-nowrap leading-none text-black text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.18)]" style={{ background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%)' }}>
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${plan.popular ? 'bg-white' : 'bg-white/10'}`}>
                  <Icon className="w-5 h-5 text-black" />
                </div>

                <h3 className="text-base font-bold text-white mb-0.5">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[28px] font-bold text-white">
                    {billing === 'yearly' ? formatInrPrice(plan.yearlyPaise) : formatInrPrice(plan.monthlyPaise)}
                  </span>
                  <span className="text-gray-500 text-sm">{billing === 'yearly' ? '/yr' : '/mo'}</span>
                </div>
                {billing === 'yearly' ? (
                  <p className="text-xs text-[#F5A623] mb-3">{formatInrPrice(plan.yearlyPaise)} billed yearly - ~{getDiscountPercent(plan.monthlyPaise, plan.yearlyPaise)}% off</p>
                ) : (
                  <div className="mb-3" />
                )}

                <div className="flex items-center gap-2 mb-3.5 rounded-lg bg-white/5 p-2">
                  <span className="text-lg font-bold text-white">{getPlanCredits(plan, billing)}</span>
                  <span className="text-xs text-gray-400">video credits / {getCreditPeriodLabel(billing)}</span>
                </div>

                <ul className="mb-6 flex-1 space-y-1.5">
                  {getPlanFeatures(plan, billing).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      <Check className="w-3.5 h-3.5 text-[#F5A623] mt-0.5 shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePayment(plan)
                  }}
                  disabled={processingPlan === plan.id}
                  className={`mt-auto w-full py-5 font-semibold rounded-[4px] ${plan.popular
                    ? 'bg-white hover:bg-gray-100 text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {processingPlan === plan.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    `Get ${plan.name}`
                  )}
                </Button>
              </div>
            )
          })}
        </div>

        {/* Contextual Top-up Section */}
        {(() => {
          const tier = userData?.subscription_tier
          if (!tier || tier === 'free') {
            return null
          }
          const topup = TOPUP_MAP[tier]
          if (!topup) return null
          return (
            <div className="mt-4 p-4 rounded-xl border border-white/10 bg-zinc-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">Need more credits?</p>
                  <p className="text-xs text-gray-400">
                    Add {topup.credits} credits to your current plan for {topup.price} - no plan change.
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Limit: {topup.limit} {topup.limit === 1 ? 'top-up' : 'top-ups'} per rolling 30 days.
                  </p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTopup(topup)
                  }}
                  disabled={processingPlan === topup.plan_id}
                  className="shrink-0 bg-white/10 hover:bg-white/20 text-white font-semibold"
                >
                  {processingPlan === topup.plan_id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    `Top Up · ${topup.price}`
                  )}
                </Button>
              </div>
            </div>
          )
        })()}

        {/* Promo Code Section */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-gray-400 mb-2">Have a promo code?</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && !promoLoading && handlePromoRedeem()}
              placeholder="Enter code"
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
            />
            <Button
              onClick={handlePromoRedeem}
              disabled={promoLoading || !promoCode.trim()}
              className="shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold"
            >
              {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {promoStatus && (
            <p className={`mt-2 text-sm ${promoStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {promoStatus.message}
            </p>
          )}
        </div>

        <p className="text-xs text-gray-600 text-center mt-3">
          Credits deducted only after successful export · Secure payments via Razorpay
        </p>
        <p className="text-xs text-gray-600 text-center mt-2">
          One-time purchase — no auto-renewal. Unused credits expire at the end of the plan period.
        </p>
        <p className="text-xs text-gray-500 text-center mt-2">
          <a href="/TermsAndConditions" target="_blank" rel="noreferrer" className="underline hover:text-gray-300">Terms</a>
          <span className="mx-2">·</span>
          <a href="/RefundPolicy" target="_blank" rel="noreferrer" className="underline hover:text-gray-300">Refund &amp; Cancellation</a>
          <span className="mx-2">·</span>
          <a href="/PrivacyPolicy" target="_blank" rel="noreferrer" className="underline hover:text-gray-300">Privacy</a>
        </p>
      </DialogContent>
    </Dialog>
  )
}
