// A printable payment receipt the customer downloads from the account page.
// It is not a GST/VAT tax invoice: those need the seller's registration details
// and a tax breakdown, issued separately when they apply.
const seller = {
  name: import.meta.env.VITE_LEGAL_BUSINESS_NAME || 'Lekha Captions',
  address: import.meta.env.VITE_LEGAL_BUSINESS_ADDRESS || '',
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com',
  taxId: import.meta.env.VITE_LEGAL_TAX_ID || '',
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch])
}

export function formatReceiptAmount(amountMinor, currency) {
  const value = Number(amountMinor || 0)
  return `${String(currency || 'INR').toUpperCase()} ${(Number.isFinite(value) ? value / 100 : 0).toFixed(2)}`
}

export function receiptPlanLabel(planId) {
  const plan = String(planId || '')
  if (!plan) return 'Plan purchase'
  if (plan.startsWith('topup_')) return `${plan.slice(6).replace(/^\w/, c => c.toUpperCase())} top-up`
  const [base, period] = plan.split('_')
  const name = base.replace(/^\w/, c => c.toUpperCase())
  return period === 'yearly' ? `${name} plan (yearly)` : `${name} plan (monthly)`
}

export function buildReceiptHtml(payment, customer = {}, date = '') {
  const reference = payment?.payment_id || payment?.id || 'Unavailable'
  const amount = formatReceiptAmount(payment?.amount, payment?.currency)
  const refunded = payment?.refunded_amount
    ? formatReceiptAmount(payment.refunded_amount, payment.currency)
    : ''
  const rows = [
    ['Receipt number', reference],
    ['Order', payment?.order_id || 'Unavailable'],
    ['Date paid', date || 'Unavailable'],
    ['Status', payment?.refund_status ? String(payment.refund_status).replaceAll('_', ' ') : 'Paid'],
    ...(refunded ? [['Refunded', refunded]] : []),
  ]
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Receipt ${escapeHtml(reference)}</title>
<style>
body{font-family:Arial,sans-serif;color:#111;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.5}
h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:20px 0}
td{padding:8px 0;border-bottom:1px solid #ddd;vertical-align:top}td:last-child{text-align:right}
.muted{color:#666;font-size:13px}.total td{font-weight:bold;border-bottom:2px solid #111}
@media print{.noprint{display:none}}
</style></head><body>
<h1>Payment receipt</h1>
<p class="muted">${escapeHtml(seller.name)}${seller.address ? `<br>${escapeHtml(seller.address)}` : ''}<br>${escapeHtml(seller.email)}${seller.taxId ? `<br>Tax ID: ${escapeHtml(seller.taxId)}` : ''}</p>
<p><strong>Billed to</strong><br>${escapeHtml(customer.name || '')}${customer.name ? '<br>' : ''}${escapeHtml(customer.email || '')}</p>
<table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
<table><tr><td>${escapeHtml(receiptPlanLabel(payment?.plan))}${payment?.credits_added ? ` · ${escapeHtml(payment.credits_added)} credits` : ''}</td><td>${escapeHtml(amount)}</td></tr>
<tr class="total"><td>Total paid</td><td>${escapeHtml(amount)}</td></tr></table>
<p class="muted">This is a payment receipt, not a tax invoice. Questions: ${escapeHtml(seller.email)}</p>
<p class="noprint"><button onclick="print()">Print or save as PDF</button></p>
</body></html>`
}

export function downloadPaymentReceipt(payment, customer, date) {
  const blob = new Blob([buildReceiptHtml(payment, customer, date)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lekha-receipt-${payment?.payment_id || payment?.id || 'payment'}.html`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
