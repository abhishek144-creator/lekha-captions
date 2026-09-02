import { CheckCircle2 } from 'lucide-react'
import SupportPageShell from '@/components/support/SupportPageShell'

const releases = [
  {
    date: '6 August 2026',
    title: 'Beta launch hardening',
    status: 'Current',
    changes: [
      'Added customer-visible references to API, transcription, and export error messages.',
      'Published a dedicated known-limitations page and an operational support-ticket workflow.',
      'Verified the complete local upload, English transcription, 1080p export, and download flow with a user-provided video.',
    ],
  },
  {
    date: '5 August 2026',
    title: 'Deployment recovery and account safety',
    changes: [
      'Rehearsed a Netlify rollback and restored the current editor deployment.',
      'Verified full account deletion using an isolated disposable Firebase account.',
      'Ran the deployed payment-reconciliation control and stored its audit record.',
    ],
  },
  {
    date: '4 August 2026',
    title: 'Staging infrastructure verified',
    changes: [
      'Deployed the editor on Netlify and the API, worker, and Redis services on Railway.',
      'Deployed restrictive Firebase Storage and Firestore rules and indexes.',
      'Completed queue recovery, backup restoration, and a 200-request staging load smoke test.',
    ],
  },
  {
    date: '30 July 2026',
    title: 'Caption editing and export parity',
    changes: [
      'Fixed dragged-word positioning in exported videos and kept edited words interactive during playback.',
      'Improved template motion, typography, and final-frame parity between the editor and exported MP4.',
      'Made yearly pricing the default presentation across all pricing surfaces.',
    ],
  },
]

export default function Changelog() {
  return (
    <SupportPageShell
      active="changelog"
      eyebrow="Release notes"
      title="What changed"
      description="Customer-facing improvements, reliability work, and launch-readiness updates."
      pageCode="08"
      detail="Dates describe when changes were verified, not only when code was written."
      accent="#55D6BE"
      accentGlow="rgba(85, 214, 190, 0.18)"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="space-y-6">
          {releases.map((release, index) => (
            <article key={`${release.date}-${release.title}`} className="grid gap-5 rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 sm:grid-cols-[180px_1fr] sm:p-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#171713]/70">Release {String(releases.length - index).padStart(2, '0')}</p>
                <p className="mt-3 text-sm font-semibold text-[#171713]/70">{release.date}</p>
                {release.status ? <span className="mt-4 inline-flex rounded-full bg-[#55D6BE]/20 px-3 py-1 text-xs font-semibold text-[#176C5A]">{release.status}</span> : null}
              </div>
              <div>
                <h2 className="font-serif text-3xl tracking-[-0.025em]">{release.title}</h2>
                <ul className="mt-5 space-y-3">
                  {release.changes.map((change) => (
                    <li key={change} className="flex gap-3 text-sm leading-7 text-[#171713]/65">
                      <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-[#238B73]" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SupportPageShell>
  )
}
