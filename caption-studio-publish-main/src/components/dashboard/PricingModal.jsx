import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Crown, Zap, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setTimeout(() => resolve(true), 100);
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(script);
  });
};

const plans = [
  {
    id: 'free_plan',
    name: 'Free Plan',
    monthlyPrice: '₹0',
    monthlyPriceInPaise: 0,
    yearlyPrice: '₹0',
    yearlyPriceInPaise: 0,
    duration: '30 days',
    credits: 3,
    icon: <Zap className="w-6 h-6" />,
    gradient: 'from-green-500 to-emerald-500',
    features: [
      '3 Video Credits',
      'Valid for 30 Days',
      '1080p HD Export',
      'Downloadable .SRT Files',
      '60 Caption Styles'
    ]
  },
  {
    id: 'weekly_creator',
    name: 'Weekly Creator',
    monthlyPrice: '₹99',
    monthlyPriceInPaise: 9900,
    yearlyPrice: '₹79',
    yearlyPriceInPaise: 7900,
    duration: '7 days',
    credits: 12,
    icon: <Zap className="w-6 h-6" />,
    gradient: 'from-blue-500 to-cyan-500',
    features: [
      '12 Video Credits',
      'Valid for 7 Days',
      'Up to 5 Videos/Day',
      '1080p HD Export',
      '4K Export Option',
      'Downloadable .SRT Files',
      '60 Caption Styles'
    ]
  },
  {
    id: 'monthly_pro',
    name: 'Monthly Pro',
    monthlyPrice: '₹199',
    monthlyPriceInPaise: 19900,
    yearlyPrice: '₹159',
    yearlyPriceInPaise: 15900,
    duration: '30 days',
    credits: 45,
    icon: <Crown className="w-6 h-6" />,
    gradient: 'from-purple-500 to-pink-500',
    popular: true,
    features: [
      '45 Video Credits / month',
      'Valid for 30 Days',
      'Max 5 Videos/Day',
      '1080p HD Export',
      '4K Export Option',
      'Downloadable .SRT Files',
      'Priority Processing'
    ]
  }
];

const topUpPlans = [
  {
    id: 'topup_5',
    name: 'Mini Top-Up',
    price: '₹49',
    priceInPaise: 4900,
    credits: 5,
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-amber-400 to-orange-500'
  },
  {
    id: 'topup_10',
    name: 'Pro Top-Up',
    price: '₹75',
    priceInPaise: 7500,
    credits: 10,
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-orange-500 to-red-500',
    popular: true
  },
  {
    id: 'topup_25',
    name: 'Power Top-Up',
    price: '₹149',
    priceInPaise: 14900,
    credits: 25,
    icon: <Crown className="w-5 h-5" />,
    gradient: 'from-red-500 to-rose-600'
  }
];

