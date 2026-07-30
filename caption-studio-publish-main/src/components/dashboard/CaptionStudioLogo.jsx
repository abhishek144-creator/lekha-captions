const sizeStyles = {
  small: { mark: 'h-6 w-6', text: 'text-sm', gap: 'gap-2' },
  default: { mark: 'h-8 w-8', text: 'text-base', gap: 'gap-2.5' },
  large: { mark: 'h-12 w-12', text: 'text-xl', gap: 'gap-3' },
}

function LekhaDialogueMark({ className }) {
  return (
    <span aria-hidden="true" className={`${className} relative block shrink-0`}>
      <span className="absolute left-[1%] top-[4%] h-[58%] w-[73%] -rotate-[9deg] rounded-[42%_42%_42%_18%] bg-[#f5a623] shadow-[0_0_22px_rgba(245,166,35,0.3)]">
        <span className="absolute -bottom-[11%] left-[14%] h-[24%] w-[24%] rotate-45 rounded-[18%] bg-[#f5a623]" />
        <span className="absolute left-[22%] top-[34%] h-[12%] w-[50%] rounded-full bg-[#090909]/80" />
        <span className="absolute left-[22%] top-[58%] h-[10%] w-[34%] rounded-full bg-[#090909]/45" />
      </span>
      <span className="absolute bottom-[2%] right-[1%] h-[61%] w-[74%] rotate-[7deg] rounded-[42%_42%_18%_42%] border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.34)]">
        <span className="absolute -bottom-[11%] right-[14%] h-[24%] w-[24%] rotate-45 rounded-[18%] bg-white" />
        <span className="absolute left-[20%] top-[31%] h-[12%] w-[54%] rounded-full bg-[#090909]" />
        <span className="absolute left-[20%] top-[56%] h-[10%] w-[37%] rounded-full bg-[#090909]/55" />
      </span>
      <span className="absolute left-[44%] top-[43%] h-[18%] w-[18%] rotate-45 rounded-[22%] border-2 border-[#080807] bg-[#6ee7ff] shadow-[0_0_10px_rgba(110,231,255,0.7)]" />
    </span>
  )
}

export default function CaptionStudioLogo({ size = 'default', showText = true, forceText = false, beta = false }) {
  const styles = sizeStyles[size] || sizeStyles.default

  return (
    <span className={`inline-flex items-center ${styles.gap}`}>
      <LekhaDialogueMark className={styles.mark} />
      {showText && (
        <span className={`${styles.text} ${forceText ? 'inline-flex' : 'hidden sm:inline-flex'} items-baseline font-semibold tracking-[-0.035em]`}>
          <span className="text-white">Lekha</span><span className="ml-1 text-[#f5a623]">Captions</span>
        </span>
      )}
      {beta && (
        <span className="inline-flex shrink-0 items-center rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[#f5a623]">
          Beta
        </span>
      )}
    </span>
  )
}
