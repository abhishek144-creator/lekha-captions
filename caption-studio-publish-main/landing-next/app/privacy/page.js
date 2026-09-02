import Link from 'next/link'
import { PageHero } from '@/components/PageHero'
import { grievanceEmail, grievanceOfficerName, legalBusinessAddress, legalBusinessName, pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Privacy policy',
  description: 'Learn what information Lekha Captions processes, why it is used, which service providers are involved, how long media is retained, and your privacy choices.',
  path: '/privacy',
})

const sections = [
  ['Controller and contact', `${legalBusinessName} is the controller/operator for account, billing, support, and product-usage data. Business address: ${legalBusinessAddress}. Privacy requests can be sent to ${supportEmail}.`],
  ['Information we process', 'We process your account identity, plan and payment records, uploaded audio or video, generated captions, export history, support requests, and limited operational telemetry such as request identifiers and performance data.'],
  ['Why we process it', 'With your consent and as necessary to provide the Service you request, we use this data to authenticate you, transcribe and translate media, render exports, enforce plan limits, process payments, provide support, prevent fraud or abuse, comply with law, and operate securely.'],
  ['Service providers', 'Firebase provides authentication, database, and object storage services. OpenAI and Sarvam may process audio or text for transcription or translation. Razorpay processes payments. Providers receive only the information required for their role.'],
  ['Retention', 'Uploaded source media is scheduled for deletion within six hours. Exported media is retained for 2 to 72 hours depending on plan. Limited export history and payment records may remain where needed for service, accounting, fraud prevention, security, or legal obligations.'],
  ['Your choices and rights', 'You can export account data or permanently delete your account using the account tools. You may withdraw consent for optional processing or request access, correction, completion, erasure, restriction, or grievance redressal through the grievance contact. Withdrawing consent does not affect processing already lawfully completed and may prevent features that require the data. Some payment or security records may be retained where legally required.'],
  ['Security', 'Media URLs are time-limited, access is authenticated, and entitlement changes are controlled by the server. No system is completely secure, so report suspected security issues through the support options shown in the Service.'],
  ['International processing', 'Our providers may process data in countries other than your own. Where required, we rely on applicable contractual and legal safeguards for those transfers.'],
  ['Children', 'The Service is not directed to children who cannot legally consent to online services in their jurisdiction.'],
  ['Grievances and complaints', `${grievanceOfficerName} is the appointed grievance contact. Email ${grievanceEmail}. We acknowledge consumer complaints within 48 hours and aim to resolve them within one month. Privacy grievances are handled within the period required by applicable law. Where the Digital Personal Data Protection Act complaint process applies, you may approach the Data Protection Board of India after first using our grievance process.`],
  ['Changes and contact', 'Material changes will be published with a new version date and may require renewed consent. Use the Help page or the support options inside the app for privacy questions and requests.'],
]

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" description="How Lekha Captions handles account information, uploaded media, generated captions, and service data." />
      <article className="legal-content container narrow">
        <p className="legal-date">Version 2026-09-02 • Effective September 2, 2026</p>
        {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <p>Privacy and grievance requests: <a href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
        <p className="legal-crosslink">See also our <Link href="/terms/">Terms and Conditions</Link> and <Link href="/acceptable-use/">Acceptable Use Policy</Link>.</p>
      </article>
    </>
  )
}
