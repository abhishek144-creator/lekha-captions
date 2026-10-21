import { useEffect, useRef, useState } from 'react'
import SupportPageShell from '@/components/support/SupportPageShell'
import { checkServiceStatus, statusProbes } from '@/lib/serviceStatus'

const labels = { operational: 'Operational', degraded: 'Limited availability', unverified: 'Could not verify' }

export default function Status() {
  const [results, setResults] = useState([])
  const [checking, setChecking] = useState(true)
  const [checkedAt, setCheckedAt] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const controllerRef = useRef(null)
  useEffect(() => {
    let active = true
    let timer
    const run = async () => {
      const controller = new AbortController()
      controllerRef.current = controller
      setChecking(true)
      const base = String(import.meta.env.VITE_API_BASE_URL || 'https://api.lekhacaptions.com').replace(/\/$/, '')
      const next = await Promise.all(statusProbes.map(probe => checkServiceStatus(probe, { base, signal: controller.signal })))
      if (!active) return
      setResults(next)
      setCheckedAt(new Date())
      setChecking(false)
      timer = setTimeout(run, 60000)
    }
    void run()
    return () => { active = false; clearTimeout(timer); controllerRef.current?.abort() }
  }, [refresh])
  const summary = !results.length ? 'Checking production services…'
    : results.every(result => result.state === 'operational') ? 'All monitored systems are operational.'
      : results.some(result => result.state === 'degraded') ? 'Some services report limited availability.'
        : 'Some service checks could not be verified.'
  return (
    <SupportPageShell active="status" eyebrow="Service status" title="Live service checks" description="Current API availability, processing readiness and customer service controls." pageCode="09" detail="This frontend is hosted separately from the API. These browser checks do not measure historical uptime.">
      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8" aria-live="polite" aria-busy={checking}>
        <h2 className="font-serif text-3xl">{summary}</h2>
        <p className="mt-3 text-sm leading-6">{checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}. Checks refresh every minute while this page is open.` : 'A sleeping service may take a few seconds to respond.'}</p>
        <ul className="my-8 space-y-4">
          {statusProbes.map(probe => {
            const result = results.find(item => item.name === probe.name)
            return <li key={probe.name} className="rounded-xl border border-black/15 bg-white p-5" data-service-check={probe.name}>
              <h3 className="text-lg font-semibold">{probe.name}</h3>
              <p className="mt-2 font-semibold">{result ? labels[result.state] : 'Checking…'}</p>
              <p className="mt-1 text-sm">{result ? `${result.detail} Check completed in ${result.latencyMs} ms.` : 'Waiting for a response.'}</p>
            </li>
          })}
        </ul>
        <button type="button" disabled={checking} onClick={() => setRefresh(value => value + 1)} className="rounded-full bg-[#171713] px-5 py-3 font-semibold text-white disabled:opacity-60">{checking ? 'Checking…' : 'Check again'}</button>
        <p className="mt-6 text-sm leading-6">A failed browser check can reflect connection or browser restrictions. If an action fails while these checks pass, contact <a className="underline" href="mailto:support@lekhacaptions.com">support@lekhacaptions.com</a> with the time, action and support reference.</p>
      </section>
    </SupportPageShell>
  )
}
