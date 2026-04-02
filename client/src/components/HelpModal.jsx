const FAQ = [
  {
    q: 'How do I open files and folders?',
    a: 'Click a folder in the middle list to browse. Click a file to open it in the preview panel on the right. Use the sidebar shortcuts for Home, Documents, pinned files, and projects.',
  },
  {
    q: 'How does search work?',
    a: 'Type in the header search field. Results are limited to the current folder if one is open, otherwise your home directory. Pick a result to open it.',
  },
  {
    q: 'How do I pin or unpin files?',
    a: 'Right-click a file or folder in the list and choose “Pin to sidebar”. Click the star on a pinned item to unpin, or right-click the pin and choose “Unpin from sidebar”.',
  },
  {
    q: 'Can I resize panels?',
    a: 'Yes. Drag the vertical bars between sidebar, file list, and preview. Drag the horizontal bar above the AI command area to change its height. Sizes are remembered on this browser.',
  },
  {
    q: 'Why does the backend need to run?',
    a: 'The React app talks to a local FastAPI server for file access. Start it from the server folder with uvicorn (see the project README).',
  },
]

export default function HelpModal({ open, onClose }) {
  if (!open) return null

  function onOverlayDown(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="kv-modal-overlay" role="presentation" onMouseDown={onOverlayDown}>
      <div
        className="kv-modal kv-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kv-help-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="kv-modal__header">
          <h2 id="kv-help-title" className="kv-modal__title">
            Help &amp; support
          </h2>
          <button type="button" className="kv-modal__close" onClick={onClose} aria-label="Close help">
            ×
          </button>
        </div>

        <div className="kv-modal__body kv-help-body">
          <section className="kv-help-intro" aria-labelledby="kv-help-guide">
            <h3 id="kv-help-guide" className="kv-settings-section__title">
              Quick guide
            </h3>
            <ol className="kv-help-steps">
              <li>Start the API server, then run the Vite client (see README).</li>
              <li>Pick a location from the sidebar or search.</li>
              <li>Browse files in the center; preview code on the right.</li>
              <li>Use the bottom panel for AI commands when wired up.</li>
            </ol>
          </section>

          <section className="kv-help-faq" aria-labelledby="kv-help-faq-h">
            <h3 id="kv-help-faq-h" className="kv-settings-section__title">
              FAQ
            </h3>
            <dl className="kv-help-faq__list">
              {FAQ.map((item) => (
                <div key={item.q} className="kv-help-faq__item">
                  <dt className="kv-help-faq__q">{item.q}</dt>
                  <dd className="kv-help-faq__a">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="kv-help-support" aria-labelledby="kv-help-support-h">
            <h3 id="kv-help-support-h" className="kv-settings-section__title">
              Support
            </h3>
            <p className="kv-help-support__text">
              For bugs or feature ideas, use your project’s issue tracker or version control host. Check the README for stack
              details (FastAPI, React, Vite) and environment setup.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
