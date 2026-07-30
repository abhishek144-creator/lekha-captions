import { Link } from 'react-router-dom'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

const sections = [
  ['Information we process', 'We process your Firebase account identity, plan and payment records, uploaded audio or video, generated captions, export history, support requests, and limited operational telemetry such as request identifiers and performance data.'],
  ['Why we process it', 'We use this data to authenticate you, transcribe and translate media, render exports, enforce plan limits, process payments, prevent abuse, provide support, and operate the service securely.'],
  ['Service providers', 'Firebase provides authentication, database, and object storage; OpenAI and Sarvam may process audio or text for transcription or translation; Razorpay processes payments. These providers receive only the information required for their function, and process it under their own terms and security commitments.'],
  ['AI training', 'Lekha Captions does not use your videos, audio, captions, or exports to train its own AI models, and we do not sell or share your content for advertising. Your files are processed only to produce the captions and exports you asked for, and are deleted on the retention schedule below.'],
  ['Retention', 'Uploaded source media is scheduled for deletion within six hours. Exported media is retained for 2 to 72 hours depending on plan. Short export history and payment records remain with the account where required for service, accounting, fraud prevention, or legal obligations. Operational security records use bounded retention schedules.'],
  ['Your choices and rights', 'You can export your account data or delete your account from the account page. You may also contact support to request access, correction, restriction, or other rights available in your jurisdiction. Some payment or security records may be retained where legally required.'],
  ['Security', 'Media URLs are time-limited, access is authenticated, and entitlement changes are server-controlled. No system is completely secure; report suspected security issues through Help & Support.'],
  ['International processing', 'Our providers may process data in countries other than your own. Where required, we use applicable contractual and legal safeguards for those transfers.'],
  ['Children', 'The service is not directed to children who cannot legally consent to online services in their jurisdiction.'],
  ['Changes and contact', 'Material changes will be published with a new version date and may require renewed consent. Contact us through Help & Support for privacy questions or requests.'],
]

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/"><CaptionStudioLogo size="default" showText={true} /></Link>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
          <Link to="/TermsAndConditions" className="transition-colors hover:text-white">Terms</Link>
          <Link to="/RefundPolicy" className="transition-colors hover:text-white">Refunds</Link>
          <Link to="/AcceptableUsePolicy" className="transition-colors hover:text-white">Acceptable Use</Link>
          <Link to="/HelpAndSupport" className="transition-colors hover:text-white">Support</Link>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-gray-400">Legal</p>
        <h1 className="mb-3 text-4xl font-bold">Privacy Policy</h1>
        <p className="mb-12 text-sm text-gray-500">Version 2026-07-26 · Effective July 26, 2026</p>
        <div className="space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="mb-2 text-lg font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed text-gray-400">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-gray-400">Privacy requests: <a className="text-[#F5A623] hover:underline" href="mailto:support@lekhacaptions.com">support@lekhacaptions.com</a></p>
      </main>
    </div>
  )
}
