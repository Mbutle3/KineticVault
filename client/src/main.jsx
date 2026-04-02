import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadA11yPrefs, applyA11yPrefsToDocument } from './lib/accessibilityPrefs.js'

applyA11yPrefsToDocument(loadA11yPrefs())
if (localStorage.getItem('kv-theme') === 'light') {
  document.documentElement.setAttribute('data-theme', 'light')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
