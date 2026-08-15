import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BookOpen, FileText, MessageCircle, Zap } from 'lucide-react';
import SupportPageShell from '@/components/support/SupportPageShell';
import { apiRequest, getApiErrorMessage } from '@/lib/apiClient';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com';

const topics = [
  {
    icon: Zap,
    title: 'Getting Started',
    desc: 'Upload a video, choose a language, and let Lekha auto-generate your captions in seconds.',
    color: '#F5A623',
  },
  {
    icon: BookOpen,
    title: 'Editing Captions',
    desc: 'Click any word to edit text, drag to reposition, and use the Style tab for per-word customization.',
    color: '#4F8EF7',
  },
  {
    icon: FileText,
    title: 'Templates & Styles',
    desc: 'Browse 25+ templates in the Templates tab. Use the Style, Animation, and Effects tabs to fully customize.',
    color: '#9B59B6',
  },
  {
    icon: MessageCircle,
    title: 'Export & Download',
    desc: 'Click Export to render your captioned video. Processing time depends on video length and complexity.',
    color: '#27AE60',
  },
];

const troubleshooting = [
  {
    issue: 'Upload or export says the service is paused',
    fix: 'We occasionally pause uploads, transcription, or exports for maintenance or capacity. Nothing you have saved is lost — wait a few minutes and try again. If it persists for more than an hour, email us.',
  },
  {
    issue: 'Captions not generating / wrong language',
    fix: 'Ensure you selected the correct source language before processing. Re-process the video after changing the language.',
  },
  {
    issue: 'Video not uploading',
    fix: 'Supported video formats are MP4, MOV, AVI, MKV, and WebM, up to 500 MB. Video length limits depend on your plan. If a file is too long or too large, trim or compress it and try again.',
  },
  {
    issue: 'Export failed or is stuck',
    fix: 'A failed export never consumes a credit. Retry it from the export panel. If it fails again, send us the job ID shown in the error message and we will investigate.',
  },
  {
    issue: 'Captions look out of sync',
    fix: 'Use the timeline scrubber to fine-tune caption start/end times. Drag caption handles on the timeline to adjust.',
  },
];

const reportChecklist = [
  'The email address on your Lekha Captions account',
  'The job ID or project name, if it is about a specific video',
  'The Razorpay payment ID, if it is about a payment',
  'Your browser and device (for example, Chrome on Windows)',
  'The video format, length, and approximate file size',
  'A screenshot or short screen recording of what you saw',
  'One or two lines on what you expected and what happened instead',
];

const emptyReport = {
  accountEmail: '',
  issueType: 'Export or rendering',
  jobId: '',
  paymentId: '',
  browserDevice: '',
  mediaDetails: '',
  description: '',
};

