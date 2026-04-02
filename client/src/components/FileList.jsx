function fileIcon(file) {
  if (file.type === 'folder') return '📁'
  const ext = file.name.split('.').pop().toLowerCase()
  const map = {
    js: '⚡', jsx: '⚡', ts: '⚡', tsx: '⚡',
    py: '🐍',
    json: '{}', jsonc: '{}',
    md: '📝', txt: '📝',
    html: '🌐', css: '🎨',
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼', webp: '🖼',
    mp4: '🎬', mov: '🎬', avi: '🎬',
    mp3: '🎵', wav: '🎵',
    pdf: '📕',
    zip: '🗜', tar: '🗜', gz: '🗜',
    sh: '⌨', bash: '⌨', zsh: '⌨',
    sql: '🗄',
    env: '🔒',
  }
  return map[ext] ?? '📄'
}

function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/** Absolute path through segment index i (inclusive) from an absolute path. */
function pathThroughSegments(fullPath, endIdx) {
  const norm = fullPath.replace(/\\/g, '/').trim()
  const segments = norm.split('/').filter((s) => s.length > 0)
  if (segments.length === 0) return '/'

  if (/^[a-zA-Z]:$/.test(segments[0])) {
    const drive = segments[0]
    const rest = segments.slice(1)
    const slice = rest.slice(0, endIdx + 1)
    return slice.length ? `${drive}/${slice.join('/')}` : `${drive}/`
  }

  const slice = segments.slice(0, endIdx + 1)
  return `/${slice.join('/')}`
}

function breadcrumbRootTarget(fullPath) {
  const norm = fullPath.replace(/\\/g, '/').trim()
  const segments = norm.split('/').filter(Boolean)
  if (segments.length && /^[a-zA-Z]:$/.test(segments[0])) {
    return `${segments[0]}/`
  }
  return '/'
}

function Breadcrumb({ path, onNavigate }) {
  if (!path) return <span className="file-list__breadcrumb-item current">No location selected</span>

  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)

  function go(e, targetPath) {
    e.stopPropagation()
    if (onNavigate) onNavigate(targetPath)
  }

  return (
    <div className="file-list__breadcrumb">
      <button
        type="button"
        className="file-list__breadcrumb-btn file-list__breadcrumb-item file-list__breadcrumb-item--nav"
        title="Go to filesystem root"
        aria-label="Go to filesystem root"
        onClick={(e) => go(e, breadcrumbRootTarget(path))}
      >
        ⌂
      </button>
      {parts.map((part, i) => {
        const isCurrent = i === parts.length - 1
        const target = pathThroughSegments(path, i)
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="file-list__breadcrumb-sep">/</span>
            {isCurrent || !onNavigate ? (
              <span className={`file-list__breadcrumb-item ${isCurrent ? 'current' : ''}`}>{part}</span>
            ) : (
              <button
                type="button"
                className="file-list__breadcrumb-btn file-list__breadcrumb-item file-list__breadcrumb-item--nav"
                title={`Open ${target}`}
                onClick={(e) => go(e, target)}
              >
                {part}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

export default function FileList({
  files,
  loading,
  currentPath,
  selectedRow,
  onSelectFile,
  onContextMenu,
  onBackgroundContextMenu,
  onNavigate,
}) {
  return (
    <div className="file-list">
      <div className="file-list__toolbar">
        <Breadcrumb path={currentPath} onNavigate={onNavigate} />
        {loading && <span className="spinner" style={{ marginLeft: 'auto' }} />}
      </div>

      <div
        className="file-list__table-wrap"
        onContextMenu={(e) => {
          if (e.target.closest?.('.file-list__row')) return
          if (!currentPath || !onBackgroundContextMenu) return
          e.preventDefault()
          onBackgroundContextMenu(e)
        }}
      >
        {!currentPath && !loading ? (
          <div className="file-list__empty">
            <span className="file-list__empty-icon">◈</span>
            <span>Select a folder from the sidebar</span>
          </div>
        ) : files.length === 0 && !loading ? (
          <div className="file-list__empty">
            <span className="file-list__empty-icon">📂</span>
            <span>This folder is empty</span>
          </div>
        ) : (
          <table className="file-list__table">
            <thead className="file-list__thead">
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Date Modified</th>
                <th style={{ textAlign: 'right' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.path}
                  className={`file-list__row ${selectedRow === file.path ? 'selected' : ''}`}
                  onClick={() => onSelectFile(file)}
                  onContextMenu={(e) => onContextMenu(e, file)}
                >
                  <td>{fileIcon(file)}</td>
                  <td>
                    <span className="file-list__name">{file.name}</span>
                  </td>
                  <td>
                    <span className="file-list__date">{formatDate(file.modified)}</span>
                  </td>
                  <td>
                    <span className="file-list__size">{formatSize(file.size)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
