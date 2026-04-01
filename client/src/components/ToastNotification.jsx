import { useEffect, useState } from 'react'

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

export default function ToastNotification({ message, type = 'success', onDismiss }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      // Give the fade-out animation time to play before removing from DOM
      setTimeout(onDismiss, 200)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`toast ${type}`}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }}
    >
      <span className="toast__icon">{ICONS[type] ?? ICONS.info}</span>
      <span className="toast__message">{message}</span>
      <button
        className="toast__close"
        onClick={() => { setVisible(false); setTimeout(onDismiss, 200) }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
