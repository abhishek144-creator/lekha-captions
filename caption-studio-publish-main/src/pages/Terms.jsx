import React from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-400 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <nav className="sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 h-14 flex items-center justify-between px-6">
        <Link to={createPageUrl('Home')} className="hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <Link to={createPageUrl('Faq')} className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</Link>
          <Link to={createPageUrl('Help')} className="text-sm text-gray-400 hover:text-white transition-colors">Help</Link>
          <Link to={createPageUrl('Terms')} className="text-sm text-white font-medium">Terms</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Terms & Conditions</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: April 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using Lekha Captions ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. Use of Service">
          <p>You may use the Service only for lawful purposes. You agree not to upload content that is illegal, harmful, defamatory, or infringes third-party rights.</p>
          <p>You are responsible for all content you upload. We reserve the right to suspend accounts that violate these terms.</p>
        </Section>

        <Section title="3. Credits and Subscriptions">
          <p>Credits are consumed each time a video is processed. Unused credits do not carry over to the next billing cycle unless stated otherwise.</p>
          <p>Subscription plans are billed monthly or yearly depending on your selection. You may cancel at any time; cancellation takes effect at the end of the current billing period.</p>
        </Section>

        <Section title="4. Payments and Refunds">
          <p>All payments are processed securely via Razorpay. We do not store your payment card details.</p>
          <p>Refunds are available within 48 hours of purchase if no credits have been used. Contact support@lekhacaptions.com for refund requests.</p>
        </Section>

        <Section title="5. Intellectual Property">
          <p>All videos you upload remain your property. By uploading, you grant us a limited, non-exclusive licence to process your content solely for providing the Service.</p>
          <p>The Lekha Captions platform, brand, and software are our intellectual property. You may not copy, modify, or distribute them.</p>
        </Section>

        <Section title="6. Data and Privacy">
          <p>We collect and process data as described in our Privacy Policy. Uploaded videos are temporarily stored for processing and deleted after the download link expires.</p>
          <p>We do not sell your data to third parties.</p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>The Service is provided "as is". We make no warranties regarding uptime, accuracy of transcriptions, or fitness for a particular purpose.</p>
          <p>Our liability for any claim is limited to the amount you paid in the 30 days preceding the claim.</p>
        </Section>

        <Section title="8. Changes to Terms">
          <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        </Section>

        <Section title="9. Contact">
          <p>For questions about these terms, email us at <a href="mailto:legal@lekhacaptions.com" className="text-[#F5A623] hover:underline">legal@lekhacaptions.com</a>.</p>
        </Section>
      </div>
    </div>
  )
}
