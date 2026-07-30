import { Link } from 'react-router-dom'
import { Flag, ShieldAlert } from 'lucide-react'
import SupportPageShell from '@/components/support/SupportPageShell'

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com'
const abuseEmail = import.meta.env.VITE_ABUSE_EMAIL || supportEmail

const prohibited = [
  {
    title: 'Content you do not have the rights to',
    body: 'Do not upload video or audio you do not own or have permission to process. You are responsible for holding the necessary rights and consents for everything you put through the service, including the voices and faces of people appearing in it.',
  },
  {
    title: 'Child sexual abuse material',
    body: 'Absolutely prohibited. Accounts are terminated immediately and reports are made to the appropriate authorities. There is no warning and no appeal for this category.',
  },
  {
    title: 'Non-consensual intimate imagery',
    body: 'Do not upload private, sexual, or intimate recordings of any person without their clear consent. This includes material created or altered to depict someone without their agreement.',
  },
  {
    title: 'Illegal content and activity',
    body: 'Do not use the service to produce, process, or distribute content that is unlawful where you are or where we operate, including content that incites violence or facilitates serious crime.',
  },
  {
    title: 'Harassment and impersonation',
    body: 'Do not use the service to target, threaten, or harass a person, or to impersonate someone else in a way intended to deceive.',
  },
  {
    title: 'Malware and abuse of the platform',
    body: 'Do not upload files intended to exploit our systems, attempt to break authentication, scrape at scale, probe for vulnerabilities without permission, or interfere with other customers’ use of the service.',
  },
  {
    title: 'Bypassing limits',
    body: 'Do not create multiple accounts, share one account across a team or resell access, or otherwise work around plan limits, credits, or rate limits.',
  },
]

const enforcement = [
  'We may remove content, suspend processing, or terminate an account that breaches this policy.',
  'For serious categories, particularly child safety, we act immediately and without prior notice.',
  'For less severe or first-time issues, we will normally contact you before taking action.',
  'Suspension for a policy breach does not automatically entitle you to a refund.',
]

export default function AcceptableUsePolicy() {
  return (
    <SupportPageShell
      active="acceptable-use"
      eyebrow="Legal"
      title="Acceptable Use Policy"
      description="Version 2026-07-26 · Last updated: July 26, 2026"
      pageCode="05"
      accent="#E4572E"
      accentGlow="rgba(228, 87, 46, 0.16)"
      detail="What you may not upload or do, how we enforce it, and how to report abuse."
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <section className="mb-16 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Scope / 00</p>
          <p className="mt-5 text-lg leading-9 text-[#171713]/70">
            This policy applies to everything you upload, generate, or export using Lekha Captions. It sits alongside
            our <Link to="/TermsAndConditions" className="font-semibold text-[#B7482F] hover:underline">Terms &amp; Conditions</Link>.
            Breaking it can cost you your account.
          </p>
        </section>

        <section>
          <div className="mb-8 flex items-center gap-3 border-b border-[#171713]/15 pb-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4572E] text-white">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Prohibited / 01</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">What you must not do</h2>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] px-6 sm:px-10">
            {prohibited.map((item, index) => (
              <article key={item.title} className="border-b border-[#171713]/10 py-8 last:border-b-0 sm:py-9">
                <div className="grid gap-3 sm:grid-cols-[48px_1fr] sm:gap-5">
                  <span className="font-serif text-2xl text-[#E4572E]">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.015em]">{item.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[#171713]/60">{item.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Enforcement / 02</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">How we act</h2>
          </div>
          <ul className="space-y-4">
            {enforcement.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-7 text-[#171713]/65">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E4572E]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="relative mt-20 overflow-hidden rounded-[2rem] bg-[#151612] px-7 py-10 text-white sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[#E4572E]/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Flag className="h-5 w-5 text-[#E4572E]" />
            </div>
            <h2 className="font-serif text-3xl tracking-[-0.025em]">Report illegal or infringing content</h2>
            <p className="mt-4 text-sm leading-7 text-white/60">
              If you believe content processed through Lekha Captions infringes your rights or breaks the law, email{' '}
              <a className="font-semibold text-white hover:underline" href={`mailto:${abuseEmail}`}>{abuseEmail}</a> with
              the subject line <span className="font-mono text-white/80">ABUSE REPORT</span>. Tell us what the content
              is, where you encountered it, why it is unlawful or infringing, and how we can reach you. If you are
              reporting a copyright claim, confirm that you are the rights holder or are authorised to act for them.
            </p>
            <p className="mt-4 text-sm leading-7 text-white/60">
              We review reports as quickly as we can and prioritise child-safety and non-consensual imagery reports
              above everything else.
            </p>
          </div>
        </section>

        <section className="mt-16 flex flex-col gap-4 border-t border-[#171713]/15 pt-8 text-sm text-[#171713]/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Questions: <a className="font-semibold text-[#B7482F] hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/TermsAndConditions" className="underline decoration-[#E4572E] decoration-2 underline-offset-4">Terms</Link>
            <Link to="/RefundPolicy" className="underline decoration-[#E4572E] decoration-2 underline-offset-4">Refunds</Link>
            <Link to="/PrivacyPolicy" className="underline decoration-[#E4572E] decoration-2 underline-offset-4">Privacy</Link>
          </p>
        </section>
      </div>
    </SupportPageShell>
  )
}
