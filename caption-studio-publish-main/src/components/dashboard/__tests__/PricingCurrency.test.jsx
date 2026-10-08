import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PricingModal from '../PricingModal'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ refreshUserData: vi.fn() }) }))
vi.mock('@/lib/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@/lib/notifyApiError', () => ({ notifyApiError: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

let options
beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('lekha.billingCurrency', 'USD')
  apiRequest.mockReset()
  notifyApiError.mockReset()
  options = undefined
  window.Razorpay = vi.fn(function (config) {
    options = config
    this.on = vi.fn()
    this.open = vi.fn()
  })
})
afterEach(() => { delete window.Razorpay })

const user = { getIdToken: vi.fn(async () => 'fixture-token') }
const openPricing = () => render(<PricingModal isOpen onClose={vi.fn()} user={user} />)

describe('pricing display and checkout agree', () => {
  it('shows and requests USD for monthly plans', async () => {
    apiRequest.mockResolvedValue({ success: true, key_id: 'rzp_test_fixture', order: { id: 'order_usd', amount: 399, currency: 'USD' } })
    openPricing()
    fireEvent.click(screen.getByRole('button', { name: 'Monthly', exact: true }))
    expect(screen.getByText('$3.99', { exact: true })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Get Starter', exact: true }))
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalledTimes(1))
    expect(JSON.parse(apiRequest.mock.calls[0][1].body).currency).toBe('USD')
    expect(options).toMatchObject({ amount: 399, currency: 'USD', order_id: 'order_usd' })
  })
  it('honors an explicit INR selection', async () => {
    apiRequest.mockResolvedValue({ success: true, key_id: 'rzp_test_fixture', order: { id: 'order_inr', amount: 29900, currency: 'INR' } })
    openPricing()
    fireEvent.change(screen.getByRole('combobox', { name: 'Billing currency' }), { target: { value: 'INR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Monthly', exact: true }))
    expect(screen.getByText('₹299', { exact: true })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Get Starter', exact: true }))
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalledTimes(1))
    expect(JSON.parse(apiRequest.mock.calls[0][1].body).currency).toBe('INR')
    expect(options).toMatchObject({ amount: 29900, currency: 'INR' })
    expect(window.localStorage.getItem('lekha.billingCurrency')).toBe('INR')
  })
  it('rejects a checkout currency that differs from the displayed price', async () => {
    apiRequest.mockResolvedValue({ success: true, key_id: 'rzp_test_fixture', order: { id: 'order_mismatch', amount: 250000, currency: 'INR' } })
    openPricing()
    fireEvent.click(screen.getByRole('button', { name: 'Get Starter', exact: true }))
    await waitFor(() => expect(notifyApiError).toHaveBeenCalled())
    expect(window.Razorpay).not.toHaveBeenCalled()
  })
})
