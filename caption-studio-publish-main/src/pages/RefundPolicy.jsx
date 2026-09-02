import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import SupportPageShell from '@/components/support/SupportPageShell'

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com'
const legalBusinessName = import.meta.env.VITE_LEGAL_BUSINESS_NAME || 'Lekha Captions'
const legalBusinessAddress = import.meta.env.VITE_LEGAL_BUSINESS_ADDRESS || 'Business address available from support'
const grievanceOfficerName = import.meta.env.VITE_GRIEVANCE_OFFICER_NAME || 'Grievance Officer'
const grievanceEmail = import.meta.env.VITE_GRIEVANCE_EMAIL || supportEmail

const eligible = [
  'You were charged twice for the same plan or top-up.',
  'Your payment was captured but the plan or credits were never activated on your account.',
  'Credits were deducted for work that permanently failed because of a fault on our side.',
  'A technical failure prevented you from using the service and our support team could not resolve it.',
  'You request a refund within 7 days of your first paid purchase and have not substantially used the included export allowance.',
  'Any other situation where a refund is required by applicable law.',
]

const notEligible = [
  'Credits already spent on exports that completed and were delivered to you.',
  'Dissatisfaction with transcription accuracy alone. AI transcription varies with audio quality, accents, background noise, and language mixing — review the free preview before you export.',
  'Time remaining on a plan you simply stopped using.',
  'Requests made after the plan period has already ended, except where law requires otherwise.',
]

const steps = [
  {
    title: 'Email us',
    body: `Write to ${supportEmail} from the email address registered on your Lekha Captions account. Include the Razorpay payment ID and a short description of what happened.`,
  },
  {
    title: 'We review',
    body: 'We check the payment, your account usage, and any related job or error logs. We acknowledge complaints within 48 hours and aim to resolve them within one month. Most requests receive an initial human response within one business day.',
  },
  {
    title: 'We decide',
    body: 'We approve a full refund, a partial refund, or account credit, and tell you which and why.',
  },
  {
    title: 'We initiate it',
    body: 'Approved refunds are initiated from Razorpay to your original payment method. Bank processing typically takes about 5 to 7 business days after initiation. The exact timing depends on your bank or card issuer.',
  },
]

const sections = [
  {
    title: 'How billing works',
    body: 'Lekha Captions plans are one-time purchases for a fixed period — 30 days for monthly plans and 365 days for yearly plans. We do not store a recurring mandate and we do not auto-renew or auto-charge you. When your plan period ends, your account simply returns to the free tier until you choose to buy again. Because nothing renews automatically, there is no recurring subscription to cancel.',
  },
  {
    title: 'Cancelling',
    body: 'You can stop using Lekha Captions at any time, and you will not be charged again. Your paid features remain available until the end of the period you already paid for. Cancelling or stopping use does not by itself refund an earlier payment — refunds follow the eligibility rules on this page. Deleting your account is a separate action from ending a plan, and it permanently removes your data.',
  },
  {
    title: 'Credits and expiry',
    body: 'Each plan includes a set number of export credits for its period. One credit is consumed only when an export completes successfully — failed exports never consume a credit. Unused credits expire at the end of your plan period and do not carry over to a new purchase. Top-up credits are added to your active paid plan and expire with that same plan period.',
  },
  {
    title: 'Chargebacks',
    body: 'If you believe a charge is wrong, please contact us first. A chargeback raised with your bank without contacting us takes longer to resolve for everyone and may result in account suspension while the dispute is investigated. We keep payment, usage, and delivery records so that genuine disputes can be resolved accurately.',
  },
  {
    title: 'Escalating a complaint',
    body: `If support does not resolve your concern, contact ${grievanceOfficerName} at ${grievanceEmail}. Include the earlier support reference and do not send passwords, OTPs, complete card numbers, or CVVs. This process does not limit any consumer remedy available under applicable law.`,
  },
]

export default function RefundPolicy() {
  return (
    <SupportPageShell
      active="refunds"
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      description="Version 2026-09-02 · Last updated: September 2, 2026"
      pageCode="04"
      accent="#4F8EF7"
      accentGlow="rgba(79, 142, 247, 0.17)"
      detail="When refunds apply, how to request one, and what happens to your credits."
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <section className="mb-16 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/70">Summary / 00</p>
          <p className="mt-5 text-lg leading-9 text-[#171713]/70">
            Lekha Captions plans do not auto-renew, so you will never be charged unexpectedly. If we took your money
            and did not deliver, we refund it. If a job failed because of us, we make it right. Email{' '}
            <a className="font-semibold text-[#1E4FA8] hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>{' '}
            and a human will read it.
          </p>
          <p className="mt-4 text-sm leading-7 text-[#171713]/70">
            Seller: {legalBusinessName} · {legalBusinessAddress}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#27AE60] text-white">
                <Check className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">We refund</h2>
            </div>
            <ul className="mt-6 space-y-4">
              {eligible.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-7 text-[#171713]/65">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#27AE60]" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171713]/70 text-white">
                <X className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">We usually cannot refund</h2>
            </div>
            <ul className="mt-6 space-y-4">
              {notEligible.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-7 text-[#171713]/65">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#171713]/35" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-[#171713]/10 pt-5 text-sm leading-7 text-[#171713]/70">
              Where a significant part of your export allowance has already been used, a refund may be reduced in
              proportion or declined. We look at each request individually.
            </p>
          </article>
        </section>

        <section className="mt-20">
          <div className="mb-8 border-b border-[#171713]/15 pb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/70">Process / 01</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">How to request a refund</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6">
                <span className="font-serif text-2xl text-[#4F8EF7]">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.015em]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#171713]/60">{step.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm leading-7 text-[#171713]/70">
            We will never ask you for your password, OTP, full card number, or CVV. Nobody from Lekha Captions needs
            them, and any message that asks for them is not from us.
          </p>
        </section>

        <section className="mt-20">
          <div className="mb-8 border-b border-[#171713]/15 pb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/70">Details / 02</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">Plans, credits, and disputes</h2>
          </div>
          <div className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] px-6 sm:px-10">
            {sections.map((section) => (
              <section key={section.title} className="border-b border-[#171713]/10 py-8 last:border-b-0 sm:py-10">
                <h3 className="text-lg font-semibold tracking-[-0.015em]">{section.title}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#171713]/60">{section.body}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-16 flex flex-col gap-4 border-t border-[#171713]/15 pt-8 text-sm text-[#171713]/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Refund requests: <a className="font-semibold text-[#1E4FA8] hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/TermsAndConditions" className="underline decoration-[#4F8EF7] decoration-2 underline-offset-4">Terms</Link>
            <Link to="/AcceptableUsePolicy" className="underline decoration-[#4F8EF7] decoration-2 underline-offset-4">Acceptable Use</Link>
            <Link to="/HelpAndSupport" className="underline decoration-[#4F8EF7] decoration-2 underline-offset-4">Support</Link>
          </p>
        </section>
      </div>
    </SupportPageShell>
  )
}
