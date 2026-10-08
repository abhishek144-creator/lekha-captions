import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './editorAuth'
import PricingModal from '../../src/components/dashboard/PricingModal'
import { testUser } from './editorAuth'
import Dashboard from '../../src/pages/Dashboard'
import { Toaster } from '../../src/components/ui/toaster'
import '../../src/index.css'
function PaymentHarness() {
  const [open, setOpen] = useState(true)
  return <><button onClick={() => setOpen(true)}>Open test checkout</button><PricingModal isOpen={open} onClose={() => setOpen(false)} user={testUser} /></>
}
const View = new URLSearchParams(window.location.search).get('testView') === 'payment' ? PaymentHarness : Dashboard
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><View /><Toaster /></AuthProvider></BrowserRouter>)
