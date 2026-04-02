import { useState, useEffect, useRef, useCallback } from 'react'

function fileIcon(file) {
  if (file.type === 'folder') return '📁'
  const ext = file.name.split('.').pop().toLowerCase()
  const map = {
    js: '⚡', jsx: '⚡', ts: '⚡', tsx: '⚡',
    py: '🐍',
    json: '{}', md: '📝', txt: '📝',
    pdf: '📕',
  }
  return map[ext] ?? '📄'
}

function parentDir(fullPath) {
  const normalized = fullPath.replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  if (i <= 0) return fullPath
  return normalized.slice(0, i)
}

export default function FileSearch({ root, rootLabel, onPick, onError }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280)
    return () => clearTimeout(t)
  }, [query])

  const runSearch = useCallback(async () => {
    const q = debounced.trim()
    if (!q || !root) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const url = `/api/files/search?q=${encodeURIComponent(q)}&root=${encodeURIComponent(root)}&limit=150`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        onErrorRef.current?.(err.detail || 'Search failed')
        setResults([])
        return
      }
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      onErrorRef.current?.('Network error while searching')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [debounced, root])

  useEffect(() => {
    if (!open) return
    runSearch()
  }, [open, runSearch])

  useEffect(() => {
    function onDocDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function handlePick(item) {
    onPick(item)
    setQuery('')
    setDebounced('')
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div className="file-search" ref={wrapRef}>
      <input
        ref={inputRef}
        className="app-header__search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={root ? 'Search files…' : 'Search files… (loading)'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        aria-label="Search files"
        aria-expanded={showPanel}
        aria-controls="file-search-results"
      />
      {showPanel && (
        <div
          id="file-search-results"
          className="file-search__dropdown"
          role="listbox"
        >
          <div className="file-search__hint">
            {rootLabel ? `In ${rootLabel}` : '—'}
            {loading && <span className="file-search__loading">Searching…</span>}
          </div>
          {!loading && results.length === 0 && (
            <div className="file-search__empty">No matching files or folders</div>
          )}
          {!loading &&
            results.map((item) => (
              <button
                key={item.path}
                type="button"
                className="file-search__row"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(item)}
              >
                <span className="file-search__icon">{fileIcon(item)}</span>
                <span className="file-search__meta">
                  <span className="file-search__name">{item.name}</span>
                  <span className="file-search__path">{parentDir(item.path)}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
