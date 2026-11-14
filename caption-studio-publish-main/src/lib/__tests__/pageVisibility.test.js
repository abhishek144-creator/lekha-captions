import { describe, expect, it, vi } from 'vitest'
import { waitForVisiblePage } from '../pageVisibility'
import { monitorExportStatus } from '../../components/dashboard/exportDelivery'

function page() {
  const doc = new EventTarget()
  doc.visibilityState = 'hidden'
  return doc
}

describe('background job monitoring', () => {
  it('makes no status requests while hidden and resumes the same job when visible', async () => {
    const doc = page()
    const request = vi.fn(async () => ({ status: 'completed' }))
    const monitoring = monitorExportStatus({
      request,
      beforeRequest: signal => waitForVisiblePage(signal, doc),
      sleep: async () => {},
    })
    await Promise.resolve()
    expect(request).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await monitoring
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('cancels a hidden waiter and removes its visibility listener', async () => {
    const doc = page()
    const remove = vi.spyOn(doc, 'removeEventListener')
    const controller = new AbortController()
    const waiting = waitForVisiblePage(controller.signal, doc)
    const rejected = expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('does not send a late request when the monitoring window expired in the background', async () => {
    const doc = page()
    const request = vi.fn()
    let time = 0
    const monitoring = monitorExportStatus({
      request,
      now: () => time,
      timeoutMs: 100,
      beforeRequest: signal => waitForVisiblePage(signal, doc),
      sleep: async () => {},
    })
    const rejected = expect(monitoring).rejects.toMatchObject({ exportStatus: 'monitoring_paused' })
    time = 101
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await rejected
    expect(request).not.toHaveBeenCalled()
  })
})
