import React from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Calendar } from 'lucide-react';
export default function SubscriptionBanner({ user, onUpgrade }) {
  const getPlanDetails = () => {
    switch (user?.subscription_plan) {
      case 'weekly_creator':
        return {
          name: 'Weekly Creator',
          icon: <Zap className="w-4 h-4" />,
          gradient: 'from-blue-500 to-cyan-500',
          total: 6
        };
      case 'monthly_pro':
        return {
          name: 'Monthly Pro',
          icon: <Crown className="w-4 h-4" />,
          gradient: 'from-purple-500 to-pink-500',
          total: 20
        };
      default:
        return {
          name: 'Free',
          icon: null,
          gradient: 'from-gray-600 to-gray-700',
          total: 0
        };
    }
  };

  const plan = getPlanDetails();
  const creditsRemaining = user?.credits_remaining || 0;
  const dailyUsage = user?.daily_usage_count || 0;
  const dailyLimit = user?.subscription_plan !== 'free' ? 10 : 0;

  const getDaysRemaining = () => {
    if (!user?.plan_expiry_date) return 0;
    const expiry = new Date(user.plan_expiry_date);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getDaysRemaining();

  if (user?.subscription_plan === 'free') {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg mb-1">
              Unlock Caption Studio
            </h3>
            <p className="text-white/80 text-sm">
              Start creating professional captions for your videos
            </p>
          </div>
          <Button
            onClick={onUpgrade}
            className="bg-white text-purple-600 hover:bg-gray-100"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r ${plan.gradient} rounded-lg p-4 mb-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            {plan.icon}
            <h3 className="text-white font-semibold">{plan.name} Plan</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Credits Remaining */}
            <div>
              <p className="text-white/70 text-xs mb-1">Credits Left</p>
              <p className="text-white text-xl font-bold">
                {creditsRemaining} / {plan.total}
              </p>
            </div>

            {/* Daily Usage */}
            <div>
              <p className="text-white/70 text-xs mb-1">Today's Usage</p>
              <p className="text-white text-xl font-bold">
                {dailyUsage} / {dailyLimit}
              </p>
            </div>

            {/* Days Remaining */}
            <div>
              <p className="text-white/70 text-xs mb-1">Days Left</p>
              <p className="text-white text-xl font-bold flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {daysLeft}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={onUpgrade}
          variant="outline"
          size="sm"
          className="border-white/20 text-white hover:bg-white/10 bg-green-600 hover:bg-green-700 border-green-500"
        >
          Manage Plan
        </Button>
      </div>


    </div>
  );
}