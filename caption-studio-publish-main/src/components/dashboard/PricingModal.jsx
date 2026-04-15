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

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) { resolve(true); return }
  const s = document.createElement('script')
  s.src = 'https://checkout.razorpay.com/v1/checkout.js'
  s.async = true
  s.onload = () => setTimeout(() => resolve(true), 100)
  s.onerror = () => reject(new Error('Failed to load Razorpay'))
  document.head.appendChild(s)
})

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: '₹99', yearlyPrice: '₹999',
    monthlyPaise: 9900, yearlyPaise: 99900,
    credits: 15,
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
    monthlyPrice: '₹199', yearlyPrice: '₹1,999',
    monthlyPaise: 19900, yearlyPaise: 199900,
    credits: 45,
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
    monthlyPrice: '₹399', yearlyPrice: '₹3,999',
    monthlyPaise: 39900, yearlyPaise: 399900,
    credits: 100,
    icon: Star,
    description: 'For power users & teams',
    features: [
      '100 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      'No watermark · 25+ styles',
      'All 115+ languages',
      'Translation + API access',
      '72 hr download link',
    ],
  },
]

const TOPUP_MAP = {
  starter: { plan_id: 'topup_starter', credits: 10, price: '₹49' },
  starter_yearly: { plan_id: 'topup_starter', credits: 10, price: '₹49' },
  creator: { plan_id: 'topup_creator', credits: 15, price: '₹49' },
  creator_yearly: { plan_id: 'topup_creator', credits: 15, price: '₹49' },
  pro: { plan_id: 'topup_pro', credits: 25, price: '₹79' },
  pro_yearly: { plan_id: 'topup_pro', credits: 25, price: '₹79' },
}

const TOPUP_PAISE = { topup_starter: 4900, topup_creator: 4900, topup_pro: 7900 }

