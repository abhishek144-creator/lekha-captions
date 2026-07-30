import { JsonLd } from '@/components/JsonLd'
import { HomePricingSection } from '@/components/HomePricingSection'
import { appUrl, pageMetadata, siteDescription, siteUrl } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Professional captions in 115+ languages',
  description: siteDescription,
  path: '/',
})

const stats = [
  ['115+', 'Languages supported'],
  ['100+', 'Caption styles'],
  ['120-180s', 'Shorts & Reels sweet spot'],
]

const features = [
  {
    key: 'ai',
    title: 'AI-Powered Generation',
    description: 'Auto-transcribe and generate punchy captions that land on the rhythm of every word.',
    preview: 'voice',
  },
  {
    key: 'type',
    title: 'Professional Typography',
    description: 'Premium fonts, precise sizing, spacing and line breaks that feel intentionally made.',
    preview: 'type',
  },
  {
    key: 'palette',
    title: 'Custom Styling',
    description: 'Shape colours, highlights, backgrounds and positioning until it is unmistakably yours.',
    preview: 'palette',
  },
  {
    key: 'globe',
    title: 'Every Regional Language',
    description: '115+ languages on every continent, powered by best-in-class speech AI for each language family.',
    preview: 'languages',
    wide: true,
  },
  {
    key: 'sparkles',
    title: 'Multi-Language',
    description: 'English, Spanish, Arabic, Portuguese, Hindi, Japanese and more — ready when your audience is.',
    preview: 'translate',
  },
  {
    key: 'download',
    title: 'Easy Export',
    description: 'Export an SRT, grab plain text, or copy captions straight into your editing flow.',
    preview: 'export',
  },
  {
    key: 'zap',
    title: 'Built for Speed',
    description: 'Optimized for short-form, so your next Reel is ready without the bloat.',
    preview: 'speed',
  },
]

const languages = ['English', 'Español', 'Português', 'Français', 'Deutsch', 'العربية', '中文', '日本語', '한국어', 'Русский', 'हिंदी', 'தமிழ்', 'বাংলা', 'Kiswahili', 'Bahasa']

const demos = [
  {
    id: 'styles-one',
    src: '/landing/template-showcase-1.mp4',
    poster: '/landing/template-showcase-1.jpg',
    label: 'Bold word-by-word',
  },
  {
    id: 'styles-two',
    src: '/landing/template-showcase-2.mp4',
    poster: '/landing/template-showcase-2.jpg',
    label: 'Clean kinetic type',
  },
]

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Zm6 10 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" fill="currentColor" />
    </svg>
  )
}

function FeatureIcon({ kind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.8' }

  switch (kind) {
    case 'ai':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...common} d="m6 21 6-6m-3-9 3-3 3 3m-6 0 3 3m-6 6h6m3-9h3m-3 6h3" />
        </svg>
      )
    case 'type':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...common} d="M5 6h14M12 6v12m-4 0h8" />
        </svg>
      )
    case 'palette':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...common} d="M12 3a9 9 0 1 0 0 18h1.2a2.8 2.8 0 0 0 0-5.6H12a1.8 1.8 0 0 1 0-3.6h.6A4.4 4.4 0 0 0 17 7.4 4.4 4.4 0 0 0 12.6 3H12Z" />
          <circle cx="7.5" cy="10" r="1" fill="currentColor" />
          <circle cx="9.5" cy="7.5" r="1" fill="currentColor" />
          <circle cx="13" cy="7" r="1" fill="currentColor" />
        </svg>
      )
    case 'globe':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" {...common} />
          <path {...common} d="M3.5 12h17M12 3c2.7 2.5 4.5 5.7 4.5 9s-1.8 6.5-4.5 9c-2.7-2.5-4.5-5.7-4.5-9S9.3 5.5 12 3Z" />
        </svg>
      )
    case 'sparkles':
      return <SparklesIcon />
    case 'download':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...common} d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" />
        </svg>
      )
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...common} d="M12 4v6l4-4m-4 4L8 6m4 6v8" />
        </svg>
      )
  }
}

