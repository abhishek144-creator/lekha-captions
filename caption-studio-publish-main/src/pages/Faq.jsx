import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import SupportPageShell from '@/components/support/SupportPageShell';

const faqs = [
  {
    q: 'What languages does Lekha Captions support?',
    a: 'Lekha Captions supports 115+ languages worldwide — English variants, European (Spanish, Portuguese, French, German and more), Arabic and Middle Eastern, African (Kiswahili, Yorùbá, Amharic), East and Southeast Asian (Mandarin, Japanese, Korean, Bahasa, Thai, Vietnamese), and all major South Asian languages (Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Punjabi, Kannada, Malayalam, Odia).',
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

function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="border-b border-[#171713]/15 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 py-6 text-left sm:grid-cols-[58px_1fr_auto] sm:py-7"
      >
        <span className="font-mono text-xs text-[#171713]/70">{String(index + 1).padStart(2, '0')}</span>
        <span className="pr-4 text-base font-semibold leading-6 tracking-[-0.01em] sm:text-lg">{q}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#171713]/20 transition-colors group-hover:border-[#171713] group-hover:bg-[#171713] group-hover:text-white">
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="pb-7 pl-[54px] pr-12 text-sm leading-7 text-[#171713]/65 sm:pl-[74px] sm:pr-20">{a}</p>
        </div>
      </div>
    </article>
  );
}

export default function Faq() {
  return (
    <SupportPageShell
      active="faq"
      eyebrow="Help Center"
      title="Frequently Asked Questions"
      description="Everything you need to know about Lekha Captions."
      pageCode="01"
      detail="8 answered questions about creating, editing, and exporting captions."
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-20 lg:py-24">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#171713]/70">Knowledge base / 01</p>
          <h2 className="mt-4 font-serif text-3xl leading-tight tracking-[-0.025em]">Clear answers, without the fine print.</h2>
          <div className="mt-8 border-l-2 border-[#F5A623] pl-5">
            <h3 className="text-sm font-semibold">Still have questions?</h3>
            <p className="mt-2 text-sm leading-6 text-[#171713]/70">Our support team is here to help.</p>
            <Link to="/HelpAndSupport" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-all hover:gap-3">
              Contact Support <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>

        <section className="rounded-[1.75rem] border border-[#171713]/15 bg-[#FBF9F4] px-5 shadow-[0_18px_60px_rgba(31,27,20,0.08)] sm:px-8">
          {faqs.map((item, index) => (
            <FaqItem key={item.q} {...item} index={index} />
          ))}
        </section>
      </div>
    </SupportPageShell>
  );
}
