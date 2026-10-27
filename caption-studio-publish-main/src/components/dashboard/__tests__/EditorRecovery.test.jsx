import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorEmptyState from '../EditorEmptyState'
import EditorNotices from '../EditorNotices'
import EditorStatusBanners from '../EditorStatusBanners'
import * as localDraftStorage from '@/lib/localDraftStorage'

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
  it('closing the recovery message keeps the saved draft actions available', () => {
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft })
    fireEvent.click(screen.getByRole('button', { name: 'Close draft recovery notification' }))
    expect(screen.queryByText('Your previous draft is available on this browser.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continue saved draft' }))
    expect(handlers.applyLocalDraft).toHaveBeenCalledWith(recoveryDraft)
    expect(screen.getByRole('button', { name: 'Download draft backup' })).toBeTruthy()
  })
  it('keeps browser recovery and backs it up before opening the account draft', () => {
    const backup = vi.spyOn(localDraftStorage, 'downloadDraft').mockImplementation(() => {})
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft, accountDraft: { fileId: 'f0' } })
    expect(screen.getByText('Your previous draft is available on this browser.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download draft backup' })).toBeTruthy()
    expect(handlers.onContinueAccountDraft).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back up browser draft & open account draft' }))
    expect(backup).toHaveBeenCalledWith(recoveryDraft)
    expect(handlers.onContinueAccountDraft).toHaveBeenCalledTimes(1)
    expect(backup.mock.invocationCallOrder[0]).toBeLessThan(handlers.onContinueAccountDraft.mock.invocationCallOrder[0])
    backup.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Continue saved draft' }))
    expect(handlers.applyLocalDraft).toHaveBeenCalledWith(recoveryDraft)
  })

  it('does not replace browser edits when the backup cannot be created', () => {
    const backup = vi.spyOn(localDraftStorage, 'downloadDraft').mockImplementation(() => { throw new Error('Storage unavailable') })
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft, accountDraft: { fileId: 'f0', captions: [] } })
    fireEvent.click(screen.getByRole('button', { name: 'Back up browser draft & open account draft' }))
    expect(handlers.onContinueAccountDraft).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Your draft has not been replaced')
    expect(screen.getByRole('button', { name: 'Continue saved draft' })).toBeTruthy()
    backup.mockRestore()
  })

  it('opening the upload window keeps the browser draft until an upload is accepted', () => {
    const handlers = renderEmptyState({ localRecoveryDraft: recoveryDraft })
    fireEvent.click(screen.getByRole('button', { name: /Upload Video/ }))
    expect(handlers.discardLocalDraft).not.toHaveBeenCalled()
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
  it('dismisses each notice independently and shows a new message', () => {
    const props = { saveConflict: true, saveMessage: 'Saved locally', showCaptionRetry: true, lowCreditOffer: { credits: 20, price: '$2' } }
    const { rerender } = render(<EditorNotices {...props} />)
    for (const name of ['Close save conflict notification', 'Close save notification', 'Close low credit notification', 'Close caption retry notification']) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    // Hiding the conflict notice does not clear the parent's conflict state.
    rerender(<EditorNotices {...props} saveMessage="A different save error" />)
    expect(screen.queryByText(/A newer version of this project/)).toBeNull()
    expect(screen.getByText('A different save error')).toBeTruthy()
  })
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

describe('EditorStatusBanners', () => {
  it('closes the missing-source notice without relinking and resurfaces for a different video', () => {
    const onRelinkSource = vi.fn()
    const { rerender } = render(<EditorStatusBanners sourceId="first" sourceUnavailable onRelinkSource={onRelinkSource} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close source video notification' }))
    expect(screen.queryByText(/Source video unavailable/)).toBeNull()
    expect(onRelinkSource).not.toHaveBeenCalled()
    rerender(<EditorStatusBanners sourceId="first" sourceUnavailable onRelinkSource={onRelinkSource} />)
    expect(screen.queryByText(/Source video unavailable/)).toBeNull()
    rerender(<EditorStatusBanners sourceId="second" sourceUnavailable onRelinkSource={onRelinkSource} />)
    expect(screen.getByText(/Source video unavailable/)).toBeTruthy()
  })
})
