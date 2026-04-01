import { useState } from 'react'

const PINNED = [
  { name: 'project-notes.md', icon: '★', path: '/tmp/project-notes.md' },
  { name: 'config.json',      icon: '★', path: '/tmp/config.json'      },
  { name: 'README.md',        icon: '★', path: '/tmp/README.md'        },
]

const VAULT_TREE = [
  { name: 'Root',      icon: '⊟', path: '/',          depth: 0, isFolder: true },
  { name: 'Documents', icon: '▶', path: '/Documents', depth: 1, isFolder: true },
  { name: 'Media',     icon: '▶', path: '/Media',     depth: 1, isFolder: true },
  { name: 'System',    icon: '▶', path: '/System',    depth: 1, isFolder: true },
  { name: 'Trash',     icon: '▶', path: '/Trash',     depth: 1, isFolder: true },
]

const PROJECTS = [
  {
    name: 'kinetic-vault',
    path: '/projects/kinetic-vault',
    expanded: true,
    children: [
      { name: 'client', path: '/projects/kinetic-vault/client' },
      { name: 'server', path: '/projects/kinetic-vault/server' },
    ],
  },
  {
    name: 'archive',
    path: '/projects/archive',
    expanded: false,
    children: [],
  },
]

export default function Sidebar({ onSelectFolder, currentPath }) {
  const [expandedProjects, setExpandedProjects] = useState({ 'kinetic-vault': true })

  function toggleProject(name) {
    setExpandedProjects((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <aside className="sidebar">
      {/* PINNED */}
      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Pinned</span>
        </div>
        {PINNED.map((item) => (
          <div
            key={item.path}
            className={`sidebar__item ${currentPath === item.path ? 'active' : ''}`}
            onClick={() => onSelectFolder(item.path)}
            title={item.path}
          >
            <span className="sidebar__item-icon" style={{ color: 'var(--accent)', fontSize: '11px' }}>
              {item.icon}
            </span>
            <span className="sidebar__item-name">{item.name}</span>
          </div>
        ))}
      </div>

      {/* VAULT EXPLORER */}
      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Vault Explorer</span>
        </div>
        {VAULT_TREE.map((item) => (
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
          <button className="sidebar__add-btn" title="Add project">＋</button>
        </div>
        {PROJECTS.map((project) => (
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
