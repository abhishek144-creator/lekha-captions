import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo';

const navItems = [
  { label: 'FAQ', to: '/Faq', key: 'faq' },
  { label: 'Help & Support', to: '/HelpAndSupport', key: 'support' },
  { label: 'Terms', to: '/TermsAndConditions', key: 'terms' },
  { label: 'Refunds', to: '/RefundPolicy', key: 'refunds' },
  { label: 'Acceptable Use', to: '/AcceptableUsePolicy', key: 'acceptable-use' },
  { label: 'Privacy', to: '/PrivacyPolicy', key: 'privacy' },
];

export default function SupportPageShell({
  active,
  eyebrow,
  title,
  description,
  pageCode,
  accent = '#F5A623',
  accentGlow = 'rgba(245, 166, 35, 0.2)',
  detail,
  children,
}) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#090908] text-white">
      <header className="relative z-30 border-b border-white/[0.08] bg-[#090908]/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="Lekha Captions home" className="shrink-0">
            <CaptionStudioLogo size="default" showText={true} />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                aria-current={active === item.key ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  active === item.key
                    ? 'bg-white/[0.09] text-white'
                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            to="/Dashboard"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#11110f] transition-transform hover:-translate-y-0.5"
          >
            Open editor
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </nav>

        <div className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              aria-current={active === item.key ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                active === item.key ? 'bg-white/[0.1] text-white' : 'text-white/50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <section className="relative isolate min-h-[430px] border-b border-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0 -z-20 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(to bottom, black 20%, transparent 95%)',
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[-180px] -z-10 h-[540px] w-[540px] -translate-x-1/2 rounded-full blur-[110px]"
          style={{ background: accentGlow }}
        />
        <div className="pointer-events-none absolute right-[-6rem] top-10 hidden select-none font-serif text-[20rem] leading-none text-white/[0.025] lg:block">
          {pageCode}
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:pb-28 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl"
          >
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-10" style={{ backgroundColor: accent }} />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: accent }}>
                {eyebrow}
              </span>
            </div>
            <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-[-0.035em] text-white sm:text-6xl lg:text-[5.4rem]">
              {title}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">{description}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="border-l border-white/15 pl-5"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">Document / {pageCode}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{detail}</p>
          </motion.div>
        </div>
      </section>

      <main className="relative z-10 -mt-8 rounded-t-[2rem] bg-[#F2EFE8] text-[#171713] shadow-[0_-24px_80px_rgba(0,0,0,0.28)] sm:rounded-t-[3rem]">
        {children}
      </main>

      <footer className="border-t border-white/[0.08] bg-[#090908]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 text-sm text-white/45 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Lekha Captions</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {navItems.map((item) => (
              <Link key={item.key} to={item.to} className="transition-colors hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
