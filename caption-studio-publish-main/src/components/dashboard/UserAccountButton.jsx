import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Crown, Video } from 'lucide-react';
import PricingModal from './PricingModal';

export default function UserAccountButton() {
  const [user, setUser] = useState(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const defaultUser = { id: 'guest', email: 'guest@captionstudio.io', full_name: 'Guest User', plan: 'pro', credits_remaining: 30 };
        const savedData = JSON.parse(localStorage.getItem('captionStudioPlan') || '{}');
        const currentUser = { ...defaultUser, ...savedData };
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const getPlanDetails = () => {
    const plan = user?.subscription_plan || 'free';
    if (plan === 'weekly_creator') {
      return { name: 'Weekly Creator', icon: <Crown className="w-4 h-4" />, gradient: 'from-purple-500 to-pink-500', totalCredits: 50 };
    } else if (plan === 'monthly_pro') {
      return { name: 'Monthly Pro', icon: <Crown className="w-4 h-4" />, gradient: 'from-blue-500 to-cyan-500', totalCredits: 200 };
    } else {
      return { name: 'Free Plan', icon: <Video className="w-4 h-4" />, gradient: 'from-green-500 to-emerald-500', totalCredits: 3 };
    }
  };

  const planDetails = getPlanDetails();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSelectPlan = async (planId) => {
    setIsPricingModalOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 p-2 pr-3 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(user?.full_name)}
          </div>
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Plan Info */}
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {getInitials(user?.full_name)}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{user?.full_name}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{planDetails.name}</span>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${planDetails.gradient}`}>
                      {planDetails.icon}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Video Exports Left: <span className="text-white font-medium">{user?.credits_remaining || 0} of {planDetails.totalCredits}</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    setShowDropdown(false);
                    setIsPricingModalOpen(true);
                  }}
                  className={`w-full mt-3 bg-gradient-to-r ${planDetails.gradient} hover:opacity-90 text-white text-sm`}
                  size="sm"
                >
                  Upgrade Plan
                </Button>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <Link
                  to={createPageUrl('UserAccount')}
                  onClick={() => setShowDropdown(false)}
                  className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Manage Account
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onSelectPlan={handleSelectPlan}
        user={user}
      />
    </>
  );
}