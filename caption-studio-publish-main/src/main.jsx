import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/captionTemplates.css'
import { AuthProvider } from './lib/AuthContext'
import { initWebVitalsTracking } from '@/lib/webVitals'

// Firebase auth treats localhost and 127.0.0.1 as different domains.
// Normalize local dev traffic to localhost so Google auth works in dev.
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_API_KEY &&
  window.location.hostname === '127.0.0.1'
) {
  const redirectUrl = new URL(window.location.href)
  redirectUrl.hostname = 'localhost'
  window.location.replace(redirectUrl.toString())
}

initWebVitalsTracking()

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
