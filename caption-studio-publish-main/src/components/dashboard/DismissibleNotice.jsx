import React, { useState } from 'react'
import { X } from 'lucide-react'

// Dismiss presentation only. The condition and any recovery safeguards stay intact.
// Callers key changing messages so a new notification is visible again.
export default function DismissibleNotice({ children, className = '', contentClassName = 'flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3', closeLabel = 'Close notification', onDismiss, ...props }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div role="status" {...props} className={`flex items-start gap-3 ${className}`}>
      <div className={contentClassName}>{children}</div>
      <button
        type="button"
        aria-label={closeLabel}
        title="Close"
        onClick={() => { setDismissed(true); onDismiss?.() }}
        className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded p-1 text-current opacity-80 hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
