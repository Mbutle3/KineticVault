import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { prettifyAiText } from '../lib/prettifyAiText.js'
import { apiFetch, getKvApiToken, setKvApiToken } from '../lib/apiFetch.js'

const QUICK_ACTIONS = [
  'Find recent files',
  'Show largest files',
  'Summarize this file',
]

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Strip markdown-ish formatting for speech synthesis. */
function textForTts(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/^#{2,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[\t ]*[•\-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normLangTag(tag) {
  return (tag || '').toLowerCase().replace('_', '-')
}

/**
 * Pick the most natural-sounding voice the browser exposes (varies by OS).
 * Edge often lists "Microsoft … (Natural) …"; Chrome may list "Google …";
 * macOS can expose Siri / enhanced voices when the engine makes them available.
 */
function pickPreferredTtsVoice(speechSynthesis) {
  const list = speechSynthesis.getVoices()
  if (!list?.length) return null

  const want = normLangTag(navigator.language || 'en-US')
  const primary = want.split('-')[0] || 'en'

  const scoreVoice = (v) => {
    const lang = normLangTag(v.lang)
    const name = (v.name || '').toLowerCase()
    let s = 0
    if (lang === want) s += 120
    else if (lang.startsWith(`${primary}-`)) s += 100
    else if (lang.startsWith(primary)) s += 80

    if (/\b(natural|neural|enhanced|premium)\b/.test(name)) s += 60
    if (name.includes('microsoft') && (name.includes('online') || name.includes('natural'))) s += 45
    if (name.includes('google') && primary === 'en') s += 35
    if (name.includes('siri')) s += 28
    if (name.includes('compact') || name.includes('(compact)')) s -= 40

    return s
  }

  return list.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best))
}

/** Slightly slower than 1.0 — often sounds less robotic for explanatory text. */
const TTS_RATE = 0.93
const TTS_PITCH = 1

function ResultItem({ item, onOpenResult }) {
  if (item == null) return null
  if (typeof item === 'string') {
    return <li>{item}</li>
  }
  if (typeof item === 'object' && item.path) {
    return (
      <li>
        <button
          type="button"
          className="command-bar__result-link"
          onClick={() => onOpenResult?.(item)}
        >
          {item.text || item.path}
        </button>
      </li>
    )
  }
  return null
}

function AiFormattedText({ text }) {
  const lines = useMemo(() => prettifyAiText(text).split('\n'), [text])

  return (
    <div className="command-bar__ai-body">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd()
        if (!trimmed) {
          return <div key={i} className="command-bar__ai-gap" aria-hidden />
        }

        const hm = /^(#{2,3})\s+(.*)$/.exec(trimmed)
        if (hm) {
          const level = hm[1].length
          return (
            <div
              key={i}
              className={level >= 3 ? 'command-bar__ai-subhead' : 'command-bar__ai-heading'}
            >
              {hm[2].trim()}
            </div>
          )
        }

        if (/^(?:[•\-*]|\d+\.)\s/.test(trimmed)) {
          return (
            <div key={i} className="command-bar__ai-bullet">
              {trimmed}
            </div>
          )
        }

        return (
          <div key={i} className="command-bar__ai-line">
            {trimmed}
          </div>
        )
      })}
    </div>
  )
}

function MessageRow({ msg, onOpenResult, msgIndex, ttsSupported, ttsIndex, onToggleTts }) {
  const isAi = msg.role === 'ai' && Boolean(msg.text)
  const ttsActive = ttsIndex === msgIndex

  return (
    <div className={`command-bar__msg ${msg.role}`}>
      <span className="command-bar__msg-prefix">
        {msg.role === 'user' ? 'USER>' : msg.role === 'ai' ? 'KINETIC>' : '//'}
      </span>
      <span className="command-bar__msg-body">
        {msg.role === 'ai' && msg.text ? <AiFormattedText text={msg.text} /> : msg.text}
        {msg.result != null && (
          <div className="command-bar__msg-result">
            {Array.isArray(msg.result) ? (
              <ul>
                {msg.result.map((r, i) => (
                  <ResultItem key={i} item={r} onOpenResult={onOpenResult} />
                ))}
              </ul>
            ) : (
              <span>{String(msg.result)}</span>
            )}
          </div>
        )}
      </span>
      <span className="command-bar__msg-meta">
        <span className="command-bar__msg-time">{msg.time}</span>
        {isAi && ttsSupported && (
          <button
            type="button"
            className={`command-bar__tts-btn${ttsActive ? ' command-bar__tts-btn--active' : ''}`}
            onClick={() => onToggleTts(msgIndex, msg.text)}
            aria-label={ttsActive ? 'Stop reading aloud' : 'Read this reply aloud'}
          >
            {ttsActive ? 'Stop' : 'Read aloud'}
          </button>
        )}
      </span>
    </div>
  )
}

