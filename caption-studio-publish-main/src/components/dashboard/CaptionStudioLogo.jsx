import wordmarkOnDark from '@/assets/brand/lekha-wordmark-dark.svg'
import appIcon from '@/assets/brand/lekha-icon.svg'

// The "Subtitle lines" brand (chosen 2026-10-05): "lekha" and "captions" set
// as two burned-in subtitle lines inside quotation marks; the square "le"
// app icon stands in where only an icon fits. Brand kit:
// Downloads/lekha-brand-logo.zip. The app is dark, so the on-dark wordmark.
const sizeStyles = {
  small: { wordmark: 'h-7', icon: 'h-6 w-6', gap: 'gap-2' },
  default: { wordmark: 'h-9', icon: 'h-8 w-8', gap: 'gap-2.5' },
  large: { wordmark: 'h-14', icon: 'h-12 w-12', gap: 'gap-3' },
}

export default function CaptionStudioLogo({ size = 'default', showText = true, forceText = false, beta = false }) {
  const styles = sizeStyles[size] || sizeStyles.default
  // Phones show the icon unless the full name is forced; wider screens show
  // the wordmark whenever text is wanted.
  const iconClass = !showText ? 'block' : forceText ? 'hidden' : 'block sm:hidden'
  const wordmarkClass = !showText ? 'hidden' : forceText ? 'block' : 'hidden sm:block'

  return (
    <span className={`inline-flex items-center ${styles.gap}`}>
      <img
        src={appIcon}
        alt="Lekha Captions"
        draggable="false"
        className={`${iconClass} ${styles.icon} shrink-0 rounded-[22%] ring-1 ring-white/10`}
      />
      <img
        src={wordmarkOnDark}
        alt="Lekha Captions"
        draggable="false"
        className={`${wordmarkClass} ${styles.wordmark} w-auto shrink-0`}
      />
      {beta && (
        <span className="inline-flex shrink-0 items-center rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[#f5a623]">
          Beta
        </span>
      )}
    </span>
  )
}
