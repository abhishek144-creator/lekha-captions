import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Crown,
  Download,
  LogOut,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  User,
  WalletCards
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import PricingModal from '@/components/dashboard/PricingModal'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

const PLAN_LIMITS = {
  free_plan: { totalCredits: 3, name: 'Free' },
  free: { totalCredits: 3, name: 'Free' },
  starter: { totalCredits: 15, name: 'Starter' },
  starter_yearly: { totalCredits: 15, name: 'Starter (Yearly)' },
  creator: { totalCredits: 45, name: 'Creator' },
  creator_yearly: { totalCredits: 45, name: 'Creator (Yearly)' },
  pro: { totalCredits: 100, name: 'Pro' },
  pro_yearly: { totalCredits: 100, name: 'Pro (Yearly)' },
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
  const totalCredits = planDetails.totalCredits || 1
  const creditPct = Math.min(100, Math.round((creditsRemaining / totalCredits) * 100))
  const isFreePlan = planId === 'free' || planId === 'free_plan' || !planId

  React.useEffect(() => {
    if (userData?.billing_cycle_end && new Date() > new Date(userData.billing_cycle_end) && !isFreePlan) {
      setIsRenewalModalOpen(true)
    }
  }, [userData, isFreePlan])

  React.useEffect(() => {
    async function fetchPayments() {
      if (!currentUser?.uid) {
        setIsLoadingPayments(false)
        return
      }
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
    const amountMinor = Number(payment?.amount || 0)
    const amountMajor = Number.isFinite(amountMinor) ? amountMinor / 100 : 0
    return `${currency} ${amountMajor.toFixed(2)}`
  }

  const formatDate = (value, fallback = 'Recently') => {
    if (!value) return fallback
    const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
    if (Number.isNaN(parsed.getTime())) return fallback
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const memberSince = formatDate(userData?.createdAt, 'Recently')
  const cycleEnd = userData?.billing_cycle_end || userData?.subscription_expiry
  const daysLeft = cycleEnd
    ? Math.max(0, Math.ceil((new Date(cycleEnd) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center text-white gap-4 px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Sign in required</p>
          <p className="text-sm text-gray-500 mt-1">Please sign in to view your Lekha Captions account.</p>
        </div>
        <Link to="/login">
          <Button className="bg-white hover:bg-gray-100 text-black font-semibold rounded-xl px-6">Sign In</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#f5a623]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <div className="relative border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
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

      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 sm:p-7 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Profile" className="w-16 h-16 rounded-2xl border border-white/15 object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f5a623] to-[#a06412] border border-white/15 flex items-center justify-center text-black font-black text-xl">
                  {getInitials(currentUser.displayName || currentUser.email)}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#f5a623] font-bold">Manage Account</p>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{currentUser.displayName || 'Lekha Creator'}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                  <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{currentUser.email}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Member since {memberSince}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setIsPricingModalOpen(true)}
                className="h-11 rounded-xl bg-white text-black hover:bg-gray-100 font-bold px-5"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="h-11 rounded-xl bg-transparent border-white/15 text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.05fr_1.6fr] gap-5 mt-5">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-[#101010]/90 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Current Plan</p>
                  <h2 className="text-3xl font-black mt-2">{planDetails.name}</h2>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#f5a623]/15 border border-[#f5a623]/25 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-[#f5a623]" />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-sm font-semibold">Export credits</p>
                    <p className="text-xs text-gray-500">Credits reset with your billing cycle.</p>
                  </div>
                  <p className="text-sm font-bold">{creditsRemaining} / {totalCredits}</p>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#f5a623] to-white transition-all"
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
                  <p className="text-xs text-gray-500">Billing status</p>
                  <p className="font-bold mt-1">{isFreePlan ? 'Free forever' : `${daysLeft} days left`}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
                  <p className="text-xs text-gray-500">Account safety</p>
                  <p className="font-bold mt-1 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Active
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#101010]/90 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Quick Actions</p>
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => setIsPricingModalOpen(true)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] p-4 text-left transition-colors flex items-center gap-3"
                >
                  <Sparkles className="w-5 h-5 text-[#f5a623]" />
                  <div>
                    <p className="text-sm font-bold">Compare plans</p>
                    <p className="text-xs text-gray-500">Unlock more exports and 4K quality.</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/dashboard', { state: { restoreSession: true } })}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] p-4 text-left transition-colors flex items-center gap-3"
                >
                  <WalletCards className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-sm font-bold">Return to editor</p>
                    <p className="text-xs text-gray-500">Continue your current caption project.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#101010]/90 overflow-hidden">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Billing History</p>
                <h2 className="text-xl font-black mt-1">Payments and receipts</h2>
              </div>
              <ReceiptText className="w-6 h-6 text-gray-500" />
            </div>

            {isLoadingPayments ? (
              <div className="px-5 py-16 text-center text-gray-500 text-sm">Loading payment history...</div>
            ) : payments.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <ReceiptText className="w-7 h-7 text-gray-500" />
                </div>
                <p className="text-white font-bold mt-4">No payments yet</p>
                <p className="text-gray-500 text-sm mt-1">Your receipts will appear here after your first upgrade.</p>
                <button
                  onClick={() => setIsPricingModalOpen(true)}
                  className="mt-4 text-sm text-[#f5a623] hover:text-white transition-colors font-semibold"
                >
                  View available plans
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {payments.map((payment, i) => (
                  <div key={payment.payment_id || i} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm capitalize">{payment.plan?.replace('_', ' ') || 'Plan purchase'}</p>
                      <p className="text-xs text-gray-500">{formatDate(payment.timestamp, 'Payment date unavailable')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{formatPaymentAmount(payment)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400">{payment.status === 'captured' ? 'Paid' : payment.status || 'Processed'}</p>
                    </div>
                    <button className="hidden sm:flex w-9 h-9 rounded-xl border border-white/10 items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {isRenewalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Subscription expired</h3>
            <p className="text-gray-400 text-sm mb-5">
              Your billing cycle has ended. Please renew to continue exporting videos.
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
