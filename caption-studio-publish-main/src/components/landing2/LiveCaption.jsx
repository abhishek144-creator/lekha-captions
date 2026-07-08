import React, { useEffect, useState } from 'react'

// Word-by-word "karaoke" caption line — mirrors the reveal rhythm of the real editor.
// phrases: [{ lang, words: ['...'] }]
export default function LiveCaption({
  phrases,
  stepMs = 340,
  holdMs = 1500,
  accent = '#F5A623',
  className = '',
  onPhraseChange
}) {
  const [pIdx, setPIdx] = useState(0)
  const [wIdx, setWIdx] = useState(0)
  const phrase = phrases[pIdx % phrases.length]

  useEffect(() => {
    const atEnd = wIdx >= phrase.words.length - 1
    const timer = setTimeout(() => {
      if (atEnd) {
        setPIdx((prev) => (prev + 1) % phrases.length)
        setWIdx(0)
      } else {
        setWIdx((prev) => prev + 1)
      }
    }, atEnd ? holdMs : stepMs)
    return () => clearTimeout(timer)
  }, [pIdx, wIdx, phrase.words.length, phrases.length, stepMs, holdMs])

  useEffect(() => {
    if (onPhraseChange) onPhraseChange(phrase)
  }, [pIdx])

  return (
    <span
      className={`flex flex-wrap items-baseline ${className}`}
      style={{ columnGap: '0.32em', rowGap: '0.12em' }}
    >
      {phrase.words.map((w, i) => (
        <span
          key={`${pIdx}-${i}`}
          className="inline-block transition-all duration-200 ease-out"
          style={{
            color: i === wIdx ? accent : '#F2F3F5',
            opacity: i <= wIdx ? 1 : 0.25,
            transform: i === wIdx ? 'scale(1.06)' : 'scale(1)',
            textShadow: i === wIdx ? `0 0 26px ${accent}66` : 'none'
          }}
        >
          {w}
        </span>
      ))}
    </span>
  )
}
