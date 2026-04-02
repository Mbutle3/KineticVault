import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadA11yPrefs, applyA11yPrefsToDocument } from './lib/accessibilityPrefs.js'

function renderBootError(err) {
  const root = document.getElementById('root')
  if (!root) return
  const msg = err instanceof Error ? (err.stack || err.message) : String(err)
  root.innerHTML = `
    <div style="
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      padding: 16px;
      line-height: 1.4;
      white-space: pre-wrap;
      color: #111;
      background: #fff3cd;
      border: 1px solid #ffecb5;
      border-radius: 8px;
      margin: 16px;
      max-width: 980px;
    ">
      <div style="font-weight: 800; margin-bottom: 8px;">Kinetic Vault failed to start</div>
      <div style="opacity: 0.85; margin-bottom: 12px;">
        Open DevTools Console for details. This message is shown to avoid a blank screen.
      </div>
      ${msg.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}
    </div>
  `
}

try {
  applyA11yPrefsToDocument(loadA11yPrefs())
  if (localStorage.getItem('kv-theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  const el = document.getElementById('root')
  if (!el) throw new Error('Missing #root element')

  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  renderBootError(e)
  throw e
}
