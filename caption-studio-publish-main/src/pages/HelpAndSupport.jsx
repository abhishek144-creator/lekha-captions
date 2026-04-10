import React from 'react';
import { Link } from 'react-router-dom';
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo';
import { MessageCircle, BookOpen, FileText, Zap } from 'lucide-react';

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
    issue: 'Backend server not connecting',
    fix: 'Make sure the Python backend (uvicorn) is running on port 8000. If you installed locally, run: cd backend; python -m uvicorn main:app --host 0.0.0.0 --port 8000',
  },
  {
    issue: 'Captions not generating / wrong language',
    fix: 'Ensure you selected the correct source language before processing. Re-process the video after changing the language.',
  },
  {
    issue: 'Video not uploading',
    fix: 'Supported formats are MP4, MOV, AVI, MKV, WebM. Files over 500MB may fail — try compressing the video first.',
  },
  {
    issue: 'Captions look out of sync',
    fix: 'Use the timeline scrubber to fine-tune caption start/end times. Drag caption handles on the timeline to adjust.',
  },
];

export default function HelpAndSupport() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link to="/Faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link to="/TermsAndConditions" className="hover:text-white transition-colors">Terms</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 mb-6">
          Help Center
        </div>
        <h1 className="text-4xl font-bold mb-4">Help &amp; Support</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">Find answers, learn how to use Lekha Captions, and get in touch with our team.</p>
      </div>

      {/* Quick Topics */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-lg font-semibold mb-6 text-white">Quick Guides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topics.map((t, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-5 flex gap-4 hover:border-white/20 transition-colors" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${t.color}22` }}>
                <t.icon className="w-5 h-5" style={{ color: t.color }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">{t.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-lg font-semibold mb-6">Troubleshooting</h2>
        <div className="space-y-4">
          {troubleshooting.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm font-medium text-white mb-1.5">⚠️ {item.issue}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{item.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Contact Us</h2>
          <p className="text-gray-400 text-sm mb-2 max-w-md mx-auto">
            Have a question not answered here? Reach out and we'll get back to you as soon as possible.
          </p>
          <p className="text-gray-500 text-xs mb-6 italic">
            (Professional email coming soon — we are setting up our support inbox.)
          </p>
          <Link
            to="/Faq"
            className="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-gray-200 transition-colors"
          >
            Browse FAQ
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Lekha Captions · <Link to="/Faq" className="hover:text-gray-300">FAQ</Link> · <Link to="/TermsAndConditions" className="hover:text-gray-300">Terms</Link></p>
      </footer>
    </div>
  );
}
