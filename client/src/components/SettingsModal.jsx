const FONT_STEPS = [
  { value: 0.85, label: 'Smaller' },
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Larger' },
  { value: 1.3, label: 'Largest' },
]

function fontScaleMatches(current, step) {
  return Math.abs(current - step) < 0.02
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  prefs,
  onPrefsChange,
}) {
  if (!open) return null

  function onOverlayDown(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="kv-modal-overlay"
      role="presentation"
      onMouseDown={onOverlayDown}
    >
      <div
        className="kv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kv-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="kv-modal__header">
          <h2 id="kv-settings-title" className="kv-modal__title">
            Settings
          </h2>
          <button type="button" className="kv-modal__close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="kv-modal__body">
          <section className="kv-settings-section" aria-labelledby="kv-set-appearance">
            <h3 id="kv-set-appearance" className="kv-settings-section__title">
              Appearance
            </h3>
            <p className="kv-settings-section__hint">Color theme for the whole app.</p>
            <div className="kv-settings-row" role="group" aria-label="Theme">
              <button
                type="button"
                className={`kv-settings-chip ${theme === 'dark' ? 'is-active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                Dark
              </button>
              <button
                type="button"
                className={`kv-settings-chip ${theme === 'light' ? 'is-active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                Light
              </button>
            </div>
          </section>

          <section className="kv-settings-section" aria-labelledby="kv-set-text">
            <h3 id="kv-set-text" className="kv-settings-section__title">
              Text size
            </h3>
            <p className="kv-settings-section__hint">Scales interface text. Code preview uses a fixed size for alignment.</p>
            <div className="kv-settings-row" role="group" aria-label="Text size">
              {FONT_STEPS.map((step) => (
                <button
                  key={step.value}
                  type="button"
                  className={`kv-settings-chip ${fontScaleMatches(prefs.fontScale, step.value) ? 'is-active' : ''}`}
                  onClick={() => onPrefsChange({ ...prefs, fontScale: step.value })}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </section>

          <section className="kv-settings-section" aria-labelledby="kv-set-a11y">
            <h3 id="kv-set-a11y" className="kv-settings-section__title">
              Accessibility
            </h3>

            <label className="kv-settings-toggle">
              <input
                type="checkbox"
                checked={prefs.reduceMotion}
                onChange={(e) => onPrefsChange({ ...prefs, reduceMotion: e.target.checked })}
              />
              <span className="kv-settings-toggle__label">
                <strong>Reduce motion</strong>
                <span className="kv-settings-toggle__desc">Shortens or disables transitions and animations.</span>
              </span>
            </label>

            <label className="kv-settings-toggle">
              <input
                type="checkbox"
                checked={prefs.highContrast}
                onChange={(e) => onPrefsChange({ ...prefs, highContrast: e.target.checked })}
              />
              <span className="kv-settings-toggle__label">
                <strong>Higher contrast borders</strong>
                <span className="kv-settings-toggle__desc">Stronger panel and control outlines.</span>
              </span>
            </label>

            <label className="kv-settings-toggle">
              <input
                type="checkbox"
                checked={prefs.strongFocus}
                onChange={(e) => onPrefsChange({ ...prefs, strongFocus: e.target.checked })}
              />
              <span className="kv-settings-toggle__label">
                <strong>Stronger keyboard focus</strong>
                <span className="kv-settings-toggle__desc">Thicker focus rings when using Tab to navigate.</span>
              </span>
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
