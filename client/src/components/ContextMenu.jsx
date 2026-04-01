import { useEffect, useRef } from 'react'

const MENU_ITEMS = [
  { id: 'open',      label: 'Open',      icon: '↗' },
  { id: 'edit',      label: 'Edit',      icon: '✎' },
  { id: 'rename',    label: 'Rename',    icon: '✏' },
  { id: 'copy-path', label: 'Copy Path', icon: '⎘' },
  { id: 'duplicate', label: 'Duplicate', icon: '⧉', disabled: true },
  { id: 'divider' },
  { id: 'delete',    label: 'Delete',    icon: '⊗', danger: true },
]

export default function ContextMenu({ x, y, target, onClose, onOpen, onRename, onDelete }) {
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
        navigator.clipboard.writeText(target.path).catch(() => {})
        break
      case 'delete':
        if (window.confirm(`Delete "${target.name}"? This cannot be undone.`)) {
          onDelete(target)
        }
        break
      default:
        break
    }
    onClose()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: safeY, left: safeX }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File name header */}
      <div style={{ padding: '5px 14px 6px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {target.type === 'folder' ? '📁' : '📄'}{' '}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {target.name}
        </span>
      </div>

      {MENU_ITEMS.map((item, i) => {
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
