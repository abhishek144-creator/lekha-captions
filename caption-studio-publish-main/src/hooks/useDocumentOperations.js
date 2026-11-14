import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'

// Async results belong to the account/document that started them. An epoch also
// rejects A -> B -> A transitions, even when IDs and text happen to match again.
export function useDocumentOperations({ ownerUid, fileId, projectId }, content) {
  const state = useRef({ ownerUid, fileId, projectId, accountEpoch: 0, documentEpoch: 0, content })
  const active = useRef(new Map())
  const mounted = useRef(true)
  const previous = state.current
  const accountChanged = previous.ownerUid !== ownerUid
  const documentChanged = accountChanged || previous.fileId !== fileId || previous.projectId !== projectId
  state.current = {
    ownerUid, fileId, projectId, content,
    accountEpoch: previous.accountEpoch + Number(accountChanged),
    documentEpoch: previous.documentEpoch + Number(documentChanged),
  }

  const cancelAll = useCallback(() => {
    state.current.documentEpoch += 1
    for (const operation of active.current.values()) operation.controller.abort()
    active.current.clear()
  }, [])

  useLayoutEffect(() => {
    for (const [name, operation] of active.current) {
      if (!operation.isActive()) {
        operation.controller.abort()
        active.current.delete(name)
      }
    }
  }, [ownerUid, fileId, projectId])

  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancelAll() }
  }, [cancelAll])

  const start = useCallback((name, { scope = 'document', watchContent = false } = {}) => {
    active.current.get(name)?.controller.abort()
    const started = state.current
    const fingerprint = watchContent ? JSON.stringify(started.content) : null
    const controller = new AbortController()
    const operation = {
      controller,
      signal: controller.signal,
      isActive: () => mounted.current && !controller.signal.aborted
        && active.current.get(name) === operation
        && state.current.accountEpoch === started.accountEpoch
        && (scope === 'account' || state.current.documentEpoch === started.documentEpoch),
      isCurrent: () => operation.isActive()
        && (!watchContent || JSON.stringify(state.current.content) === fingerprint),
      assertCurrent: () => {
        if (!operation.isCurrent()) throw new DOMException('The account or document changed.', 'AbortError')
      },
      finish: () => {
        if (active.current.get(name) === operation) active.current.delete(name)
      },
    }
    active.current.set(name, operation)
    return operation
  }, [])

  return useMemo(() => ({ start, cancelAll }), [start, cancelAll])
}