export default function PricingModal({ isOpen, onClose, onSelectPlan, user, message, userData = null }) {
  const [processingPlan, setProcessingPlan] = useState(null)
  const [billing, setBilling] = useState('monthly')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)

  const { refreshUserData } = useAuth()

  useEffect(() => {
    loadRazorpayScript().catch(() => {})
  }, [])

  const handlePayment = async (plan) => {
    setProcessingPlan(plan.id)
    try {
      await loadRazorpayScript()
      if (!window.Razorpay) {
        alert('Payment system unavailable. Please refresh and try again.')
        setProcessingPlan(null)
        return
      }

      const currentUser = user || auth.currentUser
      if (!currentUser) {
        alert('Please log in first to purchase a plan.')
        setProcessingPlan(null)
        return
      }

      const idToken = await currentUser.getIdToken()
      const planId = billing === 'yearly' ? `${plan.id}_yearly` : plan.id
      const amount = billing === 'yearly' ? plan.yearlyPaise : plan.monthlyPaise

      let orderData = { success: false, order: null, key_id: RAZORPAY_KEY_ID }
      try {
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: planId, id_token: idToken, currency: 'INR' }),
        })
        const parsed = await orderRes.json()
        if (parsed.success) orderData = parsed
        else if (!RAZORPAY_KEY_ID.startsWith('rzp_test_')) throw new Error(parsed.error || 'Failed to create order')
      } catch (fetchErr) {
        if (!RAZORPAY_KEY_ID.startsWith('rzp_test_')) throw fetchErr
      }

      onClose()

      const options = {
        key: orderData.key_id || RAZORPAY_KEY_ID,
        amount: orderData.order?.amount || amount,
        currency: 'INR',
        name: 'Lekha Captions',
        description: `${plan.name} Plan${billing === 'yearly' ? ' · Yearly' : ''}`,
        order_id: orderData.order?.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                id_token: idToken,
                plan_id: planId,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              alert(`✅ Payment successful! ${verifyData.credits_added} credits added.`)
              if (onSelectPlan) onSelectPlan(planId)
              window.location.reload()
            } else {
              alert('Payment verification failed. Please contact support.')
            }
          } catch (e) {
            alert('Error verifying payment.')
          } finally {
            setProcessingPlan(null)
          }
        },
        prefill: { name: user?.displayName || '', email: user?.email || '' },
        theme: { color: '#F5A623' },
        modal: { ondismiss: () => setProcessingPlan(null) },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (resp) => {
        alert(`❌ Payment failed: ${resp.error?.description || 'Unknown error'}`)
        setProcessingPlan(null)
      })
      rzp.open()
    } catch (error) {
      alert(`Error: ${error.message}`)
      setProcessingPlan(null)
    }
  }

  const handlePromoRedeem = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoStatus(null)
    try {
      const currentUser = user || auth.currentUser
      if (!currentUser) {
        setPromoStatus({ type: 'error', message: 'Please log in first.' })
        return
      }
      const idToken = await currentUser.getIdToken()
      const res = await fetch('/api/redeem-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, code: promoCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Redemption failed')
      setPromoStatus({
        type: 'success',
        message: `🎉 Promo activated! Your ${data.plan} plan is free until ${data.expires}`,
      })
      setPromoCode('')
      await refreshUserData()
    } catch (err) {
      setPromoStatus({ type: 'error', message: err.message })
    } finally {
      setPromoLoading(false)
    }
  }

  const handleTopup = async (topup) => {
    setProcessingPlan(topup.plan_id)
    try {
      await loadRazorpayScript()
      if (!window.Razorpay) { alert('Payment system unavailable.'); setProcessingPlan(null); return }
      const currentUser = user || auth.currentUser
      if (!currentUser) { alert('Please log in first.'); setProcessingPlan(null); return }
      const idToken = await currentUser.getIdToken()
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: topup.plan_id, id_token: idToken, currency: 'INR' }),
      })
      const orderData = await orderRes.json()
      if (!orderData.success) throw new Error(orderData.error || 'Failed to create top-up order')
      onClose()
      const amount = TOPUP_PAISE[topup.plan_id]
      const options = {
        key: orderData.key_id || RAZORPAY_KEY_ID,
        amount: orderData.order?.amount || amount,
        currency: 'INR',
        name: 'Lekha Captions',
        description: `Top-up · ${topup.credits} credits`,
        order_id: orderData.order?.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                id_token: idToken,
                plan_id: topup.plan_id,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              alert(`✅ Top-up successful! ${verifyData.credits_added} credits added.`)
              window.location.reload()
            } else {
              alert('Top-up verification failed. Please contact support.')
            }
          } catch (e) { alert('Error verifying top-up.') }
          finally { setProcessingPlan(null) }
        },
        prefill: { name: user?.displayName || '', email: user?.email || '' },
        theme: { color: '#F5A623' },
        modal: { ondismiss: () => setProcessingPlan(null) },
      }
      new window.Razorpay(options).open()
    } catch (error) {
      alert(`Error: ${error.message}`)
      setProcessingPlan(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-gray-400">
            Professional captions for every language and every creator
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center gap-1 justify-center mt-2 bg-zinc-900 rounded-full p-1 w-fit mx-auto border border-white/10">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Yearly
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">−17%</span>
          </button>
        </div>

        {message && (
          <div className="mt-3 p-3 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/20 flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#F5A623] shrink-0" />
            <p className="text-sm text-[#F5A623] font-medium">{message}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {plans.map(plan => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className="relative rounded-xl p-5 transition-all cursor-pointer bg-zinc-900"
                onClick={() => setSelectedPlan(plan.id)}
                style={(plan.popular || selectedPlan === plan.id) ? {
                  background: 'linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%) border-box',
                  border: '2px solid transparent',
                  boxShadow: '0 0 16px rgba(191,149,63,0.12)'
                } : { border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-black text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%)' }}>
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${plan.popular ? 'bg-white' : 'bg-white/10'}`}>
                  <Icon className="w-5 h-5 text-black" />
                </div>

                <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">
                    {billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500 text-sm">/mo</span>
                </div>
                {billing === 'yearly' ? (
                  <p className="text-xs text-[#F5A623] mb-3">₹{plan.yearlyPaise / 100} billed yearly</p>
                ) : (
                  <div className="mb-3" />
                )}

                <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-white/5">
                  <span className="text-xl font-bold text-white">{plan.credits}</span>
                  <span className="text-xs text-gray-400">video credits / month</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-[#F5A623] mt-0.5 shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePayment(plan)}
                  disabled={processingPlan === plan.id}
                  className={`w-full font-semibold rounded-[4px] ${plan.popular
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
                    Add {topup.credits} credits to your current plan for {topup.price} — no plan change.
                  </p>
                </div>
                <Button
                  onClick={() => handleTopup(topup)}
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
              onKeyDown={e => e.key === 'Enter' && handlePromoRedeem()}
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
      </DialogContent>
    </Dialog>
  )
}