export default function CommandBar({ activeFile, currentPath, onOpenAiResult }) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([
    { role: 'system', text: 'Kinetic Vault AI ready. Type a command or pick a quick action.', time: timestamp() },
  ])
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [apiTokenSet, setApiTokenSet] = useState(() => Boolean(getKvApiToken()))
  /** Index of AI message currently selected for speech (or being read); toggles Stop on same index. */
  const [ttsIndex, setTtsIndex] = useState(null)
  const historyEndRef = useRef(null)
  /** Active recognition instance (new object each session — Chrome breaks if you reuse one). */
  const recognitionRef = useRef(null)
  /** Input value when the current listen session started. */
  const voiceBaseRef = useRef('')
  /** Finalized transcript chunks for this session (continuous mode). */
  const voiceFinalsRef = useRef('')
  /** Cached best voice after `voiceschanged` (Chrome loads voices asynchronously). */
  const ttsVoiceRef = useRef(null)
  /** OpenAI (or future) TTS audio element for Stop / cleanup. */
  const ttsAudioRef = useRef(null)
  const ttsAbortRef = useRef(null)

  const speechSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const browserTtsSupported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'

  /** From GET /api/ai/tts/status — enables OpenAI MP3 path when OPENAI_API_KEY is set. */
  const [ttsCloud, setTtsCloud] = useState(null)

  const ttsSupported = browserTtsSupported || Boolean(ttsCloud?.enabled)

  const stopAllPlayback = useCallback(() => {
    window.speechSynthesis?.cancel()
    try {
      ttsAbortRef.current?.abort()
    } catch {
      /* ignore */
    }
    ttsAbortRef.current = null
    const a = ttsAudioRef.current
    if (a) {
      a.pause()
      const src = a.src
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src)
      a.removeAttribute('src')
      ttsAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/ai/tts/status')
      .then(async (r) => {
        if (!r.ok) return { enabled: false, provider: null }
        try {
          return await r.json()
        } catch {
          return { enabled: false, provider: null }
        }
      })
      .then((data) => {
        if (cancelled) return
        setTtsCloud({
          enabled: Boolean(data?.enabled),
          provider: data?.provider ?? null,
        })
      })
      .catch(() => {
        if (!cancelled) setTtsCloud({ enabled: false, provider: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleTts = useCallback(
    (idx, text) => {
      const syn = window.speechSynthesis
      if (!text) return

      if (ttsIndex === idx) {
        stopAllPlayback()
        setTtsIndex(null)
        return
      }

      stopAllPlayback()

      const plain = textForTts(text)
      if (!plain) {
        setTtsIndex(null)
        return
      }

      const lang = (navigator.language || 'en-US').replace(/_/g, '-')

      const startBrowserSpeak = (voice) => {
        if (!syn) {
          setTtsIndex(null)
          return
        }
        const u = new SpeechSynthesisUtterance(plain)
        u.lang = voice?.lang || lang
        if (voice) u.voice = voice
        u.rate = TTS_RATE
        u.pitch = TTS_PITCH
        u.onend = () => setTtsIndex(null)
        u.onerror = () => setTtsIndex(null)
        syn.speak(u)
      }

      setTtsIndex(idx)

      const tryCloud = async () => {
        // Skip only when status explicitly said cloud is off. While `null` (still loading)
        // or `true`, attempt POST so we don't fall back to browser TTS before status arrives.
        if (ttsCloud?.enabled === false) return false
        const ac = new AbortController()
        ttsAbortRef.current = ac
        let objectUrl = null
        const cleanupUrl = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl)
            objectUrl = null
          }
        }
        try {
          const res = await apiFetch('/api/ai/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: plain }),
            signal: ac.signal,
          })
          if (ac.signal.aborted) {
            ttsAbortRef.current = null
            return true
          }
          if (!res.ok) {
            ttsAbortRef.current = null
            return false
          }
          const blob = await res.blob()
          if (ac.signal.aborted) {
            ttsAbortRef.current = null
            return true
          }
          objectUrl = URL.createObjectURL(blob)
          ttsAbortRef.current = null
          const audio = new Audio(objectUrl)
          ttsAudioRef.current = audio
          audio.onended = () => {
            cleanupUrl()
            if (ttsAudioRef.current === audio) ttsAudioRef.current = null
            setTtsIndex(null)
          }
          audio.onerror = () => {
            cleanupUrl()
            if (ttsAudioRef.current === audio) ttsAudioRef.current = null
            setTtsIndex(null)
          }
          await audio.play()
          return true
        } catch (e) {
          cleanupUrl()
          ttsAbortRef.current = null
          if (e?.name === 'AbortError') return true
          return false
        }
      }

      const run = async () => {
        if (await tryCloud()) return

        if (!syn) {
          setTtsIndex(null)
          return
        }

        const voice = ttsVoiceRef.current ?? pickPreferredTtsVoice(syn)
        if (voice && !ttsVoiceRef.current) ttsVoiceRef.current = voice

        if (syn.getVoices().length === 0) {
          let done = false
          const finish = (v) => {
            if (done) return
            done = true
            syn.removeEventListener('voiceschanged', onVoices)
            if (v) ttsVoiceRef.current = v
            startBrowserSpeak(v ?? ttsVoiceRef.current)
          }
          const onVoices = () => finish(pickPreferredTtsVoice(syn))
          syn.addEventListener('voiceschanged', onVoices)
          syn.getVoices()
          window.setTimeout(() => {
            if (!done && !syn.speaking) finish(ttsVoiceRef.current)
          }, 2800)
          return
        }

        startBrowserSpeak(voice)
      }

      void run()
    },
    [ttsIndex, ttsCloud, stopAllPlayback],
  )

  useEffect(() => {
    const syn = window.speechSynthesis
    if (!syn) return undefined

    const refreshPreferredVoice = () => {
      const v = pickPreferredTtsVoice(syn)
      if (v) ttsVoiceRef.current = v
    }

    refreshPreferredVoice()
    syn.addEventListener('voiceschanged', refreshPreferredVoice)
    syn.getVoices()

    return () => syn.removeEventListener('voiceschanged', refreshPreferredVoice)
  }, [])

  useEffect(() => {
    return () => stopAllPlayback()
  }, [stopAllPlayback])

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const stopVoiceRecognition = useCallback(() => {
    const r = recognitionRef.current
    recognitionRef.current = null
    if (r) {
      try {
        r.stop()
      } catch {
        try {
          r.abort()
        } catch {
          /* ignore */
        }
      }
    }
    setListening(false)
  }, [])

  const pushVoiceError = useCallback((err) => {
    const messages = {
      'not-allowed':
        'Microphone blocked. Allow microphone access for this site (browser address bar or site settings).',
      'no-speech': 'No speech detected. Try again, speak closer to the mic, or wait a second after clicking the mic.',
      'audio-capture': 'No microphone found or it is already in use by another app.',
      network:
        'Speech recognition needs a network connection (the browser sends audio to a recognition service).',
      aborted: '',
      'service-not-allowed': 'Speech recognition is not allowed for this page (try https or localhost).',
    }
    const msg = messages[err] ?? (err ? `Voice error: ${err}` : '')
    if (msg) {
      setHistory((prev) => [...prev, { role: 'system', text: msg, time: timestamp() }])
    }
  }, [])

  const startVoiceRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'system',
          text: 'Voice input is not supported in this browser (try Chrome or Edge).',
          time: timestamp(),
        },
      ])
      return
    }

    if (recognitionRef.current) {
      stopVoiceRecognition()
    }

    voiceBaseRef.current = input
    voiceFinalsRef.current = ''
    const r = new SR()
    recognitionRef.current = r

    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.lang = (navigator.language || 'en-US').replace(/_/g, '-')

    r.onresult = (event) => {
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const piece = res[0]?.transcript ?? ''
        if (res.isFinal) {
          voiceFinalsRef.current = `${voiceFinalsRef.current} ${piece}`.trim()
        } else {
          interimChunk += piece
        }
      }
      const base = voiceBaseRef.current.trimEnd()
      const fin = voiceFinalsRef.current.trim()
      const inter = interimChunk.trim()
      const parts = []
      if (base) parts.push(base)
      if (fin) parts.push(fin)
      if (inter) parts.push(inter)
      setInput(parts.join(' '))
    }

    r.onerror = (event) => {
      pushVoiceError(event.error)
      recognitionRef.current = null
      setListening(false)
    }

    r.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    try {
      setListening(true)
      r.start()
    } catch (e) {
      recognitionRef.current = null
      setListening(false)
      const message = e?.message || String(e)
      setHistory((prev) => [
        ...prev,
        {
          role: 'system',
          text:
            message.includes('already started') || message.includes('InvalidState')
              ? 'Voice session conflict — try the mic button again.'
              : `Could not start voice: ${message}. Check microphone permission.`,
          time: timestamp(),
        },
      ])
    }
  }, [input, pushVoiceError, stopVoiceRecognition])

  useEffect(() => {
    return () => {
      const r = recognitionRef.current
      recognitionRef.current = null
      if (r) {
        try {
          r.abort()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  const toggleMic = useCallback(() => {
    if (listening) {
      stopVoiceRecognition()
      return
    }
    startVoiceRecognition()
  }, [listening, startVoiceRecognition, stopVoiceRecognition])

  const handleOpenResult = useCallback(
    (item) => {
      if (!item?.path || !onOpenAiResult) return
      onOpenAiResult(item)
    },
    [onOpenAiResult]
  )

  const configureApiToken = useCallback(() => {
    const current = getKvApiToken()
    const next = window.prompt(
      'Optional API token for KV_API_TOKEN (sent as x-kv-token). Leave blank to clear.',
      current || ''
    )
    if (next == null) return
    setKvApiToken(next)
    setApiTokenSet(Boolean(getKvApiToken()))
    setHistory((prev) => [
      ...prev,
      {
        role: 'system',
        text: getKvApiToken()
          ? 'API token set for this browser (kv-api-token).'
          : 'API token cleared for this browser.',
        time: timestamp(),
      },
    ])
  }, [])

  async function sendCommand(command) {
    if (!command.trim() || loading) return

    const userMsg = { role: 'user', text: command, time: timestamp() }
    setHistory((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: activeFile ? `Current file: ${activeFile.name}` : null,
          current_folder: currentPath || null,
          active_file_path: activeFile?.path ?? null,
        }),
      })
      let data = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }
      if (!res.ok) {
        const detail = data.detail
        const msg =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((x) => x.msg || x).join(' ')
              : `Request failed (${res.status})`
        setHistory((prev) => [...prev, { role: 'system', text: msg, time: timestamp() }])
        return
      }
      const aiMsg = {
        role: 'ai',
        text: data.message ?? '(no message)',
        result: data.result ?? null,
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
        <button
          type="button"
          className="command-bar__pill"
          style={{ marginLeft: 'auto' }}
          title="Set API token header (KV_API_TOKEN)"
          onClick={configureApiToken}
          disabled={loading}
        >
          Token: {apiTokenSet ? 'on' : 'off'}
        </button>
        {activeFile && (
          <span style={{ marginLeft: 10, fontSize: 10, color: 'var(--text-muted)' }}>
            ctx: {activeFile.name}
          </span>
        )}
      </div>

      <div className="command-bar__history">
        {history.map((msg, i) => (
          <MessageRow
            key={i}
            msg={msg}
            msgIndex={i}
            onOpenResult={handleOpenResult}
            ttsSupported={ttsSupported}
            ttsIndex={ttsIndex}
            onToggleTts={toggleTts}
          />
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
            type="button"
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
        <button
          type="button"
          className={`command-bar__mic-btn${listening ? ' command-bar__mic-btn--listening' : ''}`}
          title={speechSupported ? (listening ? 'Stop listening' : 'Voice input') : 'Voice input not available'}
          onClick={toggleMic}
          disabled={loading || !speechSupported}
        >
          🎤
        </button>
        <button
          type="button"
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
