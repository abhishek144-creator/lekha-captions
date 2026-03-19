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

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_RJWsOLmZ6GL27m'

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
    monthlyPrice: '₹99',
    yearlyPrice: '₹79',
    monthlyPaise: 9900,
    yearlyPaise: 7900,
    credits: 15,
    icon: Zap,
    description: 'Perfect for getting started',
    features: [
      '15 video credits / month',
      'Max 2 min per video',
      'Max 3 videos / day',
      '1080p HD export',
      'All 115+ languages',
      'SRT + TXT download',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    monthlyPrice: '₹199',
    yearlyPrice: '₹159',
    monthlyPaise: 19900,
    yearlyPaise: 15900,
    credits: 45,
    icon: Crown,
    description: 'Best value for serious creators',
    popular: true,
    features: [
      '45 video credits / month',
      'Max 3 min per video',
      'Max 5 videos / day',
      '1080p HD + 4K export',
      'All 115+ languages',
      'Translation feature',
      'Priority support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: '₹399',
    yearlyPrice: '₹319',
    monthlyPaise: 39900,
    yearlyPaise: 31900,
    credits: 90,
    icon: Star,
    description: 'For power users & teams',
    features: [
      '90 video credits / month',
      'Max 3 min per video',
      'Unlimited videos / day',
      '1080p HD + 4K export',
      'All 115+ languages',
      'Translation + API access',
      '3 team seats',
    ],
  },
]

export default function PricingModal({ isOpen, onClose, onSelectPlan, user, message, userData }) {
  const [processingPlan, setProcessingPlan] = useState(null)
  const [billing, setBilling] = useState('monthly')

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

      const currentUser = auth.currentUser
      if (!currentUser) {
        alert('Please log in first to purchase a plan.')
        setProcessingPlan(null)
        return
      }

      const idToken = await currentUser.getIdToken()
      const amount = billing === 'yearly' ? plan.yearlyPaise : plan.monthlyPaise

      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, id_token: idToken, currency: 'INR' }),
      })
      const orderData = await orderRes.json()
      if (!orderData.success) throw new Error(orderData.error || 'Failed to create order')

      onClose()
      await new Promise(r => setTimeout(r, 100))

      const options = {
        key: orderData.key_id || RAZORPAY_KEY_ID,
        amount: orderData.order?.amount || amount,
        currency: 'INR',
        name: 'Lekha Captions',
        description: `${plan.name} Plan${billing === 'yearly' ? ' (Yearly)' : ''}`,
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
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.success) {
              alert(`✅ Payment successful! You received ${verifyData.credits_added} credits.`)
              if (onSelectPlan) onSelectPlan(plan.id)
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
        theme: { color: '#2ECC9A' },
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
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-[#2ECC9A] text-[#0A3D2C]' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-[#2ECC9A] text-[#0A3D2C]' : 'text-gray-400 hover:text-white'}`}
          >
            Yearly
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">−20%</span>
          </button>
        </div>

        {message && (
          <div className="mt-3 p-3 rounded-xl bg-[#2ECC9A]/10 border border-[#2ECC9A]/20 flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#2ECC9A] shrink-0" />
            <p className="text-sm text-[#2ECC9A] font-medium">{message}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {plans.map(plan => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-5 transition-all ${plan.popular
                  ? 'border-[#2ECC9A] bg-zinc-900'
                  : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#2ECC9A] text-[#0A3D2C] text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${plan.popular ? 'bg-[#2ECC9A]' : 'bg-white/10'}`}>
                  <Icon className={`w-5 h-5 ${plan.popular ? 'text-[#0A3D2C]' : 'text-white'}`} />
                </div>

                <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">
                    {billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500 text-sm">/mo</span>
                </div>
                {billing === 'yearly' && (
                  <p className="text-xs text-[#2ECC9A] mb-3">Billed yearly · Save 20%</p>
                )}
                {billing === 'monthly' && <div className="mb-3" />}

                <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-white/5">
                  <span className="text-xl font-bold text-white">{plan.credits}</span>
                  <span className="text-xs text-gray-400">video credits / month</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-[#2ECC9A] mt-0.5 shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePayment(plan)}
                  disabled={processingPlan === plan.id}
                  className={`w-full font-semibold ${plan.popular
                    ? 'bg-[#2ECC9A] hover:bg-[#27b889] text-[#0A3D2C]'
                    : 'bg-white/10 hover:bg-white/20 text-white'
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

        <p className="text-xs text-gray-600 text-center mt-3">
          Credits deducted only after successful export · Secure payments via Razorpay
        </p>
      </DialogContent>
    </Dialog>
  )
}
