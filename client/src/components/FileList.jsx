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

function Breadcrumb({ path }) {
  if (!path) return <span className="file-list__breadcrumb-item current">No location selected</span>
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  return (
    <div className="file-list__breadcrumb">
      <span className="file-list__breadcrumb-item">⌂</span>
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="file-list__breadcrumb-sep">/</span>
          <span className={`file-list__breadcrumb-item ${i === parts.length - 1 ? 'current' : ''}`}>
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}

export default function FileList({ files, loading, currentPath, selectedRow, onSelectFile, onContextMenu }) {
  return (
    <div className="file-list">
      <div className="file-list__toolbar">
        <Breadcrumb path={currentPath} />
        {loading && <span className="spinner" style={{ marginLeft: 'auto' }} />}
      </div>

      <div className="file-list__table-wrap">
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
