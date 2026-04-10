import React from 'react';
import { Link } from 'react-router-dom';
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo';

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
    body: 'Your uploaded videos are processed securely for transcription purposes. We do not share your content with third parties or use it to train AI models. Processed files may be stored temporarily and deleted automatically after processing.',
  },
  {
    title: '5. Accuracy Disclaimer',
    body: 'AI-generated captions are provided as-is. While we strive for high accuracy, Lekha Captions does not guarantee 100% accuracy. You are responsible for reviewing and correcting captions before publication.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Lekha Captions shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.',
  },
  {
    title: '7. Modifications',
    body: 'We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes your acceptance of the revised Terms.',
  },
  {
    title: '8. Governing Law',
    body: 'These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved in the jurisdiction where Lekha Captions operates.',
  },
  {
    title: '9. Contact',
    body: 'For any questions about these Terms, please reach out via our Help & Support page.',
  },
];

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link to="/Faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link to="/HelpAndSupport" className="hover:text-white transition-colors">Support</Link>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-10">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 mb-6">
          Legal
        </div>
        <h1 className="text-4xl font-bold mb-3">Terms &amp; Conditions</h1>
        <p className="text-gray-500 text-sm">Last updated: March 2026</p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-8">
        {sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-lg font-semibold mb-2 text-white">{s.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Lekha Captions · <Link to="/Faq" className="hover:text-gray-300">FAQ</Link> · <Link to="/HelpAndSupport" className="hover:text-gray-300">Support</Link></p>
      </footer>
    </div>
  );
}
