import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    q: 'What languages does Lekha Captions support?',
    a: 'Lekha Captions supports 115+ languages including all major Indic languages (Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Punjabi, Kannada, Malayalam, Odia), African, Arab, Southeast Asian, European, and English variants.',
  },
  {
    q: 'What video formats are supported?',
    a: 'We support MP4, MOV, AVI, MKV, and WebM. For best results use MP4 (H.264). The ideal video duration is 120–180 seconds (shorts & reels sweet spot).',
  },
  {
    q: 'How accurate are the captions?',
    a: 'Our AI transcription achieves 90–98% accuracy for clear audio in supported languages. Background noise, multiple speakers, or heavy accents may reduce accuracy slightly.',
  },
  {
    q: 'Can I edit the captions after they are generated?',
    a: 'Yes. Every word is individually editable in the editor. You can click any caption to edit text, drag words to reposition them, and apply per-word styling.',
  },
  {
    q: 'What caption styles and templates are available?',
    a: 'We offer 25+ professional templates including word-by-word reveals, gradient effects, neon glows, bold strokes, and more. You can also fully customize fonts, colors, animations, and effects.',
  },
  {
    q: 'How do I export the captioned video?',
    a: 'Use the Export button in the editor. You can export with captions burned into the video or as a separate SRT/VTT subtitle file.',
  },
  {
    q: 'Is my video data private?',
    a: 'Yes. Uploaded videos are processed securely and are not shared with third parties. We do not train AI models on your content.',
  },
  {
    q: 'What is the maximum file size?',
    a: 'Currently we support video files up to 500MB. For larger files, we recommend compressing the video first.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border border-white/10 rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left text-white font-medium text-sm hover:bg-white/5 transition-colors"
      >
        <span>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function Faq() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link to="/HelpAndSupport" className="hover:text-white transition-colors">Support</Link>
          <Link to="/TermsAndConditions" className="hover:text-white transition-colors">Terms</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 mb-6">
          Help Center
        </div>
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-gray-400 text-lg">Everything you need to know about Lekha Captions.</p>
      </div>

      {/* FAQ List */}
      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-3">
        {faqs.map((item, i) => (
          <FaqItem key={i} {...item} />
        ))}
      </div>

      {/* Still stuck */}
      <div className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/3 p-10" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h2 className="text-xl font-semibold mb-2">Still have questions?</h2>
          <p className="text-gray-400 text-sm mb-6">Our support team is here to help.</p>
          <Link
            to="/HelpAndSupport"
            className="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-gray-200 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Lekha Captions · <Link to="/TermsAndConditions" className="hover:text-gray-300">Terms</Link> · <Link to="/Faq" className="hover:text-gray-300">FAQ</Link></p>
      </footer>
    </div>
  );
}
