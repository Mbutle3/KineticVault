import { useEffect, useRef, useMemo } from 'react'

const MENU_ITEMS_FILE = [
  { id: 'open',      label: 'Open',      icon: '↗' },
  { id: 'edit',      label: 'Edit',      icon: '✎' },
  { id: 'rename',    label: 'Rename',    icon: '✏' },
  { id: 'copy-path', label: 'Copy Path', icon: '⎘' },
  { id: 'pin',       label: 'Pin to sidebar', icon: '★' },
  { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
  { id: 'divider' },
  { id: 'delete',    label: 'Delete',    icon: '⊗', danger: true },
]

const MENU_ITEMS_FOLDER = [
  { id: 'open',      label: 'Open',      icon: '↗' },
  { id: 'new-file',  label: 'New file inside…', icon: '+' },
  { id: 'edit',      label: 'Edit',      icon: '✎' },
  { id: 'rename',    label: 'Rename',    icon: '✏' },
  { id: 'copy-path', label: 'Copy Path', icon: '⎘' },
  { id: 'pin',       label: 'Pin to sidebar', icon: '★' },
  { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
  { id: 'divider' },
  { id: 'delete',    label: 'Delete',    icon: '⊗', danger: true },
]

const MENU_ITEMS_DIR_BACKGROUND = [
  { id: 'new-file', label: 'New file…', icon: '+' },
]

const PINNED_MENU_ITEMS = [
  { id: 'open',      label: 'Open',      icon: '↗' },
  { id: 'copy-path', label: 'Copy Path', icon: '⎘' },
  { id: 'divider' },
  { id: 'unpin',     label: 'Unpin from sidebar', icon: '☆' },
]

function menuItemsForTarget(target) {
  if (target.pinnedSidebar) return PINNED_MENU_ITEMS
  if (target.context === 'dir-background') return MENU_ITEMS_DIR_BACKGROUND
  if (target.type === 'folder') return MENU_ITEMS_FOLDER
  return MENU_ITEMS_FILE
}

export default function ContextMenu({
  x,
  y,
  target,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onPin,
  onUnpin,
  onCreateFile,
  onDuplicate,
  onCopyPath,
}) {
  const ref = useRef(null)

  // Adjust position so menu stays within viewport
  const safeX = Math.min(x, window.innerWidth  - 180)
  const safeY = Math.min(y, window.innerHeight - 240)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleItem(e, item) {
    e.stopPropagation()
    if (item.disabled) return
    switch (item.id) {
      case 'open':
        onOpen(target)
        break
      case 'edit':
        onOpen(target)
        break
      case 'rename':
        onRename(target)
        break
      case 'copy-path':
        navigator.clipboard
          .writeText(target.path)
          .then(() => onCopyPath?.(true))
          .catch(() => onCopyPath?.(false))
        break
      case 'pin':
        onPin?.(target)
        break
      case 'unpin':
        onUnpin?.(target)
        break
      case 'delete':
        if (window.confirm(`Delete "${target.name}"? This cannot be undone.`)) {
          onDelete(target)
        }
        break
      case 'new-file': {
        const dir =
          target.context === 'dir-background' ? target.path : target.type === 'folder' ? target.path : null
        if (dir) onCreateFile?.(dir)
        break
      }
      case 'duplicate':
        onDuplicate?.(target)
        break
      default:
        break
    }
    onClose()
  }

  const menuItems = useMemo(() => menuItemsForTarget(target), [target])

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: safeY, left: safeX }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File name header */}
      <div style={{ padding: '5px 14px 6px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        {target.pinnedSidebar && (
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Pinned
          </div>
        )}
        {target.context === 'dir-background' && (
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Current folder
          </div>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {target.context === 'dir-background' ? '📂' : target.type === 'folder' ? '📁' : '📄'}{' '}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {target.name}
        </span>
      </div>

      {menuItems.map((item, i) => {
        if (item.id === 'divider') {
          return <div key={i} className="context-menu__divider" />
        }
        return (
          <button
            key={item.id}
            className={`context-menu__item ${item.danger ? 'danger' : ''}`}
            style={item.disabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
            onClick={(e) => handleItem(e, item)}
          >
            <span className="context-menu__icon">{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
