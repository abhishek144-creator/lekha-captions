import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Crown, LogOut, Mail, Download, AlertCircle, User } from 'lucide-react'
import PricingModal from '@/components/dashboard/PricingModal'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { Link } from 'react-router-dom'

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
  const { currentUser, userData, logout } = useAuth()
  const navigate = useNavigate()
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false)
  const [payments, setPayments] = useState([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)

  const planId = userData?.subscription_tier || userData?.subscription_plan || 'free'
  const planKey = (planId === 'free' || !planId) ? 'free_plan' : planId
  const planDetails = PLAN_LIMITS[planKey] || PLAN_LIMITS.free_plan
  const creditsRemaining = userData?.credits_remaining ?? 0

  React.useEffect(() => {
    if (userData?.billing_cycle_end && new Date() > new Date(userData.billing_cycle_end) && planId !== 'free' && planId !== 'free_plan') {
      setIsRenewalModalOpen(true)
    }
  }, [userData, planId])

  React.useEffect(() => {
    async function fetchPayments() {
      if (!currentUser?.uid) return
      try {
        const paymentsRef = collection(db, 'users', currentUser.uid, 'payments')
        const q = query(paymentsRef, orderBy('timestamp', 'desc'))
        const querySnapshot = await getDocs(q)
        setPayments(querySnapshot.docs.map(doc => doc.data()))
      } catch (err) {
        console.error('Error fetching payment history:', err)
      } finally {
        setIsLoadingPayments(false)
      }
    }
    fetchPayments()
  }, [currentUser])

  const handleLogout = async () => {
    try {
      await logout()
      localStorage.removeItem('captionEditorState')
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatPaymentAmount = (payment) => {
    const currency = (payment?.currency || 'INR').toUpperCase()
    const symbol = currency === 'INR' ? '₹' : '$'
    const amountMinor = Number(payment?.amount || 0)
    const amountMajor = Number.isFinite(amountMinor) ? amountMinor / 100 : 0
    return `${symbol}${amountMajor.toFixed(2)}`
  }

  const memberSince = userData?.createdAt
    ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'

  const daysLeft = userData?.billing_cycle_end
    ? Math.ceil((new Date(userData.billing_cycle_end) - new Date()) / (1000 * 60 * 60 * 24))
    : userData?.subscription_expiry
      ? Math.ceil((new Date(userData.subscription_expiry) - new Date()) / (1000 * 60 * 60 * 24))
      : 0

  const creditPct = Math.min(100, Math.round((creditsRemaining / (planDetails.totalCredits || 1)) * 100))

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-4">
        <User className="w-12 h-12 text-gray-500" />
        <p className="text-gray-400">Please sign in to view your account</p>
        <Link to="/login">
          <Button className="bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px]">Sign In</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard', { state: { restoreSession: true } })}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-8">Account Settings</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Profile card */}
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Profile</h2>
              <div className="flex flex-col items-center text-center gap-3">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-16 h-16 rounded-full border border-white/20" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/20 flex items-center justify-center text-white font-bold text-xl">
                    {getInitials(currentUser.displayName)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{currentUser.displayName || 'User'}</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Mail className="w-3 h-3 text-gray-500" />
                    <p className="text-gray-400 text-xs">{currentUser.email}</p>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">Member since {memberSince}</p>
                </div>
              </div>
            </div>

            {/* Plan card */}
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Crown className="w-3.5 h-3.5" />
                Plan & Billing
              </h2>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Current Plan</p>
                <p className="text-lg font-bold text-white capitalize">{planDetails.name}</p>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs text-gray-500">Credits</p>
                  <p className="text-xs text-white font-medium">{creditsRemaining} / {planDetails.totalCredits}</p>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mb-5 pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500">Billing Cycle</p>
                <p className="text-xs text-white font-medium">
                  {(planId === 'free' || planId === 'free_plan') ? 'Forever' : `${daysLeft} days left`}
                </p>
              </div>

              <Button
                onClick={() => setIsPricingModalOpen(true)}
                className="w-full bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px] text-sm h-9"
              >
                Upgrade Plan
              </Button>
            </div>

            {/* Sign out */}
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Account</h2>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 transition-colors group text-left"
              >
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-red-400 transition-colors">Sign Out</p>
                  <p className="text-xs text-gray-500">Sign out of your Lekha Captions account</p>
                </div>
                <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>

          {/* Right column — Billing History */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing History</h2>
              </div>

              {isLoadingPayments ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">Loading history...</div>
              ) : payments.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-gray-500 text-sm mb-3">No payment history yet.</p>
                  <button
                    onClick={() => setIsPricingModalOpen(true)}
                    className="text-sm text-white underline underline-offset-2 hover:text-gray-300 transition-colors"
                  >
                    Upgrade your plan
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Date</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Amount</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Status</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Plan</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {payments.map((payment, i) => (
                      <tr key={payment.payment_id || i} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-4 text-white text-xs">
                          {new Date(payment.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 text-white font-medium text-xs">
                          {formatPaymentAmount(payment)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            payment.status === 'captured'
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'bg-white/5 text-gray-400 border border-white/10'
                          }`}>
                            {payment.status === 'captured' ? 'Paid' : payment.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-400 text-xs capitalize">
                          {payment.plan?.replace('_', ' ')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button className="text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expired subscription modal */}
      {isRenewalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Subscription Expired</h3>
            <p className="text-gray-400 text-sm mb-5">
              Your billing cycle ended on {new Date(userData.billing_cycle_end).toLocaleDateString()}. Please renew to continue exporting.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent border-white/20 text-white" onClick={() => setIsRenewalModalOpen(false)}>
                Dismiss
              </Button>
              <Button className="flex-1 bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px]" onClick={() => { setIsRenewalModalOpen(false); setIsPricingModalOpen(true) }}>
                View Plans
              </Button>
            </div>
          </div>
        </div>
      )}

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        onSelectPlan={() => setIsPricingModalOpen(false)}
        user={currentUser}
        userData={userData}
      />
    </div>
  )
}
