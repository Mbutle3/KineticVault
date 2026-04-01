import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import FileList from './components/FileList.jsx'
import FilePreview from './components/FilePreview.jsx'
import CommandBar from './components/CommandBar.jsx'
import ContextMenu from './components/ContextMenu.jsx'
import ToastNotification from './components/ToastNotification.jsx'

export default function App() {
  const [currentPath, setCurrentPath] = useState(null)
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  // Tabs: array of { path, name, content, loading }
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)

  const [selectedRow, setSelectedRow] = useState(null)

  // Context menu: { x, y, target } | null
  const [contextMenu, setContextMenu] = useState(null)

  // Toast: array of { id, message, type }
  const [toasts, setToasts] = useState([])

  // --- Toast helpers ---
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // --- File listing ---
  const loadDirectory = useCallback(async (path) => {
    setCurrentPath(path)
    setSelectedRow(null)
    setFilesLoading(true)
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      if (!res.ok) {
        const err = await res.json()
        addToast(err.detail || 'Failed to load directory', 'error')
        return
      }
      const data = await res.json()
      setFiles(data)
    } catch {
      addToast('Network error loading directory', 'error')
    } finally {
      setFilesLoading(false)
    }
  }, [addToast])

  // --- File preview ---
  const openFile = useCallback(async (file) => {
    if (file.type === 'folder') {
      loadDirectory(file.path)
      return
    }

    // If already open, just switch to it
    const existing = openTabs.find((t) => t.path === file.path)
    if (existing) {
      setActiveTab(file.path)
      return
    }

    const newTab = { path: file.path, name: file.name, content: null, loading: true }
    setOpenTabs((prev) => [...prev, newTab])
    setActiveTab(file.path)

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(file.path)}`)
      if (!res.ok) {
        const err = await res.json()
        addToast(err.detail || 'Failed to read file', 'error')
        setOpenTabs((prev) => prev.filter((t) => t.path !== file.path))
        setActiveTab((prev) => (prev === file.path ? null : prev))
        return
      }
      const data = await res.json()
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === file.path ? { ...t, content: data.content, loading: false } : t))
      )
    } catch {
      addToast('Network error reading file', 'error')
      setOpenTabs((prev) => prev.filter((t) => t.path !== file.path))
    }
  }, [openTabs, addToast, loadDirectory])

  const closeTab = useCallback((path) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path)
      const next = prev.filter((t) => t.path !== path)
      if (activeTab === path) {
        const fallback = next[idx] ?? next[idx - 1] ?? null
        setActiveTab(fallback?.path ?? null)
      }
      return next
    })
  }, [activeTab])

  // --- Delete ---
  const deleteFile = useCallback(async (file) => {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        addToast(err.detail || 'Delete failed', 'error')
        return
      }
      addToast(`Deleted: ${file.name}`, 'success')
      closeTab(file.path)
      if (currentPath) loadDirectory(currentPath)
    } catch {
      addToast('Network error during delete', 'error')
    }
  }, [addToast, closeTab, currentPath, loadDirectory])

  // --- Rename ---
  const renameFile = useCallback(async (file) => {
    const newName = window.prompt('Rename to:', file.name)
    if (!newName || newName === file.name) return
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: file.path, new_name: newName }),
      })
      if (!res.ok) {
        const err = await res.json()
        addToast(err.detail || 'Rename failed', 'error')
        return
      }
      addToast(`Renamed to: ${newName}`, 'success')
      if (currentPath) loadDirectory(currentPath)
    } catch {
      addToast('Network error during rename', 'error')
    }
  }, [addToast, currentPath, loadDirectory])

  // --- Context menu ---
  const openContextMenu = useCallback((e, file) => {
    e.preventDefault()
    setSelectedRow(file.path)
    setContextMenu({ x: e.clientX, y: e.clientY, target: file })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  return (
    <div className="app" onClick={closeContextMenu}>
      {/* Header */}
      <header className="app-header">
        <div className="app-header__logo">
          The <span>Kinetic</span> Vault
        </div>
        <div className="app-header__search-wrap">
          <input
            className="app-header__search"
            type="text"
            placeholder="Search files..."
          />
        </div>
        <div className="app-header__actions">
          <button className="icon-btn" title="Settings">⚙</button>
          <button className="icon-btn" title="Toggle theme">◑</button>
          <button className="icon-btn" title="Help">?</button>
        </div>
      </header>

      {/* Three-panel body */}
      <div className="main-area">
        <Sidebar onSelectFolder={loadDirectory} currentPath={currentPath} />
        <div className="panel-divider" />
        <FileList
          files={files}
          loading={filesLoading}
          currentPath={currentPath}
          selectedRow={selectedRow}
          onSelectFile={openFile}
          onContextMenu={openContextMenu}
        />
        <div className="panel-divider" />
        <FilePreview
          openTabs={openTabs}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          onTabClose={closeTab}
        />
      </div>

      {/* Command bar pinned to bottom */}
      <CommandBar activeFile={openTabs.find((t) => t.path === activeTab) ?? null} />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={closeContextMenu}
          onOpen={openFile}
          onRename={renameFile}
          onDelete={deleteFile}
        />
      )}

      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <ToastNotification
            key={t.id}
            message={t.message}
            type={t.type}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </div>
    </div>
  )
}
