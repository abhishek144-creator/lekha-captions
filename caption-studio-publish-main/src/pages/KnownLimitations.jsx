import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import SupportPageShell from '@/components/support/SupportPageShell'

const limitations = [
  {
    title: 'AI captions need review',
    description: 'Accuracy varies with background noise, overlapping speakers, accents, names, specialist terms, and mixed-language speech. Review every caption before publishing.',
  },
  {
    title: 'Short-form video is the priority',
    description: 'Lekha is optimized for Shorts and Reels. Files can be up to 500 MB, while the maximum duration depends on the active plan and current beta capacity.',
  },
  {
    title: 'Processing can be temporarily limited',
    description: 'Uploads, transcription, or exports may be paused during maintenance or when beta capacity is full. Saved work remains available and failed exports do not consume credits.',
  },
  {
    title: 'Preview and export use different renderers',
    description: 'The editor preview runs in the browser and final video rendering runs on the server. Complex animated templates can show small timing or typography differences.',
  },
  {
    title: 'Google sign-in only',
    description: 'The current beta supports Google sign-in. Email/password accounts, team workspaces, and real-time collaborative editing are not currently offered.',
  },
  {
    title: 'Modern browsers work best',
    description: 'Use a current version of Chrome, Edge, Safari, or Firefox. Export downloads and large uploads can be less reliable in in-app browsers or on unstable mobile networks.',
  },
]

export default function KnownLimitations() {
  return (
    <SupportPageShell
      active="limitations"
      eyebrow="Beta transparency"
      title="Known limitations"
      description="What Lekha Captions does well today, and where you should take extra care."
      pageCode="07"
      detail="Updated 6 August 2026 for the invite-only public beta."
      accent="#F5A623"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="grid gap-5 md:grid-cols-2">
          {limitations.map((item, index) => (
            <article key={item.title} className="rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623]/15 text-[#9A6200]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <span className="font-mono text-xs text-[#171713]/30">0{index + 1}</span>
              </div>
              <h2 className="mt-7 text-xl font-semibold tracking-[-0.02em]">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#171713]/60">{item.description}</p>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-[1.5rem] border border-[#27AE60]/25 bg-[#27AE60]/10 p-6 sm:p-8">
          <div className="flex gap-4">
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#176C3A]" />
            <div>
              <h2 className="font-semibold text-[#174F32]">What happens when a job fails</h2>
              <p className="mt-2 text-sm leading-7 text-[#174F32]/75">
                Provider or system transcription failures return the reserved daily allowance, and failed exports do not consume an export credit. Error messages include a reference you can send to support.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/HelpAndSupport" className="inline-flex items-center gap-2 rounded-full bg-[#151612] px-6 py-3 text-sm font-semibold text-white">
            Contact support <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/Changelog" className="inline-flex items-center gap-2 rounded-full border border-[#171713]/20 px-6 py-3 text-sm font-semibold text-[#171713]">
            View recent updates
          </Link>
        </div>
      </div>
    </SupportPageShell>
  )
}
