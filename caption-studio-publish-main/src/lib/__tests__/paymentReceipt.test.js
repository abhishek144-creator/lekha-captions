import { describe, expect, it } from 'vitest'
import { buildReceiptHtml, formatReceiptAmount, receiptPlanLabel } from '@/lib/paymentReceipt'

describe('payment receipt', () => {
  it('names plans the way customers bought them', () => {
    expect(receiptPlanLabel('creator_yearly')).toBe('Creator plan (yearly)')
    expect(receiptPlanLabel('starter')).toBe('Starter plan (monthly)')
    expect(receiptPlanLabel('topup_pro')).toBe('Pro top-up')
    expect(receiptPlanLabel('')).toBe('Plan purchase')
  })

  it('formats minor units with the currency code', () => {
    expect(formatReceiptAmount(4999, 'usd')).toBe('USD 49.99')
    expect(formatReceiptAmount(undefined, undefined)).toBe('INR 0.00')
  })

  it('lists the payment, customer and total', () => {
    const html = buildReceiptHtml(
      { payment_id: 'pay_1', order_id: 'order_1', plan: 'pro', amount: 129900, currency: 'INR', credits_added: 120 },
      { name: 'Asha', email: 'asha@example.com' },
      'Oct 27, 2026',
    )
    for (const text of ['pay_1', 'order_1', 'Oct 27, 2026', 'Pro plan (monthly)', '120 credits', 'INR 1299.00', 'asha@example.com', 'not a tax invoice']) {
      expect(html).toContain(text)
    }
  })

  it('shows refunds and escapes customer text', () => {
    const html = buildReceiptHtml(
      { payment_id: 'pay_2', amount: 100, refunded_amount: 100, refund_status: 'fully_refunded' },
      { name: '<img src=x onerror=alert(1)>' },
    )
    expect(html).toContain('fully refunded')
    expect(html).toContain('Refunded')
    expect(html).not.toContain('<img src=x')
  })
})
