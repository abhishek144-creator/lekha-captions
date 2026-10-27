import { useState } from 'react'
import { X } from 'lucide-react'

// A four-step card shown the first time a visitor's captions are ready. Finishing
// or skipping it is remembered in this browser, so it never returns.
const GUIDE_STORAGE_KEY = 'lekha.editor-guide.v1'

export const EDITOR_GUIDE_STEPS = [
  {
    title: 'Your captions are ready',
    body: 'Play the video to check them. Open Captions and click any line to fix its words or timing.',
  },
  {
    title: 'Style a single word',
    body: 'Click a word in the video to change just that word: colour, size, animation or position.',
  },
  {
    title: 'Pick a look',
    body: 'Open Templates to restyle every caption at once. Style fine-tunes the font, colours and position.',
  },
  {
    title: 'Export',
    body: 'Press Export at the top to render your captioned video or download subtitle files.',
  },
]

function guideFinished() {
  try {
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) === 'done'
  } catch {
    return false
  }
}

export default function EditorGuide({ active }) {
  const [hidden, setHidden] = useState(guideFinished)
  const [step, setStep] = useState(0)

  if (!active || hidden) return null

  const finish = () => {
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, 'done')
    } catch {
      // Storage blocked: the guide still closes for this visit.
    }
    setHidden(true)
  }
  const last = step === EDITOR_GUIDE_STEPS.length - 1
  const { title, body } = EDITOR_GUIDE_STEPS[step]

  return (
    <section
      data-editor-panel="true"
      role="dialog"
      aria-labelledby="editor-guide-title"
      className="fixed inset-x-4 top-20 z-40 mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#161616]/95 p-5 text-white shadow-2xl backdrop-blur lg:inset-x-auto lg:right-6 lg:top-auto lg:bottom-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F5A623]">
          Quick guide · {step + 1} of {EDITOR_GUIDE_STEPS.length}
        </p>
        <button type="button" onClick={finish} aria-label="Skip guide" className="text-gray-400 transition hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <h2 id="editor-guide-title" className="mt-2 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-300">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={finish} className="text-sm text-gray-400 transition hover:text-white">
          Skip guide
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="rounded-lg bg-[#F5A623] px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-[#ffb83d]"
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  )
}