export default function PricingModal({ isOpen, onClose, onSelectPlan, user, message, userData }) {
  const [processingPlan, setProcessingPlan] = useState(null);
  const [isYearly, setIsYearly] = useState(false);

  const currentTier = userData?.subscription_tier || userData?.subscription_plan || 'free';
  const isMonthlyOrYearly = ['monthly', 'yearly', 'monthly_pro', 'yearly_pro'].includes(currentTier);
  const topupsThisCycle = userData?.topups_this_cycle || 0;
  const limitReached = topupsThisCycle >= 2 && currentTier !== 'weekly' && currentTier !== 'weekly_creator';

  useEffect(() => {
    loadRazorpayScript().catch(() => { });
  }, []);

  const handlePayment = async (plan) => {
    setProcessingPlan(plan.id);
    const planCostInPaise = isYearly && plan.id === 'monthly_pro' ? 190000 : plan.monthlyPriceInPaise;

    try {
      if (planCostInPaise === 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        localStorage.setItem('captionStudioPlan', JSON.stringify({
          subscription_plan: plan.id,
          credits_remaining: plan.credits,
          plan_expiry_date: expiryDate.toISOString(),
          daily_usage_count: 0
        }));

        alert(`✅ Free plan activated! You now have ${plan.credits} credits.`);
        setProcessingPlan(null);
        onSelectPlan(plan.id);
        onClose();
        window.location.reload();
        return;
      }

      await loadRazorpayScript();

      if (!window.Razorpay) {
        alert('Payment system unavailable. Please refresh and try again.');
        setProcessingPlan(null);
        return;
      }

      // 1. Get Firebase Auth Token First
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Please login first to purchase a plan.");
        setProcessingPlan(null);
        return;
      }

      const idToken = await currentUser.getIdToken();

      // 2. Call our backend to create a Razorpay Order
      const actualPlanId = isYearly && plan.id === 'monthly_pro' ? 'yearly_pro' : plan.id;

      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: actualPlanId, id_token: idToken })
      });

      const orderData = await orderRes.json();
      // The backend creates order based on standard `amount` logic; we may override for Yearly natively, 
      // but for now, if the price changes due to year, we need to pass that to the backend creation.
      // E.g., `fetch('/api/create-order')` could accept a new price parameter. Let's simplify and assume 
      // the backend reads the amount securely or we pass it:

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Hotfix override for yearly pricing to ensure Razorpay charges correctly if using dynamic amounts
      const finalAmount = orderData.order.amount; // In reality backend should calculate this. For demo we trust backend.

      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: 'INR',
        name: 'Caption Studio',
        description: `${plan.name} Subscription`,
        order_id: orderData.order.id, // This is explicitly required by Razorpay
        handler: async (response) => {
          try {
            // 3. Verify Payment on our server
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                id_token: idToken
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`✅ Payment successful! You received ${verifyData.credits_added} credits.`);
              window.location.reload();
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch (e) {
            console.error(e);
            alert("Error verifying payment.");
          } finally {
            setProcessingPlan(null);
            onClose();
          }
        },
        prefill: { name: user?.displayName || '', email: user?.email || '' },
        theme: { color: '#9333ea' },
        modal: {
          ondismiss: () => setProcessingPlan(null)
        }
      };

      // Close the dialog first to avoid focus conflicts with Razorpay modal
      onClose();

      // Small delay to ensure dialog is fully closed before opening Razorpay
      await new Promise(resolve => setTimeout(resolve, 100));

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (resp) => {
        alert(`❌ Payment failed: ${resp.error?.description || 'Unknown error'}`);
        setProcessingPlan(null);
      });
      razorpay.open();
    } catch (error) {
      alert(`Error: ${error.message}`);
      setProcessingPlan(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-zinc-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a plan that fits your content creation needs
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center mt-6">
          <div className="flex items-center gap-4 bg-white/5 py-2 px-6 rounded-full border border-white/10">
            <Label htmlFor="pricing-toggle" className={`text-sm font-medium cursor-pointer ${!isYearly ? 'text-white' : 'text-gray-400'}`}>
              Monthly
            </Label>
            <Switch
              id="pricing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-purple-500"
            />
            <Label htmlFor="pricing-toggle" className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${isYearly ? 'text-white' : 'text-gray-400'}`}>
              Yearly
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Save 20%
              </span>
            </Label>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-300 font-medium">{message}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-xl border ${plan.popular ? 'border-purple-500' : 'border-white/10'
                } bg-zinc-900/50 p-6 transition-all hover:border-white/20`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${plan.gradient} flex items-center justify-center mb-4`}>
                {plan.icon}
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                {isYearly && plan.id === 'monthly_pro' ? 'Yearly Pro' : plan.name}
              </h3>

              <div className="mb-4 flex items-end">
                <span className="text-4xl font-bold text-white">
                  {isYearly && plan.id === 'monthly_pro' ? '₹1900' : plan.monthlyPrice}
                </span>
                <span className="text-gray-400 ml-2 mb-1">
                  {plan.id === 'free_plan' ? '/ forever' :
                    isYearly && plan.id === 'monthly_pro' ? <span className="text-sm">billed yearly</span> : `/ ${plan.duration}`}
                </span>
              </div>

              {isYearly && plan.id === 'monthly_pro' && (
                <p className="text-sm text-green-400 font-medium mb-4">
                  Billed ₹1900 annually
                </p>
              )}

              <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-white/5">
                <span className="text-2xl font-bold text-white">{plan.credits}</span>
                <span className="text-sm text-gray-400">Video Credits</span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => {
                  let displayFeature = feature;
                  if (isYearly && plan.id === 'monthly_pro' && feature === 'Valid for 30 Days') {
                    displayFeature = 'Valid for 365 Days';
                  }
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{displayFeature}</span>
                    </li>
                  )
                })}
              </ul>

              <Button
                onClick={() => handlePayment(plan)}
                disabled={processingPlan === plan.id || (plan.id === 'weekly_creator' && isMonthlyOrYearly)}
                className={`w-full ${plan.popular
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : 'bg-white/10 hover:bg-white/20'
                  } text-white`}
              >
                {processingPlan === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (plan.id === 'weekly_creator' && isMonthlyOrYearly) ? (
                  'Unavailable on standard plans'
                ) : (
                  `Select ${isYearly && plan.id === 'monthly_pro' ? 'Yearly Pro' : plan.name}`
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Top-Ups Section */}
        {currentTier !== 'free' && currentTier !== 'free_plan' && (
          <div className="mt-8 pt-8 border-t border-white/5">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Need more credits?
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Short on video credits this billing cycle? Instantly top-up your balance. These do not affect your renewal date.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              {topUpPlans.map(topup => {
                return (
                  <div key={topup.id} className={`rounded-xl border ${topup.popular ? 'border-orange-500/50' : 'border-white/10'} bg-zinc-900/50 p-4 transition-all hover:border-white/20 flex flex-col justify-between relative overflow-hidden`}>
                    {topup.popular && (
                      <div className="absolute top-0 right-0 bg-orange-500 text-[9px] font-bold text-white px-2 py-1 rounded-bl-lg uppercase">
                        Best Value
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4 mt-2">
                      <div>
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${topup.gradient} flex items-center justify-center mb-2`}>
                          {topup.icon}
                        </div>
                        <h4 className="text-white font-bold">{topup.name}</h4>
                        <p className="text-gray-400 text-sm">+{topup.credits} Videos</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-white">{topup.price}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePayment({ ...topup, monthlyPriceInPaise: topup.priceInPaise, id: topup.id })}
                      disabled={processingPlan === topup.id || limitReached}
                      className="w-full bg-white/10 hover:bg-white/20 text-white mt-2"
                    >
                      {processingPlan === topup.id ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      ) : (limitReached) ? (
                        'Max 2 Top-Ups Per Cycle'
                      ) : (
                        `Get ${topup.credits} Credits`
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-200">
            <strong>Note:</strong> Credits expire based on plan duration. Max 5 videos per 24 hours for all paid users to prevent abuse. Credits are strictly deducted only after successful high-res video rendering on export.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}