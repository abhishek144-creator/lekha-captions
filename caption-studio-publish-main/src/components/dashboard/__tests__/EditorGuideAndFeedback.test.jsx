import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditorGuide, { EDITOR_GUIDE_STEPS } from '@/components/dashboard/EditorGuide'
import FeedbackButton from '@/components/dashboard/FeedbackButton'

const apiRequest = vi.fn()
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args) => apiRequest(...args),
  getApiErrorMessage: (error) => error.message,
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  apiRequest.mockReset()
})

describe('EditorGuide', () => {
  it('waits until captions are ready', () => {
    render(<EditorGuide active={false} />)
    expect(screen.queryByRole('region', { name: 'Quick guide' })).toBeNull()
  })

  it('walks through every step and never returns once done', () => {
    const { unmount } = render(<EditorGuide active />)
    for (const step of EDITOR_GUIDE_STEPS.slice(0, -1)) {
      expect(screen.getByText(step.title)).toBeTruthy()
      fireEvent.click(screen.getByText('Next'))
    }
    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByRole('region', { name: 'Quick guide' })).toBeNull()
    unmount()
    render(<EditorGuide active />)
    expect(screen.queryByRole('region', { name: 'Quick guide' })).toBeNull()
  })

  it('can be skipped from the first step', () => {
    render(<EditorGuide active />)
    expect(screen.getByRole('region', { name: 'Quick guide' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('Skip guide'))
    expect(screen.queryByRole('region', { name: 'Quick guide' })).toBeNull()
    expect(window.localStorage.getItem('lekha.editor-guide.v1')).toBe('done')
  })
})

describe('FeedbackButton', () => {
  it('sends feedback through the support intake', async () => {
    apiRequest.mockResolvedValue({ ticket_id: 'SUP-1' })
    render(<FeedbackButton email="asha@example.com" />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    // The support address is shown, not the signed-in user's own email.
    expect(screen.getByText('support@lekhacaptions.com')).toBeTruthy()
    expect(screen.queryByDisplayValue('asha@example.com')).toBeNull()
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Please add more fonts' } })
    fireEvent.click(screen.getByText('Send feedback'))
    await waitFor(() => expect(screen.getByText('Thanks, we got it.')).toBeTruthy())
    const [path, options] = apiRequest.mock.calls[0]
    expect(path).toBe('/api/support-request')
    expect(JSON.parse(options.body)).toMatchObject({
      account_email: 'asha@example.com',
      issue_type: 'feedback',
      description: 'Please add more fonts',
    })
  })

  it('shows the server error and keeps the message', async () => {
    apiRequest.mockRejectedValue(new Error('Too many support requests.'))
    render(<FeedbackButton email="asha@example.com" />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Export was slow today' } })
    fireEvent.click(screen.getByText('Send feedback'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Too many support requests.'))
    expect(screen.getByLabelText('Your feedback').value).toBe('Export was slow today')
  })

  it('asks for a reply email only when signed out', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    expect(screen.getByLabelText('Your email')).toBeTruthy()
  })
})
