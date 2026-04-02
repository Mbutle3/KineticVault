const FAQ = [
  {
    q: 'What is Kinetic Vault?',
    a: 'A local-first file workspace: a React interface backed by a FastAPI service on your machine. It lists and previews files under your user home directory and the application repository; it does not upload your filesystem to a remote host unless you enable optional cloud AI (Anthropic) for the command bar.',
  },
  {
    q: 'How do I open files and folders?',
    a: 'Select a folder in the file list to navigate. Select a file to open it in the preview column. Text files support in-browser editing with debounced save to disk. Use the sidebar for Home, Documents, Trash (OS-specific), pinned paths, and the project tree.',
  },
  {
    q: 'How does search work?',
    a: 'Use the header field to search file and folder names by substring. The scope is the current directory when a folder is open; otherwise it defaults to your home directory. Choose a result to open the file or enter the folder.',
  },
  {
    q: 'How are pins stored?',
    a: 'Pinned items are persisted in ~/.kineticvault/pins.json on the machine running the API. They appear in the sidebar for quick access.',
  },
  {
    q: 'How do I pin or unpin?',
    a: 'Right-click an item in the file list and choose “Pin to sidebar”. To remove a pin, use the star control on the pin row, or right-click the pin and choose “Unpin from sidebar”.',
  },
  {
    q: 'Can I resize the layout?',
    a: 'Yes. Drag the vertical dividers between the sidebar, file list, and preview. Drag the horizontal divider above the command bar to change its height. Dimensions are stored in this browser’s localStorage.',
  },
  {
    q: 'How does text saving work?',
    a: 'For text previews, edits are saved automatically after a short pause. Switching tabs or pressing ⌘/Ctrl+S flushes pending changes. Non-text files (PDF, images, etc.) are previewed or opened via download/external links as described in the preview panel.',
  },
  {
    q: 'What does the AI command bar do?',
    a: '“Find recent files” and “Show largest files” run bounded scans on the server (repository, Documents, and the current folder when applicable). “Summarize this file” and arbitrary prompts use the Anthropic API when ANTHROPIC_API_KEY is set in server/.env; otherwise you will see local fallbacks or setup guidance. For questions about folders (e.g. Documents or the directory you have open), the backend can attach read-only listings of file and folder names so Claude can describe what is there instead of claiming it has no access.',
  },
  {
    q: 'How do voice input and Read aloud work?',
    a: 'The microphone uses your browser’s speech recognition where supported (often Chrome or Edge); audio may be processed by the browser vendor’s service—allow the mic when prompted. After an AI reply, Read aloud plays the text: if OPENAI_API_KEY is set on the server, Kinetic Vault uses OpenAI’s cloud TTS (usually more natural); otherwise it uses the browser’s built-in speech. The same button stops playback. Cloud TTS sends only that reply text to OpenAI over HTTPS.',
  },
  {
    q: 'Which optional API keys does Kinetic Vault use?',
    a: 'ANTHROPIC_API_KEY powers Claude for the command bar (summaries and free-form chat). OPENAI_API_KEY is optional and only used for cloud Read aloud (MP3 from the OpenAI speech API). File browsing, search, and local quick actions do not require either key. See README.md for env variable names and endpoints.',
  },
  {
    q: 'Why must the API be running?',
    a: 'The UI proxies /api/* to the FastAPI process (default http://127.0.0.1:8000). Without it, listing, search, preview, and writes will fail. From the repository root, npm run dev can start the API and Vite together; see README for alternatives.',
  },
  {
    q: 'Is this safe to run with a public repo?',
    a: 'Treat Kinetic Vault as a local power tool. The API can write/delete files within its allowed scope (your home directory and this repo). Do not expose the API port publicly. For extra safety, set KV_API_TOKEN in server/.env so /api/* requests require a token header (you can set the token in the UI via the Command Bar “Token: on/off” button), and keep AI rate limiting enabled to avoid accidental spend. Never commit API keys.',
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
            Kinetic Vault — user guide
          </h2>
          <button type="button" className="kv-modal__close" onClick={onClose} aria-label="Close help">
            ×
          </button>
        </div>

        <div className="kv-modal__body kv-help-body">
          <section className="kv-help-intro" aria-labelledby="kv-help-about">
            <h3 id="kv-help-about" className="kv-settings-section__title">
              About
            </h3>
            <p className="kv-help-lede">
              Kinetic Vault is a desktop-style file explorer with optional AI assistance. Operations execute against paths the
              backend is allowed to access (typically your home tree and the checked-out repository). Treat this as a power-user
              tool: it can read, create, rename, duplicate, and delete files according to your OS permissions.
            </p>
          </section>

          <section className="kv-help-intro" aria-labelledby="kv-help-guide">
            <h3 id="kv-help-guide" className="kv-settings-section__title">
              Getting started
            </h3>
            <ol className="kv-help-steps">
              <li>
                <strong>Environment:</strong> Install dependencies per README — Python 3.9+ for the API (FastAPI/Uvicorn), Node 18+
                for the client. From the repo root, <code>npm run dev</code> starts the API and Vite together, or run them in
                separate terminals.
              </li>
              <li>
                <strong>Access:</strong> Open the app URL (e.g. http://localhost:5173). Confirm the API is reachable; the client
                proxies <code>/api</code> to the backend.
              </li>
              <li>
                <strong>Navigation:</strong> Choose Home, Documents, or a project folder from the sidebar, or use header search.
                The file list shows the current directory; breadcrumbs provide one-click ancestors.
              </li>
              <li>
                <strong>Preview &amp; edit:</strong> Select a file to preview on the right. Text files can be edited in place;
                use the expand control or Escape as documented in the UI. PDFs and images render in-panel where supported.
              </li>
              <li>
                <strong>Command bar:</strong> Quick actions scan locally; Claude needs <code>ANTHROPIC_API_KEY</code> in{' '}
                <code>server/.env</code>. The server can include directory listings in prompts so questions like “what is in
                my Documents folder?” are grounded in your machine. Optional <code>OPENAI_API_KEY</code> enables cloud{' '}
                <strong>Read aloud</strong>; without it, Read aloud uses the browser voice. Voice <em>input</em> uses the
                browser speech API where supported. Details: README.md.
              </li>
            </ol>
          </section>

          <section className="kv-help-intro" aria-labelledby="kv-help-settings-h">
            <h3 id="kv-help-settings-h" className="kv-settings-section__title">
              Settings &amp; accessibility
            </h3>
            <p className="kv-help-lede">
              Open Settings from the header to switch light/dark theme, adjust text size, reduce motion (disables the ambient
              background), and tune focus or contrast preferences. Preferences are stored in this browser.
            </p>
          </section>

          <section className="kv-help-faq" aria-labelledby="kv-help-faq-h">
            <h3 id="kv-help-faq-h" className="kv-settings-section__title">
              Frequently asked questions
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
              Documentation &amp; feedback
            </h3>
            <p className="kv-help-support__text">
              Authoritative setup, API tables, and security notes are in the repository <strong>README.md</strong>. OpenAPI
              documentation is served at <code>/docs</code> on the running API. For defects, enhancements, or security
              disclosures, use your organization’s issue tracker or the channel defined by the maintainers of this deployment.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
