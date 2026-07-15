import { appUrl } from '@/lib/site'

export function CtaBand({ title = 'Make every word impossible to miss.', body = 'Upload a video, generate multilingual captions, and shape every frame in one creator-friendly workflow.' }) {
  return (
    <section className="cta-section">
      <div className="container cta-band">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <a className="button" href={appUrl}>Start creating <span aria-hidden="true">→</span></a>
      </div>
    </section>
  )
}
