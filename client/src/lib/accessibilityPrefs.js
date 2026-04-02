const STORAGE_KEY = 'kv-a11y-prefs'

export const DEFAULT_A11Y_PREFS = {
  fontScale: 1,
  reduceMotion: false,
  highContrast: false,
  strongFocus: false,
}

export function loadA11yPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_A11Y_PREFS }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_A11Y_PREFS,
      ...parsed,
      fontScale: clampFontScale(parsed.fontScale),
    }
  } catch {
    return { ...DEFAULT_A11Y_PREFS }
  }
}

export function clampFontScale(n) {
  const x = typeof n === 'number' ? n : parseFloat(n)
  if (!Number.isFinite(x)) return 1
  return Math.min(1.5, Math.max(0.75, Math.round(x * 100) / 100))
}

export function applyA11yPrefsToDocument(prefs) {
  const el = document.documentElement
  el.style.setProperty('--kv-font-scale', String(clampFontScale(prefs.fontScale)))
  el.setAttribute('data-reduce-motion', prefs.reduceMotion ? 'true' : 'false')
  el.setAttribute('data-high-contrast', prefs.highContrast ? 'true' : 'false')
  el.setAttribute('data-strong-focus', prefs.strongFocus ? 'true' : 'false')
}

export function persistA11yPrefs(prefs) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...prefs,
        fontScale: clampFontScale(prefs.fontScale),
      })
    )
  } catch {
    /* ignore quota */
  }
}
