import { useEffect } from 'react'
import { rawFileUrl } from '../lib/filePreviewKind.js'

function TabBar({ openTabs, activeTab, onTabSelect, onTabClose }) {
  return (
    <div className="file-preview__tabs">
      {openTabs.map((tab) => (
        <button
          key={tab.path}
          className={`file-preview__tab ${activeTab === tab.path ? 'active' : ''}`}
          onClick={() => onTabSelect(tab.path)}
          title={tab.path}
        >
          <span>{tab.name}</span>
          {tab.loading && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
          <span
            className="file-preview__tab-close"
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.path) }}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  )
}

function PreviewChrome({ openTabs, activeTab, onTabSelect, onTabClose, previewExpanded, onToggleExpand }) {
  if (openTabs.length === 0) return null
  return (
    <div className="file-preview__chrome">
      <TabBar
        openTabs={openTabs}
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
      />
      <button
        type="button"
        className="file-preview__expand"
        title={previewExpanded ? 'Show file list (Escape)' : 'Expand preview to full width'}
        aria-label={previewExpanded ? 'Show file list' : 'Expand preview to full width'}
        aria-pressed={previewExpanded}
        onClick={(e) => {
          e.stopPropagation()
          onToggleExpand?.()
        }}
      >
        {previewExpanded ? '⧉' : '⛶'}
      </button>
    </div>
  )
}

function BinaryFallback({ path, name }) {
  const src = rawFileUrl(path)
  return (
    <div className="file-preview__binary">
      <p className="file-preview__binary-msg">No in-app preview for this file type.</p>
      <p className="file-preview__binary-hint">CSV, SQL, XML, LaTeX, and plain text open in the editor. Download or open below.</p>
      <div className="file-preview__binary-actions">
        <a className="file-preview__binary-link" href={src} download={name}>
          Download
        </a>
        <a className="file-preview__binary-link" href={src} target="_blank" rel="noopener noreferrer">
          Open externally
        </a>
      </div>
    </div>
  )
}

function MediaPane({ path, name, kind }) {
  const src = rawFileUrl(path)

  if (kind === 'pdf') {
    return (
      <iframe
        className="file-preview__iframe"
        title={name}
        src={`${src}#view=FitH`}
      />
    )
  }

  if (kind === 'image') {
    return (
      <div className="file-preview__img-wrap">
        <img className="file-preview__img" src={src} alt="" />
      </div>
    )
  }

  return <BinaryFallback path={path} name={name} />
}

export default function FilePreview({
  openTabs,
  activeTab,
  onTabSelect,
  onTabClose,
  previewExpanded = false,
  onToggleExpand,
  onActiveFileContentChange,
  onRequestSaveNow,
}) {
  const current = openTabs.find((t) => t.path === activeTab) ?? null
  const kind = current?.previewKind ?? 'text'

  useEffect(() => {
    function onKey(e) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return
      const el = document.activeElement
      if (el?.closest?.('.file-preview__editor')) {
        e.preventDefault()
        onRequestSaveNow?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRequestSaveNow])

  return (
    <div className="file-preview">
      <PreviewChrome
        openTabs={openTabs}
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        previewExpanded={previewExpanded}
        onToggleExpand={onToggleExpand}
      />

      {!current ? (
        <div className="file-preview__empty">
          <span className="file-preview__empty-icon">◈</span>
          <span>No file open</span>
          <span className="file-preview__empty-hint">Click a file in the list to preview it</span>
        </div>
      ) : current.loading ? (
        <div className="file-preview__empty">
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span className="file-preview__empty-hint">Loading…</span>
        </div>
      ) : kind !== 'text' ? (
        <div className={`file-preview__content file-preview__content--media ${kind === 'binary' ? 'file-preview__content--binary' : ''}`}>
          <MediaPane path={current.path} name={current.name} kind={kind} />
        </div>
      ) : (
        <div className="file-preview__content file-preview__content--editable">
          <textarea
            className="file-preview__editor"
            value={current.content ?? ''}
            onChange={(e) => onActiveFileContentChange?.(e.target.value)}
            spellCheck={false}
            aria-label={`Edit ${current.name}`}
          />
        </div>
      )}
    </div>
  )
}