function FeaturePreview({ preview }) {
  switch (preview) {
    case 'voice':
      return (
        <div className="sync-feature-preview sync-feature-preview-voice">
          <span>Turn your</span>
          <strong>voice into</strong>
          <span>moment</span>
        </div>
      )
    case 'type':
      return (
        <div className="sync-feature-preview sync-feature-preview-type">
          tell it
          <br />
          <em>beautifully.</em>
        </div>
      )
    case 'palette':
      return (
        <div className="sync-feature-preview sync-feature-preview-palette">
          <i />
          <i />
          <i />
          <i />
        </div>
      )
    case 'languages':
      return (
        <div className="sync-feature-preview sync-feature-preview-languages">
          <span>English</span>
          <span>Español</span>
          <span>العربية</span>
          <span>中文</span>
          <span>हिंदी</span>
          <span>Français</span>
        </div>
      )
    case 'translate':
      return (
        <div className="sync-feature-preview sync-feature-preview-translate">
          <span>Original</span>
          <b>→</b>
          <strong>Español</strong>
        </div>
      )
    case 'export':
      return (
        <div className="sync-feature-preview sync-feature-preview-export">
          <b>00:00:01,240</b>
          <span>made for every creator</span>
        </div>
      )
    default:
      return (
        <div className="sync-feature-preview sync-feature-preview-speed">
          <i />
          <i />
          <i />
          <i />
          <span>Fast.</span>
        </div>
      )
  }
}

export default function HomePage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Lekha Captions',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description: siteDescription,
    featureList: ['Video caption generation in 115+ languages', 'Worldwide language and script support', 'Animated caption styles', 'Video caption editing', 'HD and 4K export options'],
    offers: { '@type': 'AggregateOffer', lowPrice: '3.99', highPrice: '5.99', priceCurrency: 'USD', offerCount: '3' },
  }

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lekha Captions',
    url: siteUrl,
    logo: `${siteUrl}/lekha-icon.svg`,
    description: siteDescription,
  }

  return (
    <>
      <JsonLd data={[softwareJsonLd, organizationJsonLd]} />

      <section className="sync-hero" aria-label="Lekha Captions introduction">
        <div className="sync-hero-grid" aria-hidden="true" />
        <div className="sync-hero-glow sync-hero-glow-one" aria-hidden="true" />
        <div className="sync-hero-glow sync-hero-glow-two" aria-hidden="true" />
        <div className="container sync-hero-content">
          <p className="sync-hero-pill">
            <SparklesIcon />
            115+ Languages. Built for every global audience.
          </p>
          <h1>
            Professional Captions in <span>Your Language</span>
          </h1>
          <p className="sync-hero-lead">
            115+ languages across the Americas, Europe, Africa, the Middle East and Asia. Professional captions at creator-friendly pricing.
          </p>
          <div className="sync-hero-actions">
            <a className="sync-primary-cta" href={appUrl}>
              <PlayIcon />
              <span>Upload Video</span>
              <ArrowRightIcon />
            </a>
            <a className="sync-secondary-cta" href={appUrl}>Try for Free</a>
          </div>
          <div className="sync-stats" aria-label="Product highlights">
            {stats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sync-section" aria-label="Lekha Caption features">
        <div className="container">
          <div className="sync-section-heading">
            <p className="eyebrow">Made to be watched</p>
            <h2>The words are only the beginning.</h2>
            <p>A studio of expressive, precise caption tools built for short-form creators everywhere.</p>
          </div>

          <div className="sync-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className={`sync-feature-card${feature.wide ? ' sync-feature-card-wide' : ''}`}>
                <div className="sync-feature-card-top">
                  <div className="sync-feature-copy">
                    <span className="sync-feature-icon">
                      <FeatureIcon kind={feature.key} />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                  <FeaturePreview preview={feature.preview} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="sync-language-strip" aria-label="Supported language examples">
          <div className="sync-language-track">
            {[...languages, ...languages].map((language, index) => (
              <span key={`${language}-${index}`}>
                {language}
                <i />
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="sync-section sync-showcase" aria-label="Caption template demos">
        <div className="container">
          <div className="sync-section-heading">
            <p className="eyebrow">Real templates, in motion</p>
            <h2>See every template in action.</h2>
            <p>No screenshots. These are the caption treatments your audience will actually see.</p>
          </div>

          <div className="sync-demo-grid">
            {demos.map((demo) => (
              <article key={demo.id} className="sync-demo-card">
                <div className="sync-demo-bar">
                  <i />
                  <i />
                  <i />
                  <span>LEKHA / {demo.label.toUpperCase()}</span>
                </div>
                <div className="sync-demo-frame">
                  <video autoPlay muted loop playsInline controls preload="metadata" poster={demo.poster} aria-label={`${demo.label} caption style demo`}>
                    <source src={demo.src} type="video/mp4" />
                    Your browser does not support embedded videos.
                  </video>
                </div>
              </article>
            ))}
          </div>

          <p className="sync-showcase-note">100+ animated caption styles, one tap away</p>

          <div className="sync-before-after" aria-label="Caption styling before and after">
            <div>
              <span>BEFORE</span>
              <p>plain captions are fine</p>
            </div>
            <div>
              <span>AFTER / LEKHA</span>
              <p>
                MAKE IT <strong>UNMISSABLE</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      <HomePricingSection />
    </>
  )
}
