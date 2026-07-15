import Link from 'next/link'
import { CtaBand } from '@/components/CtaBand'
import { PageHero } from '@/components/PageHero'
import { pageMetadata, supportEmail } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Help center',
  description: 'Learn how to upload videos, generate multilingual captions, edit words and timing, apply animated styles, troubleshoot, and export with Lekha Captions.',
  path: '/help',
})

const guides = [
  ['01', 'Upload and generate', 'Open the editor, upload a supported video, choose the spoken language, and generate a first caption pass. MP4 with H.264 is recommended.'],
  ['02', 'Edit words and timing', 'Review every line before publishing. Correct the transcript, refine timing, reposition captions, and preview the video as you work.'],
  ['03', 'Choose an animated style', 'Start with one of 25+ caption templates, then adjust typography, colors, emphasis, positioning, and motion to match your brand.'],
  ['04', 'Export your video', 'Choose the available resolution and export format in the editor. Keep the editor open until processing begins, then download from the provided link.'],
]

const troubleshooting = [
  ['The video will not upload', 'Confirm that the file is MP4, MOV, AVI, MKV, or WebM and under the current upload limit. If it is very large, compress it and try again.'],
  ['The detected language is wrong', 'Choose the actual spoken source language before generating. If needed, change the selection and process the clip again.'],
  ['Captions are out of sync', 'Use the editor timeline to adjust caption timing and preview the affected section before exporting again.'],
  ['A caption style is hard to read', 'Increase contrast, simplify the background treatment, adjust size and position, and keep important text inside safe areas for mobile video.'],
]

export default function HelpPage() {
  return (
    <>
      <PageHero eyebrow="Help center" title="Move from upload to export with confidence." description="Practical guidance for generating, editing, styling, and exporting multilingual video captions." />
      <section className="content-section">
        <div className="container help-layout">
          <section>
            <div className="section-heading"><p className="eyebrow">Quick guides</p><h2>Your core workflow.</h2></div>
            <div className="guide-grid">{guides.map(([number, title, body]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          </section>
          <section className="troubleshooting">
            <div className="section-heading"><p className="eyebrow">Troubleshooting</p><h2>Common fixes.</h2></div>
            {troubleshooting.map(([issue, fix]) => <article key={issue}><h3>{issue}</h3><p>{fix}</p></article>)}
          </section>
          <aside className="help-aside"><p className="eyebrow">Need another answer?</p><h2>Contact support.</h2><p>Browse the FAQ or email our support team for account, billing, privacy, or export help.</p><a className="button button-outline" href={`mailto:${supportEmail}`}>Email support</a><p><Link href="/faq/">Browse the full FAQ</Link></p></aside>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
