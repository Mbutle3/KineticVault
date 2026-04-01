import { useState, useRef, useEffect } from 'react'

const QUICK_ACTIONS = [
  'Find recent files',
  'Show largest files',
  'Summarize this file',
]

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function MessageRow({ msg }) {
  return (
    <div className={`command-bar__msg ${msg.role}`}>
      <span className="command-bar__msg-prefix">
        {msg.role === 'user' ? 'USER>' : msg.role === 'ai' ? 'KINETIC>' : '//'}
      </span>
      <span className="command-bar__msg-body">
        {msg.text}
        {msg.result && (
          <div className="command-bar__msg-result">
            {Array.isArray(msg.result) ? (
              <ul>{msg.result.map((r, i) => <li key={i}>{r}</li>)}</ul>
            ) : (
              <span>{msg.result}</span>
            )}
          </div>
        )}
      </span>
      <span className="command-bar__msg-time">{msg.time}</span>
    </div>
  )
}

export default function CommandBar({ activeFile }) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([
    { role: 'system', text: 'Kinetic Vault AI ready. Type a command or pick a quick action.', time: timestamp() },
  ])
  const [loading, setLoading] = useState(false)
  const historyEndRef = useRef(null)

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function sendCommand(command) {
    if (!command.trim() || loading) return

    const userMsg = { role: 'user', text: command, time: timestamp() }
    setHistory((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: activeFile ? `Current file: ${activeFile.name}` : null,
        }),
      })
      const data = await res.json()
      const aiMsg = {
        role: 'ai',
        text: data.message,
        result: data.result,
        time: timestamp(),
      }
      setHistory((prev) => [...prev, aiMsg])
    } catch {
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: 'Network error — could not reach the AI service.', time: timestamp() },
      ])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendCommand(input)
    }
  }

  return (
    <div className="command-bar">
      <div className="command-bar__header">
        <div className="command-bar__status" />
        <span className="command-bar__header-label">AI Command Interface</span>
        {activeFile && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
            ctx: {activeFile.name}
          </span>
        )}
      </div>

      <div className="command-bar__history">
        {history.map((msg, i) => (
          <MessageRow key={i} msg={msg} />
        ))}
        {loading && (
          <div className="command-bar__msg ai">
            <span className="command-bar__msg-prefix">KINETIC&gt;</span>
            <span className="command-bar__msg-body" style={{ color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
              {' '}thinking…
            </span>
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      <div className="command-bar__pills">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            className="command-bar__pill"
            onClick={() => sendCommand(action.toLowerCase())}
            disabled={loading}
          >
            {action}
          </button>
        ))}
      </div>

      <div className="command-bar__input-row">
        <span className="command-bar__prompt">$</span>
        <input
          className="command-bar__input"
          type="text"
          placeholder="Enter a command…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="command-bar__mic-btn" title="Voice input (coming soon)" disabled>
          🎤
        </button>
        <button
          className="command-bar__send-btn"
          onClick={() => sendCommand(input)}
          disabled={loading || !input.trim()}
        >
          RUN
        </button>
      </div>
    </div>
  )
}
