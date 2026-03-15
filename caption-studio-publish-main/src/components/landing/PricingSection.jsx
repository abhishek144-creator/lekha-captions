import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

const RAZORPAY_KEY_ID = 'rzp_test_RJWsOLmZ6GL27m';

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
    id: 'weekly',
    name: 'Weekly Creator',
    monthlyPrice: '₹99',
    monthlyPriceInPaise: 9900,
    yearlyPrice: '₹79',
    yearlyPriceInPaise: 7900,
    period: 'per week',
    description: 'Perfect for consistent posting',
    icon: Zap,
    features: [
      '12 Video Credits',
      'Valid for 7 Days',
      '1080p HD Export',
      '4K Export Option',
      'All caption styles',
      'Full editing controls',
    ],
    cta: 'Start Weekly',
    popular: false,
    credits: 12,
    validDays: 7
  },
  {
    id: 'monthly',
    name: 'Monthly Pro',
    monthlyPrice: '₹199',
    monthlyPriceInPaise: 19900,
    yearlyPrice: '₹159',
    yearlyPriceInPaise: 15900,
    period: 'per month',
    description: 'Best value for serious creators',
    icon: Crown,
    features: [
      '45 Video Credits / month',
      'Valid for 30 Days',
      'Max 5 Videos/Day', // Updated as per instruction (was 'Max 5 Videos/Day', instruction implies 'Max 5 Videos / 24hrs' to 'Max 5 Videos/Day')
      '1080p HD Export',
      '4K Export Option',
      'All caption styles',
      'Full editing controls',
    ],
    cta: 'Go Pro',
    popular: true,
    credits: 45,
    validDays: 30
  }
];

export default function PricingSection() {
  const [processingPlan, setProcessingPlan] = useState(null);
  const [user, setUser] = useState(null);
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const defaultUser = { id: 'guest', email: 'guest@captionstudio.io', full_name: 'Guest User', plan: 'pro', credits_remaining: 30 };
        const savedData = JSON.parse(localStorage.getItem('captionStudioPlan') || '{}');
        const currentUser = { ...defaultUser, ...savedData };
        setUser(currentUser);
      } catch (e) {
        // Not logged in
      }
    };
    checkUser();
    loadRazorpayScript().catch(() => { });
  }, []);

  const handleSelectPlan = async (plan) => {
    if (!user) {
      window.location.href = createPageUrl('Dashboard');
      return;
    }

    setProcessingPlan(plan.id);

    try {
      await loadRazorpayScript();

      if (!window.Razorpay) {
        alert('Payment system unavailable. Please refresh and try again.');
        setProcessingPlan(null);
        return;
      }

      // 45 credits explicitly handled in plan obj, price driven by override
      const planCostInPaise = isYearly && plan.id === 'monthly' ? 190000 : plan.monthlyPriceInPaise;

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: planCostInPaise,
        currency: 'INR',
        name: 'Caption Studio',
        description: `${plan.name} Subscription`,
        prefill: { name: user?.full_name || '', email: user?.email || '' },
        theme: { color: '#9333ea' },
        handler: async (response) => {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (isYearly && plan.id === 'monthly' ? 365 : plan.validDays));
          const actualPlanId = isYearly && plan.id === 'monthly' ? 'yearly_pro' : plan.id;

          localStorage.setItem('captionStudioPlan', JSON.stringify({
            subscription_plan: actualPlanId,
            subscription_expiry: expiryDate.toISOString(),
            credits_total: plan.credits,
            credits_remaining: plan.credits,
            last_payment_id: response.razorpay_payment_id
          }));

          alert(`Successfully subscribed to ${plan.name}! You now have ${plan.credits} credits.`);
          setProcessingPlan(null);
          window.location.href = createPageUrl('Dashboard');
        },
        modal: {
          ondismiss: () => setProcessingPlan(null)
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (resp) => {
        console.error('Payment failed:', resp.error);
        setProcessingPlan(null);
      });
      razorpay.open();
    } catch (error) {
      console.error('Payment initiation failed:', error);
      setProcessingPlan(null);
    }
  };

  return (
    <section className="py-24 bg-[#0a0a0a] relative">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-600/5 to-transparent" />

      <div className="max-w-4xl mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 mb-8">
            Choose the plan that fits your content schedule.
          </p>

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4 bg-white/5 py-2 px-6 rounded-full border border-white/10">
              <Label htmlFor="landing-pricing-toggle" className={`text-sm font-medium cursor-pointer ${!isYearly ? 'text-white' : 'text-gray-400'}`}>
                Monthly
              </Label>
              <Switch
                id="landing-pricing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-purple-500"
              />
              <Label htmlFor="landing-pricing-toggle" className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${isYearly ? 'text-white' : 'text-gray-400'}`}>
                Yearly
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Save 20%
                </span>
              </Label>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative rounded-2xl p-8 ${plan.popular
                ? 'bg-gradient-to-b from-purple-600/20 to-purple-600/5 border-2 border-purple-500/30'
                : 'bg-white/[0.02] border border-white/5'
                }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl ${plan.popular ? 'bg-purple-600' : 'bg-white/10'} flex items-center justify-center mb-6`}>
                <plan.icon className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-1">
                {isYearly && plan.id === 'monthly' ? 'Yearly Pro' : plan.name}
              </h3>
              <p className="text-gray-500 text-sm mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">
                  {isYearly && plan.id === 'monthly' ? '₹1900' : plan.monthlyPrice}
                </span>
                <span className="text-gray-500 flex items-center">
                  {isYearly && plan.id === 'monthly' ? <span className="text-sm tracking-tight ml-2">billed yearly</span> : `/${plan.period}`}
                </span>
              </div>

              {isYearly && plan.id === 'monthly' && (
                <p className="text-sm text-green-400 font-medium mb-4">
                  Billed ₹1900 annually
                </p>
              )}
              {(!isYearly || plan.id !== 'monthly') && <div className="h-9 mb-4" />} {/* Spacer to prevent layout shift */}

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => {
                  let displayFeature = feature;
                  if (isYearly && plan.id === 'monthly' && feature === 'Valid for 30 Days') {
                    displayFeature = 'Valid for 365 Days';
                  }
                  return (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      {displayFeature}
                    </li>
                  )
                })}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan)}
                disabled={processingPlan === plan.id}
                className={`w-full py-6 rounded-xl ${plan.popular
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
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
      </div>
    </section>
  );
}