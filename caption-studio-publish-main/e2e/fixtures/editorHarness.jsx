import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './editorAuth'
import Dashboard from '../../src/pages/Dashboard'
import { Toaster } from '../../src/components/ui/toaster'
import '../../src/index.css'
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><Dashboard /><Toaster /></AuthProvider></BrowserRouter>)
