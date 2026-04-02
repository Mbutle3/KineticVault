import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../lib/apiFetch.js'

function buildVaultTree(roots) {
  const base = [{ name: 'Root', icon: '⊟', path: '/', depth: 0, isFolder: true }]
  if (!roots?.home) return base
  const items = [
    ...base,
    { name: 'Documents', icon: '▶', path: roots.documents, depth: 1, isFolder: true },
    { name: 'Media', icon: '▶', path: roots.media, depth: 1, isFolder: true },
  ]
  if (roots.system) {
    items.push({ name: 'System', icon: '▶', path: roots.system, depth: 1, isFolder: true })
  }
  items.push({ name: 'Trash', icon: '▶', path: roots.trash, depth: 1, isFolder: true })
  return items
}

export default function Sidebar({
  onSelectFolder,
  onOpenFile,
  currentPath,
  pinRefreshToken = 0,
  onUnpinPath,
  onPinnedContextMenu,
}) {
  const [roots, setRoots] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState({})

  useEffect(() => {
    apiFetch('/api/files/home')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRoots)
      .catch(() => setRoots(null))
  }, [pinRefreshToken])

  useEffect(() => {
    if (!roots?.projects?.length) return
    setExpandedProjects((prev) => {
      const next = { ...prev }
      for (const p of roots.projects) {
        if (!(p.name in next)) next[p.name] = Boolean(p.expanded)
      }
      return next
    })
  }, [roots])

  const vaultTree = useMemo(() => buildVaultTree(roots), [roots])
  const projects = roots?.projects ?? []
  const pinned = roots?.pinned ?? []

  function toggleProject(name) {
    setExpandedProjects((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <aside className="sidebar">
      {pinned.length > 0 && (
      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Pinned</span>
        </div>
        {pinned.map((item) => (
          <div
            key={item.path}
            className={`sidebar__item ${currentPath === item.path ? 'active' : ''}`}
            onClick={() =>
              item.kind === 'file'
                ? onOpenFile?.({ path: item.path, name: item.name, type: 'file' })
                : onSelectFolder(item.path)
            }
            onContextMenu={(e) => onPinnedContextMenu?.(e, item)}
            title={item.path}
          >
            <button
              type="button"
              className="sidebar__item-pin-btn"
              title="Unpin"
              aria-label={`Unpin ${item.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onUnpinPath?.(item.path)
              }}
            >
              ★
            </button>
            <span className="sidebar__item-name">{item.name}</span>
          </div>
        ))}
      </div>
      )}

      {/* VAULT EXPLORER */}
      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Vault Explorer</span>
        </div>
        {vaultTree.map((item) => (
          <div
            key={item.path}
            className={`sidebar__tree-item ${currentPath === item.path ? 'active' : ''}`}
            style={{ '--depth': item.depth }}
            onClick={() => onSelectFolder(item.path)}
            title={item.path}
          >
            <span className="sidebar__expand-btn">{item.icon}</span>
            <span style={{ fontSize: '13px', color: currentPath === item.path ? 'var(--accent)' : 'var(--accent-dim)', opacity: 0.85 }}>
              {item.isFolder ? '📁' : '📄'}
            </span>
            <span className="sidebar__item-name">{item.name}</span>
          </div>
        ))}
      </div>

      {/* PROJECTS */}
      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Projects</span>
        </div>
        {projects.map((project) => (
          <div key={project.name}>
            <div
              className={`sidebar__tree-item ${currentPath === project.path ? 'active' : ''}`}
              style={{ '--depth': 0 }}
              onClick={() => {
                toggleProject(project.name)
                onSelectFolder(project.path)
              }}
            >
              <span className="sidebar__expand-btn">
                {expandedProjects[project.name] ? '⊟' : '▶'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--accent-dim)', opacity: 0.85 }}>◈</span>
              <span className="sidebar__item-name">{project.name}</span>
            </div>
            {expandedProjects[project.name] &&
              project.children.map((child) => (
                <div
                  key={child.path}
                  className={`sidebar__tree-item ${currentPath === child.path ? 'active' : ''}`}
                  style={{ '--depth': 1 }}
                  onClick={() => onSelectFolder(child.path)}
                >
                  <span className="sidebar__expand-btn" />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📂</span>
                  <span className="sidebar__item-name">{child.name}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
