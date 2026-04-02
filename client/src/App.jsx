import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar.jsx'
import FileSearch from './components/FileSearch.jsx'
import FileList from './components/FileList.jsx'
import FilePreview from './components/FilePreview.jsx'
import CommandBar from './components/CommandBar.jsx'
import ContextMenu from './components/ContextMenu.jsx'
import ToastNotification from './components/ToastNotification.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import HelpModal from './components/HelpModal.jsx'
const NavigationAmbient = lazy(() => import('./components/NavigationAmbient.jsx'))
import {
  loadA11yPrefs,
  applyA11yPrefsToDocument,
  persistA11yPrefs,
} from './lib/accessibilityPrefs.js'
import { getPreviewKind } from './lib/filePreviewKind.js'

export default function App() {
  const [currentPath, setCurrentPath] = useState(null)
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  // Tabs: array of { path, name, content, loading }
  const [openTabs, setOpenTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)

  const saveTimersRef = useRef({})
  const latestDraftRef = useRef({})
  const openTabsRef = useRef(openTabs)
  openTabsRef.current = openTabs
  const prevActiveTabRef = useRef(activeTab)

  const [selectedRow, setSelectedRow] = useState(null)

  // Context menu: { x, y, target } | null
  const [contextMenu, setContextMenu] = useState(null)

  const [previewExpanded, setPreviewExpanded] = useState(false)

  // Toast: array of { id, message, type }
  const [toasts, setToasts] = useState([])
  const [homePath, setHomePath] = useState(null)
  const [pinRefreshToken, setPinRefreshToken] = useState(0)

  const [theme, setTheme] = useState(() =>
    localStorage.getItem('kv-theme') === 'dark' ? 'dark' : 'light'
  )

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const [a11yPrefs, setA11yPrefs] = useState(() => loadA11yPrefs())

  const [previewWidth, setPreviewWidth] = useState(() => {
    const raw = localStorage.getItem('kv-preview-width')
    const n = raw ? parseInt(raw, 10) : 380
    if (!Number.isFinite(n)) return 380
    return Math.min(900, Math.max(200, n))
  })

  const previewWidthDuringDrag = useRef(previewWidth)
  previewWidthDuringDrag.current = previewWidth

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = localStorage.getItem('kv-sidebar-width')
    const n = raw ? parseInt(raw, 10) : 240
    if (!Number.isFinite(n)) return 240
    return Math.min(520, Math.max(160, n))
  })
  const sidebarWidthDuringDrag = useRef(sidebarWidth)
  sidebarWidthDuringDrag.current = sidebarWidth

  const [commandBarHeight, setCommandBarHeight] = useState(() => {
    const raw = localStorage.getItem('kv-commandbar-height')
    const n = raw ? parseInt(raw, 10) : 270
    if (!Number.isFinite(n)) return 270
    return Math.min(560, Math.max(120, n))
  })
  const commandBarHeightDuringDrag = useRef(commandBarHeight)
  commandBarHeightDuringDrag.current = commandBarHeight

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('kv-theme', theme)
  }, [theme])

  useEffect(() => {
    applyA11yPrefsToDocument(a11yPrefs)
    persistA11yPrefs(a11yPrefs)
  }, [a11yPrefs])

  const [navMotionEpoch, setNavMotionEpoch] = useState(0)
  useEffect(() => {
    setNavMotionEpoch((n) => n + 1)
  }, [currentPath, activeTab])

  useEffect(() => {
    if (!settingsOpen && !helpOpen) return
    function onKey(e) {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        setHelpOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, helpOpen])

  useEffect(() => {
    if (!previewExpanded) return
    function onKey(e) {
      if (e.key === 'Escape') setPreviewExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewExpanded])

  useEffect(() => {
    if (openTabs.length === 0) setPreviewExpanded(false)
  }, [openTabs.length])

  useEffect(() => {
    fetch('/api/files/home')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHomePath(d.home))
      .catch(() => setHomePath(null))
  }, [])

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

  const persistFileContent = useCallback(
    async (path, content) => {
      try {
        const res = await fetch('/api/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          addToast(err.detail || 'Save failed', 'error')
        }
      } catch {
        addToast('Network error while saving', 'error')
      }
    },
    [addToast]
  )

  const flushSaveForPath = useCallback(
    (path) => {
      const t = saveTimersRef.current[path]
      if (t) {
        clearTimeout(t)
        delete saveTimersRef.current[path]
      }
      const tab = openTabsRef.current.find((x) => x.path === path)
      if (!tab || tab.loading) return
      if (tab.previewKind && tab.previewKind !== 'text') return
      const text = latestDraftRef.current[path] ?? tab.content
      if (text != null) void persistFileContent(path, text)
    },
    [persistFileContent]
  )

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

    const previewKind = getPreviewKind(file.name)
    if (previewKind !== 'text') {
      const newTab = {
        path: file.path,
        name: file.name,
        content: null,
        loading: false,
        previewKind,
      }
      setOpenTabs((prev) => [...prev, newTab])
      setActiveTab(file.path)
      return
    }

    const newTab = {
      path: file.path,
      name: file.name,
      content: null,
      loading: true,
      previewKind: 'text',
    }
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
        prev.map((t) =>
          t.path === file.path ? { ...t, content: data.content, loading: false, previewKind: 'text' } : t
        )
      )
      latestDraftRef.current[file.path] = data.content
    } catch {
      addToast('Network error reading file', 'error')
      setOpenTabs((prev) => prev.filter((t) => t.path !== file.path))
    }
  }, [openTabs, addToast, loadDirectory])

  const updateActiveTabContent = useCallback(
    (content) => {
      if (!activeTab) return
      const tab = openTabsRef.current.find((t) => t.path === activeTab)
      if (tab?.previewKind && tab.previewKind !== 'text') return
      const path = activeTab
      latestDraftRef.current[path] = content
      setOpenTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content } : t)))
      clearTimeout(saveTimersRef.current[path])
      saveTimersRef.current[path] = setTimeout(() => {
        persistFileContent(path, content)
        delete saveTimersRef.current[path]
      }, 450)
    },
    [activeTab, persistFileContent]
  )

  const saveActiveFileNow = useCallback(() => {
    if (!activeTab) return
    const tabPre = openTabsRef.current.find((x) => x.path === activeTab)
    if (tabPre?.previewKind && tabPre.previewKind !== 'text') return
    clearTimeout(saveTimersRef.current[activeTab])
    delete saveTimersRef.current[activeTab]
    const tab = openTabsRef.current.find((x) => x.path === activeTab)
    if (!tab || tab.loading) return
    const text = latestDraftRef.current[activeTab] ?? tab.content
    if (text != null) void persistFileContent(activeTab, text)
  }, [activeTab, persistFileContent])

  useEffect(() => {
    const prev = prevActiveTabRef.current
    prevActiveTabRef.current = activeTab
    if (prev && prev !== activeTab) flushSaveForPath(prev)
  }, [activeTab, flushSaveForPath])

  const handleSearchPick = useCallback(
    (item) => {
      if (item.type === 'folder') loadDirectory(item.path)
      else openFile(item)
    },
    [loadDirectory, openFile]
  )

  const handleSearchError = useCallback(
    (msg) => {
      addToast(msg, 'error')
    },
    [addToast]
  )

  const handleAiOpenResult = useCallback(
    (item) => {
      const path = item?.path
      if (!path) return
      if (item.kind === 'folder') {
        loadDirectory(path)
        return
      }
      const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path
      void openFile({ path, name, type: 'file' })
    },
    [loadDirectory, openFile]
  )

  const closeTab = useCallback(
    (path, { skipSave = false } = {}) => {
      if (!skipSave) flushSaveForPath(path)
      else {
        clearTimeout(saveTimersRef.current[path])
        delete saveTimersRef.current[path]
      }
      delete latestDraftRef.current[path]
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path)
        const next = prev.filter((t) => t.path !== path)
        if (activeTab === path) {
          const fallback = next[idx] ?? next[idx - 1] ?? null
          setActiveTab(fallback?.path ?? null)
        }
        return next
      })
    },
    [activeTab, flushSaveForPath]
  )

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
      closeTab(file.path, { skipSave: true })
      if (currentPath) loadDirectory(currentPath)
    } catch {
      addToast('Network error during delete', 'error')
    }
  }, [addToast, closeTab, currentPath, loadDirectory])

  // --- Rename ---
  const renameFile = useCallback(async (file) => {
    const input = window.prompt('Rename to:', file.name)
    if (input == null) return
    const newName = input.trim()
    if (!newName || newName === file.name) return
    flushSaveForPath(file.path)
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: file.path, new_name: newName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const d = err.detail
        addToast(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg || x).join(' ') : 'Rename failed', 'error')
        return
      }
      const data = await res.json()
      const newPath = data.new_path
      if (newPath) {
        delete saveTimersRef.current[file.path]
        const draft = latestDraftRef.current[file.path]
        delete latestDraftRef.current[file.path]

        const oldKind = getPreviewKind(file.name)
        const newKind = getPreviewKind(newName)

        if (oldKind === 'text' && newKind === 'text') {
          if (draft !== undefined) latestDraftRef.current[newPath] = draft
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === file.path ? { ...t, path: newPath, name: newName, previewKind: 'text' } : t
            )
          )
        } else if (newKind === 'text') {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === file.path
                ? { ...t, path: newPath, name: newName, previewKind: 'text', content: null, loading: true }
                : t
            )
          )
          try {
            const readRes = await fetch(`/api/files/read?path=${encodeURIComponent(newPath)}`)
            if (readRes.ok) {
              const readData = await readRes.json()
              setOpenTabs((prev) =>
                prev.map((t) =>
                  t.path === newPath
                    ? { ...t, content: readData.content, loading: false, previewKind: 'text' }
                    : t
                )
              )
              latestDraftRef.current[newPath] = readData.content
            } else {
              setOpenTabs((prev) =>
                prev.map((t) => (t.path === newPath ? { ...t, loading: false, content: '' } : t))
              )
              latestDraftRef.current[newPath] = ''
            }
          } catch {
            setOpenTabs((prev) =>
              prev.map((t) => (t.path === newPath ? { ...t, loading: false, content: '' } : t))
            )
          }
        } else {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === file.path
                ? {
                    path: newPath,
                    name: newName,
                    previewKind: newKind,
                    content: null,
                    loading: false,
                  }
                : t
            )
          )
        }

        setActiveTab((prev) => (prev === file.path ? newPath : prev))
        setSelectedRow((prev) => (prev === file.path ? newPath : prev))
      }
      addToast(`Renamed to: ${newName}`, 'success')
      if (currentPath) loadDirectory(currentPath)
    } catch {
      addToast('Network error during rename', 'error')
    }
  }, [addToast, currentPath, loadDirectory, flushSaveForPath])

  const duplicateItem = useCallback(
    async (file) => {
      if (!file?.path) return
      try {
        const res = await fetch('/api/files/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          addToast(err.detail || 'Duplicate failed', 'error')
          return
        }
        const data = await res.json()
        addToast(`Duplicated: ${data.name}`, 'success')
        if (currentPath) await loadDirectory(currentPath)
        if (data.type === 'file') await openFile({ path: data.path, name: data.name, type: 'file' })
        else if (data.type === 'folder') loadDirectory(data.path)
      } catch {
        addToast('Network error', 'error')
      }
    },
    [addToast, currentPath, loadDirectory, openFile]
  )

  const handleContextCopyPath = useCallback(
    (ok) => {
      addToast(ok ? 'Path copied' : 'Could not copy path', ok ? 'success' : 'error')
    },
    [addToast]
  )

  // --- Context menu ---
  const openContextMenu = useCallback((e, file) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedRow(file.path)
    setContextMenu({ x: e.clientX, y: e.clientY, target: file })
  }, [])

  const openBackgroundContextMenu = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!currentPath) return
      const norm = currentPath.replace(/\\/g, '/').replace(/\/+$/, '') || '/'
      const parts = norm.split('/').filter(Boolean)
      const label = parts.length ? parts[parts.length - 1] : norm
      setSelectedRow(null)
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: { context: 'dir-background', path: currentPath, name: label },
      })
    },
    [currentPath]
  )

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const createFileInDirectory = useCallback(
    async (parentPath) => {
      if (!parentPath) return
      const defaultName = 'untitled.txt'
      const name = window.prompt('New file name:', defaultName)
      if (name == null) return
      const trimmed = name.trim()
      if (!trimmed) return
      if (trimmed.includes('/') || trimmed.includes('\\')) {
        addToast('Use a file name only (no slashes)', 'error')
        return
      }
      try {
        const res = await fetch('/api/files/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_path: parentPath, name: trimmed }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          addToast(err.detail || 'Could not create file', 'error')
          return
        }
        const data = await res.json()
        addToast(`Created ${data.name}`, 'success')
        if (currentPath) await loadDirectory(currentPath)
        await openFile({ path: data.path, name: data.name, type: 'file' })
      } catch {
        addToast('Network error', 'error')
      }
    },
    [addToast, currentPath, loadDirectory, openFile]
  )

  const pinItem = useCallback(
    async (file) => {
      try {
        const res = await fetch('/api/files/pinned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path, name: file.name }),
        })
        if (res.status === 409) {
          addToast('Already pinned', 'error')
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          addToast(err.detail || 'Could not pin', 'error')
          return
        }
        addToast(`Pinned: ${file.name}`, 'success')
        setPinRefreshToken((t) => t + 1)
      } catch {
        addToast('Network error', 'error')
      }
    },
    [addToast]
  )

  const unpinPath = useCallback(
    async (path, { showToast = false, displayName } = {}) => {
      try {
        const res = await fetch(`/api/files/pinned?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
        if (!res.ok) {
          addToast('Could not unpin', 'error')
          return
        }
        if (showToast && displayName) addToast(`Unpinned: ${displayName}`, 'success')
        setPinRefreshToken((t) => t + 1)
      } catch {
        addToast('Network error', 'error')
      }
    },
    [addToast]
  )

  const startPreviewResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = previewWidthDuringDrag.current
    document.body.classList.add('is-resizing-preview')

    function onMove(ev) {
      const dx = ev.clientX - startX
      const next = Math.min(900, Math.max(200, startW - dx))
      previewWidthDuringDrag.current = next
      setPreviewWidth(next)
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing-preview')
      localStorage.setItem('kv-preview-width', String(previewWidthDuringDrag.current))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const startSidebarResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = sidebarWidthDuringDrag.current
    document.body.classList.add('is-resizing-sidebar')

    function onMove(ev) {
      const dx = ev.clientX - startX
      const next = Math.min(520, Math.max(160, startW + dx))
      sidebarWidthDuringDrag.current = next
      setSidebarWidth(next)
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing-sidebar')
      localStorage.setItem('kv-sidebar-width', String(sidebarWidthDuringDrag.current))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const startCommandBarResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startH = commandBarHeightDuringDrag.current
    document.body.classList.add('is-resizing-commandbar')

    function onMove(ev) {
      const dy = ev.clientY - startY
      const maxH = Math.min(560, Math.floor(window.innerHeight * 0.65))
      const next = Math.min(maxH, Math.max(120, startH - dy))
      commandBarHeightDuringDrag.current = next
      setCommandBarHeight(next)
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing-commandbar')
      localStorage.setItem('kv-commandbar-height', String(commandBarHeightDuringDrag.current))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const openPinnedContextMenu = useCallback((e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedRow(null)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: {
        path: item.path,
        name: item.name,
        type: item.kind === 'file' ? 'file' : 'folder',
        pinnedSidebar: true,
      },
    })
  }, [])

  return (
    <div
      className="app"
      style={{ '--commandbar-height': `${commandBarHeight}px` }}
      onClick={closeContextMenu}
    >
      {!a11yPrefs.reduceMotion && (
        <Suspense fallback={null}>
          <NavigationAmbient theme={theme} motionEpoch={navMotionEpoch} />
        </Suspense>
      )}

      {/* Header */}
      <header className="app-header app-layer">
        <div className="app-header__logo" aria-label="The Kinetic Vault">
          <span className="app-header__logo-b">The</span>{' '}
          <span className="app-header__logo-r">Kinetic</span>{' '}
          <span className="app-header__logo-g">Vault</span>
        </div>
        <div className="app-header__search-wrap">
          <FileSearch
            root={currentPath || homePath || ''}
            rootLabel={currentPath ? 'current folder' : homePath ? 'home' : ''}
            onPick={handleSearchPick}
            onError={handleSearchError}
          />
        </div>
        <div className="app-header__actions">
          <button
            type="button"
            className="icon-btn"
            title="Settings"
            aria-label="Open settings"
            onClick={(e) => {
              e.stopPropagation()
              setHelpOpen(false)
              setSettingsOpen(true)
            }}
          >
            ⚙
          </button>
          <button
            type="button"
            className="icon-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={(e) => {
              e.stopPropagation()
              setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
            }}
          >
            {theme === 'dark' ? '◑' : '◐'}
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Help and FAQ"
            aria-label="Open help and FAQ"
            onClick={(e) => {
              e.stopPropagation()
              setSettingsOpen(false)
              setHelpOpen(true)
            }}
          >
            ?
          </button>
        </div>
      </header>

      {/* Three-panel body */}
      <div
        className={`main-area app-layer ${previewExpanded ? 'main-area--preview-expanded' : ''}`}
        style={{
          '--preview-width': `${previewWidth}px`,
          '--sidebar-width': `${sidebarWidth}px`,
        }}
      >
        <Sidebar
          onSelectFolder={loadDirectory}
          onOpenFile={openFile}
          currentPath={currentPath}
          pinRefreshToken={pinRefreshToken}
          onUnpinPath={(path) => unpinPath(path)}
          onPinnedContextMenu={openPinnedContextMenu}
        />
        <div
          className="panel-divider panel-divider--resizable"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={startSidebarResize}
        />
        <FileList
          files={files}
          loading={filesLoading}
          currentPath={currentPath}
          selectedRow={selectedRow}
          onSelectFile={openFile}
          onContextMenu={openContextMenu}
          onBackgroundContextMenu={openBackgroundContextMenu}
          onNavigate={loadDirectory}
        />
        <div
          className="panel-divider panel-divider--resizable panel-divider--before-preview"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panel"
          onMouseDown={startPreviewResize}
        />
        <FilePreview
          openTabs={openTabs}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          onTabClose={closeTab}
          previewExpanded={previewExpanded}
          onToggleExpand={() => setPreviewExpanded((v) => !v)}
          onActiveFileContentChange={updateActiveTabContent}
          onRequestSaveNow={saveActiveFileNow}
        />
      </div>

      <div className="app-stack-bottom">
        <div
          className="panel-divider panel-divider--resizable-horizontal"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize command bar height"
          onMouseDown={startCommandBarResize}
        />

        <CommandBar
          activeFile={openTabs.find((t) => t.path === activeTab) ?? null}
          currentPath={currentPath}
          onOpenAiResult={handleAiOpenResult}
        />
      </div>

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
          onPin={pinItem}
          onUnpin={(t) => unpinPath(t.path, { showToast: true, displayName: t.name })}
          onCreateFile={createFileInDirectory}
          onDuplicate={duplicateItem}
          onCopyPath={handleContextCopyPath}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onThemeChange={setTheme}
          prefs={a11yPrefs}
          onPrefsChange={setA11yPrefs}
        />
      )}

      {helpOpen && <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />}

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
