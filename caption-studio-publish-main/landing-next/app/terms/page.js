import Link from 'next/link'
import { PageHero } from '@/components/PageHero'
import { pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Terms and conditions',
  description: 'Read the terms governing access to and use of Lekha Captions, including acceptable use, intellectual property, data, accuracy, and liability.',
  path: '/terms',
})

const sections = [
  ['1. Acceptance of terms', 'By accessing or using Lekha Captions (the “Service”), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.'],
  ['2. Use of the Service', 'You may use Lekha Captions only for lawful purposes. You must not upload content that is unlawful, harmful, defamatory, infringing, or otherwise objectionable. You are responsible for the content you upload and process.'],
  ['3. Intellectual property', 'All rights, title, and interest in the Service, excluding user-uploaded content, remain the property of Lekha Captions. You retain ownership of your videos and the captions generated from them.'],
  ['4. Privacy and data', 'Uploaded videos are processed by Lekha Captions and the providers identified in the Privacy Policy for transcription, translation, storage, export, and payment functions. Source and exported media are retained temporarily according to the published retention schedule.'],
  ['5. AI-generated caption accuracy', 'Captions are provided as-is. Although we work to provide accurate results, Lekha Captions does not guarantee complete accuracy. Review and correct captions before publication, especially for names, specialist terms, and important statements.'],
  ['6. Plans and payments', 'Paid features, limits, billing periods, currencies, taxes, and renewal terms are shown before checkout. Available plans and prices may change, but changes will not alter a completed billing period except where required by law.'],
  ['7. Limitation of liability', 'To the maximum extent permitted by law, Lekha Captions will not be liable for indirect, incidental, special, or consequential damages arising from use of the Service.'],
  ['8. Changes to these terms', 'We may update these Terms from time to time. Continued use of the Service after an update takes effect constitutes acceptance of the revised Terms.'],
  ['9. Governing law', 'These Terms are governed by applicable law. Disputes will be resolved in the jurisdiction where Lekha Captions operates, subject to mandatory consumer protections that apply to you.'],
  ['10. Contact', 'For questions about these Terms, use the guidance on our Help page and the support options shown inside the Lekha Captions app.'],
]

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms and conditions" description="The terms that apply when you access and use Lekha Captions." />
      <article className="legal-content container narrow">
        <p className="legal-date">Version 2026-07-14 • Last updated July 14, 2026</p>
        {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <p>Terms questions: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
        <p className="legal-crosslink">See also our <Link href="/privacy/">Privacy Policy</Link>.</p>
      </article>
    </>
  )
}
