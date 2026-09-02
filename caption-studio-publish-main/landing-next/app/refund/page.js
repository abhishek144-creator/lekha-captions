import Link from 'next/link'
import { PageHero } from '@/components/PageHero'
import { grievanceEmail, grievanceOfficerName, legalBusinessAddress, legalBusinessName, pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Refund and cancellation policy',
  description: 'Learn how Lekha Captions billing works, when refunds are available, and how to request one.',
  path: '/refund',
})

const sections = [
  ['How billing works', 'Plans are one-time purchases for a fixed period. Lekha Captions does not hold a recurring mandate and does not automatically renew or charge a plan.'],
  ['When we refund', 'We consider refunds for duplicate charges, captured payments that did not activate the purchased entitlement, permanent service-side failures, and any case where applicable law requires a refund.'],
  ['Usage and eligibility', 'Completed exports and substantially used allowances may reduce refund eligibility, except where applicable law requires otherwise. Failed exports do not consume an export credit.'],
  ['How to request one', `Email ${supportEmail} from the address on your account. Include the Razorpay payment ID and a concise description. Never send a password, OTP, full card number, or CVV.`],
  ['Processing time', 'Approved refunds are initiated through Razorpay to the original payment method. Bank or card processing time is controlled by the payment provider and financial institution.'],
  ['Complaint timing and escalation', `We acknowledge complaints within 48 hours and aim to resolve them within one month. If support does not resolve your concern, contact ${grievanceOfficerName} at ${grievanceEmail} with the earlier support reference. This does not limit any consumer remedy available under applicable law.`],
  ['Seller', `${legalBusinessName}, ${legalBusinessAddress}.`],
]

export default function RefundPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Refund and cancellation policy" description="How fixed-period plans, refund requests, and credits are handled." />
      <article className="legal-content container narrow">
        <p className="legal-date">Version 2026-09-02 • Effective September 2, 2026</p>
        {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <p>Refund requests: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
        <p className="legal-crosslink">See also our <Link href="/terms/">Terms and Conditions</Link>.</p>
      </article>
    </>
  )
}
