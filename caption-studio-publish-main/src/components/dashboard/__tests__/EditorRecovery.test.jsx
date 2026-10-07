import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorEmptyState from '../EditorEmptyState'
import EditorNotices from '../EditorNotices'

const recoveryDraft = { ownerUid: 'alice', fileId: 'f1', captions: [{ id: '1', text: 'unsynced edit' }] }

const renderEmptyState = (props = {}) => {
  const handlers = {
    applyLocalDraft: vi.fn(),
    discardLocalDraft: vi.fn(),
    onContinueAccountDraft: vi.fn(),
    handleUploadModalOpen: vi.fn(),
  }
  render(<EditorEmptyState {...handlers} {...props} />)
  return handlers
}

describe('EditorEmptyState', () => {
  it('offers to continue or back up a browser draft before anything else', () => {
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft, accountDraft: { fileId: 'f0' } })
    expect(screen.getByText('Your previous draft is available on this browser.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download draft backup' })).toBeTruthy()
    // The older account draft would overwrite unsynced browser edits.
    expect(screen.queryByRole('button', { name: 'Continue account draft' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continue saved draft' }))
    expect(handlers.applyLocalDraft).toHaveBeenCalledWith(recoveryDraft)
  })

  it('starting a new upload discards the browser draft first', () => {
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft })
    fireEvent.click(screen.getByRole('button', { name: /Upload Video/ }))
    expect(handlers.discardLocalDraft).toHaveBeenCalledTimes(1)
    expect(handlers.handleUploadModalOpen).toHaveBeenCalledTimes(1)
  })

  it('offers the account draft when this browser has none', () => {
    const handlers = renderEmptyState({ accountDraft: { fileId: 'f0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue account draft' }))
    expect(handlers.onContinueAccountDraft).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Upload Video/ }))
    expect(handlers.discardLocalDraft).not.toHaveBeenCalled()
  })
})

describe('EditorNotices', () => {
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<EditorNotices />)
    expect(container.innerHTML).toBe('')
  })

  it('keeps a save conflict visible with recovery actions', () => {
    const onDownloadDraft = vi.fn()
    render(<EditorNotices saveConflict onDownloadDraft={onDownloadDraft} />)
    expect(screen.getByText(/A newer version of this project was saved/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Download draft' }))
    expect(onDownloadDraft).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('offers caption retry and disables it while generating', () => {
    render(<EditorNotices showCaptionRetry onRetryCaptions={() => {}} retryDisabled />)
    expect(screen.getByRole('button', { name: 'Retry captions' }).disabled).toBe(true)
  })
})
