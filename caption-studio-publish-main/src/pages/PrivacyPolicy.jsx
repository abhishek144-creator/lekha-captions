import { Link } from 'react-router-dom'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

const legalBusinessName = import.meta.env.VITE_LEGAL_BUSINESS_NAME || 'Lekha Captions'
const legalBusinessAddress = import.meta.env.VITE_LEGAL_BUSINESS_ADDRESS || 'Business address available from support'
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com'
const grievanceOfficerName = import.meta.env.VITE_GRIEVANCE_OFFICER_NAME || 'Grievance Officer'
const grievanceEmail = import.meta.env.VITE_GRIEVANCE_EMAIL || supportEmail

const sections = [
  ['Controller and contact', `${legalBusinessName} is the controller/operator for account, billing, support, and product-usage data. Business address: ${legalBusinessAddress}. Privacy requests can be sent to ${supportEmail}.`],
  ['Information we process', 'We process your Firebase account identity, plan and payment records, uploaded audio or video, generated captions, export history, support requests, and limited operational telemetry such as request identifiers and performance data.'],
  ['Why we process it', 'With your consent and as necessary to provide the service you request, we use this data to authenticate you, transcribe and translate media, render exports, enforce plan limits, process payments, provide support, prevent fraud or abuse, comply with law, and operate securely.'],
  ['Service providers', 'Firebase provides authentication, database, and object storage; OpenAI and Sarvam may process audio or text for transcription or translation; Razorpay processes payments. These providers receive only the information required for their function, and process it under their own terms and security commitments.'],
  ['AI training', 'Lekha Captions does not use your videos, audio, captions, or exports to train its own AI models, and we do not sell or share your content for advertising. Your files are processed only to produce the captions and exports you asked for, and are deleted on the retention schedule below.'],
  ['Retention', 'Uploaded source media is scheduled for deletion within six hours. Exported media is retained for 2 to 72 hours depending on plan. Short export history and payment records remain with the account where required for service, accounting, fraud prevention, or legal obligations. Operational security records use bounded retention schedules.'],
  ['Your choices and rights', 'You can export your account data or permanently delete your account from the account page. You may withdraw consent for optional processing or request access, correction, completion, erasure, restriction, or grievance redressal by contacting the grievance officer. Withdrawing consent does not affect processing already lawfully completed and may prevent us from providing features that require that data. Some payment or security records may be retained where legally required.'],
  ['Security', 'Media URLs are time-limited, access is authenticated, and entitlement changes are server-controlled. No system is completely secure; report suspected security issues through Help & Support.'],
  ['International processing', 'Our providers may process data in countries other than your own. Where required, we use applicable contractual and legal safeguards for those transfers.'],
  ['Children', 'The service is not directed to children who cannot legally consent to online services in their jurisdiction.'],
  ['Grievances and complaints', `${grievanceOfficerName} is the appointed grievance contact. Email ${grievanceEmail}. We acknowledge consumer complaints within 48 hours and aim to resolve them within one month. Privacy grievances are handled within the period required by applicable law. Where the Digital Personal Data Protection Act complaint process applies, you may approach the Data Protection Board of India after first using our grievance process.`],
  ['Changes and contact', 'Material changes will be published with a new version date and may require renewed consent. Contact us through Help & Support for privacy questions or requests.'],
]

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/" aria-label="Lekha Captions home"><CaptionStudioLogo size="default" showText={true} /></Link>
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
        <p className="mb-12 text-sm text-gray-400">Version 2026-09-02 · Effective September 2, 2026</p>
        <div className="space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="mb-2 text-lg font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed text-gray-400">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-gray-400">Privacy and grievance requests: <a className="text-[#F5A623] underline underline-offset-2" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a></p>
      </main>
    </div>
  )
}
