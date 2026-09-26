import { analyzeCaptionQuality } from './captionQualityUtils'

export default function CaptionQualityPanel({ captions, captionStyle, compact = false }) {
  const report = analyzeCaptionQuality(captions, captionStyle)
  const hasFindings = report.details.length > 0

  return (
    <section className={`rounded-xl border ${hasFindings ? 'border-amber-300/20 bg-amber-300/[0.045]' : 'border-emerald-300/20 bg-emerald-300/[0.045]'} ${compact ? 'p-3' : 'p-4'}`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold ${hasFindings ? 'text-amber-100' : 'text-emerald-100'}`}>
            {hasFindings ? 'Caption review' : 'No obvious issues found'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            {report.captionCount} timed caption{report.captionCount === 1 ? '' : 's'} checked. Automated checks are prompts for a human review.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] text-gray-300">
          {hasFindings ? `${report.details.length} check${report.details.length === 1 ? '' : 's'}` : 'Clear'}
        </span>
      </div>
      {hasFindings && (
        <ul className="mt-3 space-y-2">
          {report.details.map((item) => (
            <li key={item.key} className="text-[11px] leading-5">
              <span className="font-semibold text-amber-100">{item.title}: </span>
              <span className="text-gray-400">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
