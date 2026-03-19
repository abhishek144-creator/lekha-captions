import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, LogOut, Mail, User } from 'lucide-react';
import PricingModal from '@/components/dashboard/PricingModal';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Download, AlertCircle } from 'lucide-react';

const PLAN_LIMITS = {
  free_plan:       { totalCredits: 3,   name: 'Free' },
  free:            { totalCredits: 3,   name: 'Free' },
  starter:         { totalCredits: 15,  name: 'Starter' },
  starter_yearly:  { totalCredits: 15,  name: 'Starter (Yearly)' },
  creator:         { totalCredits: 45,  name: 'Creator' },
  creator_yearly:  { totalCredits: 45,  name: 'Creator (Yearly)' },
  pro:             { totalCredits: 100, name: 'Pro' },
  pro_yearly:      { totalCredits: 100, name: 'Pro (Yearly)' },
}

export default function UserAccount() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  const planId = userData?.subscription_tier || userData?.subscription_plan || 'free'
  const planKey = (planId === 'free' || !planId) ? 'free_plan' : planId
  const planDetails = PLAN_LIMITS[planKey] || PLAN_LIMITS.free_plan;
  const creditsRemaining = userData?.credits_remaining ?? 0;

  React.useEffect(() => {
    if (userData?.billing_cycle_end && new Date() > new Date(userData.billing_cycle_end) && planId !== 'free' && planId !== 'free_plan') {
      setIsRenewalModalOpen(true);
    }
  }, [userData, planId]);

  React.useEffect(() => {
    async function fetchPayments() {
      if (!currentUser?.uid) return;
      try {
        const paymentsRef = collection(db, 'users', currentUser.uid, 'payments');
        const q = query(paymentsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const paymentsData = querySnapshot.docs.map(doc => doc.data());
        setPayments(paymentsData);
      } catch (err) {
        console.error("Error fetching payment history:", err);
      } finally {
        setIsLoadingPayments(false);
      }
    }
    fetchPayments();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('captionEditorState');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSelectPlan = async () => {
    setIsPricingModalOpen(false);
  };

  // Redirect to login if not signed in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-4">
        <User className="w-12 h-12 text-gray-500" />
        <p className="text-gray-400">Please sign in to view your account</p>
        <Link to="/login">
          <Button className="bg-[#F5A623] hover:bg-[#D4891A] text-white">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  const memberSince = userData?.createdAt
    ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  const daysLeft = userData?.billing_cycle_end
    ? Math.ceil((new Date(userData.billing_cycle_end) - new Date()) / (1000 * 60 * 60 * 24))
    : userData?.subscription_expiry
      ? Math.ceil((new Date(userData.subscription_expiry) - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard', { state: { restoreSession: true } })} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-red-400"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

        {/* User Profile Card */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-16 h-16 rounded-full border-2 border-[#F5A623]/50"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0A0A0A] to-[#F5A623] flex items-center justify-center text-white font-bold text-xl">
                {getInitials(currentUser.displayName)}
              </div>
            )}
            <div>
              <p className="text-xl font-semibold text-white">{currentUser.displayName || 'User'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-gray-400 text-sm">{currentUser.email}</p>
              </div>
              <p className="text-gray-500 text-xs mt-1">Member since {memberSince}</p>
            </div>
          </div>
        </div>

        {/* Expired Subscription Modal */}
        {isRenewalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Subscription Expired</h3>
              <p className="text-gray-400 mb-6">
                Your billing cycle ended on {new Date(userData.billing_cycle_end).toLocaleDateString()}. Please renew or upgrade your plan to continue exporting videos.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent border-white/20 text-white"
                  onClick={() => setIsRenewalModalOpen(false)}
                >
                  Dismiss
                </Button>
                <Button
                  className="flex-1 bg-[#F5A623] text-white"
                  onClick={() => {
                    setIsRenewalModalOpen(false);
                    setIsPricingModalOpen(true);
                  }}
                >
                  View Plans
                </Button>
              </div>
            </div>
          </div>
        )}



        {/* Billing History */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Billing History</h2>

          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm text-left text-gray-400">
              <tbody className="divide-y divide-white/5">
                {isLoadingPayments ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center">Loading history...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No payment history found.<br />
                      <Button onClick={() => setIsPricingModalOpen(true)} variant="link" className="text-[#F5A623] p-0 mt-2">
                        Upgrade your plan
                      </Button>
                    </td>
                  </tr>
                ) : (
                  payments.map((payment, i) => (
                    <tr key={payment.payment_id || i} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap text-white">
                        {new Date(payment.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5 text-white font-medium">
                        {payment.currency === 'INR' ? '₹' : '$'}{payment.amount}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${payment.status === 'captured' ? 'bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                          {payment.status === 'captured' ? 'Paid' : payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-gray-400 capitalize">{payment.plan?.replace('_', ' ')} - {payment.plan?.includes('monthly') ? 'Monthly' : 'Weekly'}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan & Billing and Account Actions */}
        <div className="flex flex-col gap-6 mb-6">
          {/* Plan and Billing */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <Crown className="w-5 h-5 text-[#F5A623]" />
                Plan and billing
              </h2>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-gray-400">Current Plan</p>
                  <p className="text-xl font-bold text-white capitalize">{planDetails.name}</p>
                </div>

                <div className="flex justify-between items-end border-t border-white/5 pt-4">
                  <div>
                    <p className="text-sm text-gray-400">Credits Remaining</p>
                    <p className="text-xl font-bold text-white">{creditsRemaining} <span className="text-sm font-normal text-gray-500">/ {planDetails.totalCredits}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Billing Cycle</p>
                    <p className="text-white font-medium">{(planId === 'free' || planId === 'free_plan') ? 'Forever' : `${daysLeft} days left`}</p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setIsPricingModalOpen(true)}
              className="w-full bg-[#F5A623] hover:bg-[#D4891A] text-white border-0"
            >
              Upgrade Plan
            </Button>
          </div>

          {/* Account */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">Account</h2>
            <div className="space-y-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors text-left group"
              >
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-red-400">Sign Out</p>
                  <p className="text-xs text-gray-500">Sign out of your Caption Studio account</p>
                </div>
                <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onSelectPlan={handleSelectPlan}
        user={currentUser}
        userData={userData}
      />
    </div>
  );
}