export default function HelpAndSupport() {
  const [report, setReport] = useState(emptyReport);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState('');

  const updateReport = (field) => (event) => {
    setReport((current) => ({ ...current, [field]: event.target.value }));
  };

  const prepareSupportEmail = (event) => {
    event.preventDefault();
    const subject = `[Lekha Support] ${report.issueType}${report.jobId ? ` · ${report.jobId}` : ''}`;
    const body = [
      `Account email: ${report.accountEmail}`,
      `Issue type: ${report.issueType}`,
      `Job / project ID: ${report.jobId || 'Not available'}`,
      `Razorpay payment ID: ${report.paymentId || 'Not applicable'}`,
      `Browser and device: ${report.browserDevice}`,
      `Video format, duration, and size: ${report.mediaDetails || 'Not applicable'}`,
      '',
      'What happened:',
      report.description,
      '',
      'Please attach a screenshot or short screen recording before sending, if available.',
    ].join('\n');

    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submitSupportRequest = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSubmittedTicket('');

    try {
      const result = await apiRequest('/api/support-request', {
        method: 'POST',
        body: JSON.stringify({
          account_email: report.accountEmail,
          issue_type: report.issueType,
          job_id: report.jobId,
          payment_id: report.paymentId,
          browser_device: report.browserDevice,
          media_details: report.mediaDetails,
          description: report.description,
        }),
      });
      setSubmittedTicket(result.ticket_id);
      setReport(emptyReport);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SupportPageShell
      active="support"
      eyebrow="Help Center"
      title="Help & Support"
      description="Find answers, learn how to use Lekha Captions, and get in touch with our team."
      pageCode="02"
      accent="#55D6BE"
      accentGlow="rgba(85, 214, 190, 0.17)"
      detail={`${topics.length} quick guides, ${troubleshooting.length} troubleshooting paths, and a direct line to support.`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <section>
          <div className="mb-8 flex items-end justify-between gap-6 border-b border-[#171713]/15 pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Start here / 01</p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">Quick Guides</h2>
            </div>
            <span className="hidden text-sm text-[#171713]/45 sm:block">Choose a workflow</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {topics.map((topic, index) => (
              <article
                key={topic.title}
                className="group relative min-h-[230px] overflow-hidden rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-7"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: topic.color }}>
                    <topic.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs text-[#171713]/30">0{index + 1}</span>
                </div>
                <h3 className="mt-9 text-xl font-semibold tracking-[-0.02em]">{topic.title}</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-[#171713]/60">{topic.desc}</p>
                <div className="absolute bottom-0 left-0 h-1 w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" style={{ backgroundColor: topic.color }} />
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Fix a problem / 02</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">Troubleshooting</h2>
            <p className="mt-4 text-sm leading-6 text-[#171713]/55">Fast checks for the most common issues.</p>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4]">
            {troubleshooting.map((item, index) => (
              <article key={item.issue} className="grid gap-4 border-b border-[#171713]/10 p-6 last:border-b-0 sm:grid-cols-[48px_1fr] sm:p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623]/15 text-[#9A6200]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 font-mono text-[10px] text-[#171713]/30">0{index + 1}</span>
                    <h3 className="font-semibold leading-6">{item.issue}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[#171713]/60">{item.fix}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Report a problem / 03</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">What to send us</h2>
            <p className="mt-4 text-sm leading-6 text-[#171713]/55">
              The more of this you include, the faster we can fix it.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {reportChecklist.map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-[1rem] border border-[#171713]/12 bg-[#FBF9F4] px-5 py-4 text-sm leading-6 text-[#171713]/65"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#55D6BE]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">Contact form / 04</p>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em] sm:text-4xl">Send a support report</h2>
            <p className="mt-4 text-sm leading-6 text-[#171713]/55">
              Submit the details here so the support team can track and respond to your request.
            </p>
          </div>

          <form
            onSubmit={submitSupportRequest}
            className="grid gap-5 rounded-[1.5rem] border border-[#171713]/15 bg-[#FBF9F4] p-6 sm:grid-cols-2 sm:p-8"
          >
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Account email
              <input
                required
                type="email"
                value={report.accountEmail}
                onChange={updateReport('accountEmail')}
                autoComplete="email"
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none focus:border-[#171713]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Issue type
              <select
                value={report.issueType}
                onChange={updateReport('issueType')}
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none focus:border-[#171713]"
              >
                <option>Export or rendering</option>
                <option>Transcription accuracy</option>
                <option>Upload or file format</option>
                <option>Payment or credits</option>
                <option>Refund</option>
                <option>Account deletion</option>
                <option>Privacy or video data</option>
                <option>Other</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Job or project ID
              <input
                type="text"
                value={report.jobId}
                onChange={updateReport('jobId')}
                placeholder="Shown in a failed-job message"
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none placeholder:text-[#171713]/35 focus:border-[#171713]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Razorpay payment ID
              <input
                type="text"
                value={report.paymentId}
                onChange={updateReport('paymentId')}
                placeholder="Only for payment issues"
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none placeholder:text-[#171713]/35 focus:border-[#171713]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Browser and device
              <input
                required
                type="text"
                value={report.browserDevice}
                onChange={updateReport('browserDevice')}
                placeholder="Chrome on Android, Safari on iPhone..."
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none placeholder:text-[#171713]/35 focus:border-[#171713]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713]">
              Video details
              <input
                type="text"
                value={report.mediaDetails}
                onChange={updateReport('mediaDetails')}
                placeholder="MP4 · 42 seconds · 18 MB"
                className="rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal outline-none placeholder:text-[#171713]/35 focus:border-[#171713]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#171713] sm:col-span-2">
              What happened?
              <textarea
                required
                rows={5}
                value={report.description}
                onChange={updateReport('description')}
                placeholder="Tell us what you expected and what happened instead."
                className="resize-y rounded-xl border border-[#171713]/20 bg-white px-4 py-3 font-normal leading-6 outline-none placeholder:text-[#171713]/35 focus:border-[#171713]"
              />
            </label>
            <div className="sm:col-span-2">
              {submittedTicket ? (
                <p className="mb-4 rounded-xl border border-[#27AE60]/30 bg-[#27AE60]/10 px-4 py-3 text-sm text-[#176C3A]">
                  Request received. Your ticket ID is <strong>{submittedTicket}</strong>.
                </p>
              ) : null}
              {submitError ? (
                <p className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#151612] px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Submit support request'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={prepareSupportEmail}
                className="ml-3 inline-flex items-center justify-center rounded-full border border-[#171713]/20 px-5 py-3 text-sm font-semibold text-[#171713]"
              >
                Open email instead
              </button>
              <p className="mt-3 text-xs leading-5 text-[#171713]/45">
                Never include a password, OTP, full card number, or CVV. Attachments can be sent by email.
              </p>
            </div>
          </form>
        </section>

        <section className="relative mt-20 overflow-hidden rounded-[2rem] bg-[#151612] px-7 py-10 text-white sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[#55D6BE]/15 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <MessageCircle className="h-5 w-5 text-[#55D6BE]" />
              </div>
              <h2 className="font-serif text-3xl tracking-[-0.025em]">Contact Us</h2>
              <p className="mt-3 text-sm leading-7 text-white/55">
                Have a question not answered here? Email us and a human will read it. We normally respond within one
                business day. Complex transcription, rendering, or payment issues may need further investigation, so
                we promise you a reply — not always a same-day fix.
              </p>
              <p className="mt-4 text-sm leading-7 text-white/55">
                We will never ask you for your password, OTP, full card number, or CVV.
              </p>
              <p className="mt-4 text-xs text-white/40">
                <Link to="/Faq" className="text-white/70 hover:text-white">Browse FAQ</Link> for common questions, or read our{' '}
                <Link to="/RefundPolicy" className="text-white/70 hover:text-white">Refund &amp; Cancellation Policy</Link>.
              </p>
            </div>
            <a
              href={`mailto:${supportEmail}`}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#151612] transition-transform hover:-translate-y-0.5"
            >
              Email {supportEmail}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </section>
      </div>
    </SupportPageShell>
  );
}
