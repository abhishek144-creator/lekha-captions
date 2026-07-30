import { Link } from 'react-router-dom';
import SupportPageShell from '@/components/support/SupportPageShell';

// Replace with the registered place of business (for example, "Karnataka, India")
// before going live. `npm run launch:check` fails while the placeholder is here.
const GOVERNING_JURISDICTION = 'India';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using Lekha Captions ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service.',
  },
  {
    title: '2. Use of the Service',
    body: 'You may use Lekha Captions for lawful purposes only. You must not upload content that is unlawful, harmful, defamatory, infringing, or otherwise objectionable. You are solely responsible for the content you upload and process.',
  },
  {
    title: '3. Intellectual Property',
    body: 'All rights, title, and interest in and to the Service (excluding user-uploaded content) remain the exclusive property of Lekha Captions. You retain full ownership of your videos and the captions generated from them.',
  },
  {
    title: '4. Privacy & Data',
    body: 'Your uploaded videos are processed by Lekha Captions and the service providers identified in our Privacy Policy for transcription, translation, storage, export, and payment functions. Source and exported media are retained temporarily according to the published retention schedule.',
  },
  {
    title: '5. Accuracy Disclaimer',
    body: 'AI-generated captions are provided as-is. While we strive for high accuracy, Lekha Captions does not guarantee 100% accuracy — results vary with audio quality, accents, background noise, language mixing, and speaker clarity. You are responsible for reviewing and correcting captions before publication.',
  },
  {
    title: '6. Plans, Pricing and Credits',
    body: 'Paid plans are one-time purchases covering a fixed period — 30 days for monthly plans and 365 days for yearly plans. We do not hold a recurring mandate and do not auto-renew or auto-charge you; when a plan period ends your account returns to the free tier. Each plan includes a set number of export credits for that period. One credit is consumed only when an export completes successfully, so failed exports never cost you a credit. Unused credits expire at the end of the plan period and do not carry over. Top-up credits are added to an active paid plan and expire with that same plan period. Prices, credit allowances, and plan limits are shown at checkout and may change for future purchases.',
  },
  {
    title: '7. Cancellation and Refunds',
    body: 'Because nothing renews automatically, there is no recurring subscription to cancel — stopping use is enough to ensure you are not charged again, and paid features remain available until the end of the period you have already paid for. Refund eligibility, the request process, and refund timelines are set out in our Refund & Cancellation Policy, which forms part of these Terms.',
  },
  {
    title: '8. Acceptable Use',
    body: 'Your use of the Service is subject to our Acceptable Use Policy, which forms part of these Terms. Among other things, you must hold the rights and consents necessary for every file you upload, and you must not use the Service for unlawful content, non-consensual intimate imagery, harassment, impersonation, or attempts to bypass plan limits.',
  },
  {
    title: '9. Suspension and Termination',
    body: 'We may suspend or terminate an account that breaches these Terms or the Acceptable Use Policy, that is used to abuse or endanger the platform or other users, or where we are legally required to do so. Serious safety breaches are acted on immediately and without prior notice. You may stop using the Service at any time and may delete your account from the account page, which permanently removes your data.',
  },
  {
    title: '10. Service Availability',
    body: 'We do not guarantee that the Service will be uninterrupted, error-free, or available at any particular time. We may pause uploads, transcription, or exports for maintenance, capacity, or safety reasons, and we may change or discontinue features. We aim to give notice where reasonably practical.',
  },
  {
    title: '11. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Lekha Captions shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Nothing in these Terms limits liability that cannot be limited under applicable law.',
  },
  {
    title: '12. Modifications',
    body: 'We reserve the right to modify these Terms at any time. Material changes will be published with a new version date. Continued use of the Service after changes constitutes your acceptance of the revised Terms.',
  },
  {
    title: '13. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of ${GOVERNING_JURISDICTION}, and the courts of ${GOVERNING_JURISDICTION} shall have exclusive jurisdiction over any dispute arising from them. Nothing here removes a consumer protection right available to you under the mandatory law of your country of residence.`,
  },
  {
    title: '14. Contact',
    body: 'For any questions about these Terms, please reach out via our Help & Support page or email support@lekhacaptions.com.',
  },
];

const sectionId = (title) => `section-${title.split('.')[0]}`;

export default function TermsAndConditions() {
  return (
    <SupportPageShell
      active="terms"
      eyebrow="Legal"
      title="Terms & Conditions"
      description="Version 2026-07-26 · Last updated: July 26, 2026"
      pageCode="03"
      accent="#FF7A5C"
      accentGlow="rgba(255, 122, 92, 0.16)"
      detail={`${sections.length} sections covering access, ownership, privacy, billing, credits, and liability.`}
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[260px_minmax(0,760px)] lg:justify-between lg:gap-20 lg:py-24">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/40">
            Contents / {String(sections.length).padStart(2, '0')} sections
          </p>
          <nav aria-label="Terms sections" className="mt-6 border-l border-[#171713]/15">
            {sections.map((section) => (
              <a
                key={section.title}
                href={`#${sectionId(section.title)}`}
                className="block border-l border-transparent py-2.5 pl-5 text-sm text-[#171713]/50 transition-colors hover:border-[#FF7A5C] hover:text-[#171713]"
              >
                {section.title}
              </a>
            ))}
          </nav>
          <div className="mt-7 flex flex-col gap-2.5 text-sm font-semibold">
            <Link to="/PrivacyPolicy" className="underline decoration-[#FF7A5C] decoration-2 underline-offset-4">
              Read our Privacy Policy
            </Link>
            <Link to="/RefundPolicy" className="underline decoration-[#FF7A5C] decoration-2 underline-offset-4">
              Refund &amp; Cancellation Policy
            </Link>
            <Link to="/AcceptableUsePolicy" className="underline decoration-[#FF7A5C] decoration-2 underline-offset-4">
              Acceptable Use Policy
            </Link>
          </div>
        </aside>

        <article className="rounded-[1.75rem] border border-[#171713]/15 bg-[#FBF9F4] px-6 py-2 shadow-[0_18px_60px_rgba(31,27,20,0.08)] sm:px-10">
          {sections.map((section, index) => (
            <section id={sectionId(section.title)} key={section.title} className="scroll-mt-8 border-b border-[#171713]/10 py-8 last:border-b-0 sm:py-10">
              <div className="grid gap-3 sm:grid-cols-[48px_1fr] sm:gap-5">
                <span className="font-serif text-2xl text-[#FF7A5C]">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#171713]">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#171713]/60">{section.body}</p>
                </div>
              </div>
            </section>
          ))}
          <p className="border-t border-[#171713]/10 py-8 text-sm text-[#171713]/60">
            Terms questions: <a className="font-semibold text-[#B7482F] hover:underline" href="mailto:support@lekhacaptions.com">support@lekhacaptions.com</a>
          </p>
        </article>
      </div>
    </SupportPageShell>
  );
}
