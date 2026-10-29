import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { apiRequest, getApiErrorMessage } from '@/lib/apiClient'

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com'

// Feedback goes through the support intake (issue type "feedback"), so it is
// stored, rate limited and alerted exactly like a Help & Support ticket.
// Signed-in users reply to their account email without it being shown; the
// popover shows the support address instead.
export default function FeedbackButton({ email = '' }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState(email)
  const [status, setStatus] = useState({ sending: false, error: '', ticket: '' })

  const send = async (event) => {
    event.preventDefault()
    setStatus({ sending: true, error: '', ticket: '' })
    try {
      const result = await apiRequest('/api/support-request', {
        method: 'POST',
        body: JSON.stringify({
          account_email: contact.trim(),
          issue_type: 'feedback',
          browser_device: String(navigator.userAgent || 'unknown browser').slice(0, 300),
          description: message.trim(),
        }),
      })
      setMessage('')
      setStatus({ sending: false, error: '', ticket: result.ticket_id || 'sent' })
    } catch (error) {
      setStatus({ sending: false, error: getApiErrorMessage(error), ticket: '' })
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setStatus({ sending: false, error: '', ticket: '' })
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Send feedback"
          className="h-8 rounded-lg border border-white/10 bg-white/[0.03] text-gray-200 hover:text-white hover:bg-white/10 font-semibold"
        >
          <MessageSquarePlus className="w-4 h-4 lg:mr-2" />
          <span className="hidden lg:inline">Feedback</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 bg-zinc-900 border-white/10 p-4 text-white">
        {status.ticket ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Thanks, we got it.</p>
            <p className="text-xs text-gray-400">Reference {status.ticket}. We read every message.</p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <p className="text-sm font-semibold">Tell us what to improve</p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              minLength={10}
              maxLength={5000}
              rows={4}
              placeholder="What worked, what didn't, what you'd like next…"
              aria-label="Your feedback"
              className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-gray-500 focus:border-[#F5A623] focus:outline-none"
            />
            {!email && (
              <input
                type="email"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                required
                placeholder="Your email, so we can reply"
                aria-label="Your email"
                className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-gray-500 focus:border-[#F5A623] focus:outline-none"
              />
            )}
            <p className="text-xs text-gray-400">
              Or email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#F5A623] hover:underline">{SUPPORT_EMAIL}</a>
            </p>
            {status.error && <p role="alert" className="text-xs text-red-300">{status.error}</p>}
            <Button
              type="submit"
              size="sm"
              disabled={status.sending || message.trim().length < 10}
              className="w-full bg-[#F5A623] text-black font-semibold hover:bg-[#ffb83d]"
            >
              {status.sending ? 'Sending…' : 'Send feedback'}
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  )
}
