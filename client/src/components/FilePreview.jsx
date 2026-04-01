import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Map file extension → Prism language id
function detectLanguage(filename) {
  const ext = (filename ?? '').split('.').pop().toLowerCase()
  const map = {
    js: 'javascript', jsx: 'jsx',
    ts: 'typescript', tsx: 'tsx',
    py: 'python',
    json: 'json', jsonc: 'json',
    md: 'markdown',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', sass: 'scss',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c', cpp: 'cpp', h: 'cpp',
    rb: 'ruby',
    php: 'php',
    xml: 'xml',
    env: 'bash',
  }
  return map[ext] ?? null
}

// Override syntax highlighter colours to match KV green accent palette
const kvStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: 'var(--bg-surface)',
    margin: 0,
    padding: '14px',
    fontSize: '12px',
    lineHeight: '1.65',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'none',
    textShadow: 'none',
  },
  // Tint keywords & punctuation with the accent green
  keyword:   { color: '#00ff88' },
  builtin:   { color: '#00cc6a' },
  function:  { color: '#7effc4' },
  'class-name': { color: '#7effc4' },
  string:    { color: '#a8ff9e' },
  number:    { color: '#6bffb0' },
  boolean:   { color: '#00ff88' },
  comment:   { color: '#3d3d3d', fontStyle: 'italic' },
  operator:  { color: '#aaaaaa' },
  punctuation: { color: '#555555' },
}

function TabBar({ openTabs, activeTab, onTabSelect, onTabClose }) {
  return (
    <div className="file-preview__tabs">
      {openTabs.map((tab) => (
        <button
          key={tab.path}
          className={`file-preview__tab ${activeTab === tab.path ? 'active' : ''}`}
          onClick={() => onTabSelect(tab.path)}
          title={tab.path}
        >
          <span>{tab.name}</span>
          {tab.loading && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
          <span
            className="file-preview__tab-close"
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.path) }}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  )
}

export default function FilePreview({ openTabs, activeTab, onTabSelect, onTabClose }) {
  const current = openTabs.find((t) => t.path === activeTab) ?? null
  const lang = current ? detectLanguage(current.name) : null

  return (
    <div className="file-preview">
      {openTabs.length > 0 && (
        <TabBar
          openTabs={openTabs}
          activeTab={activeTab}
          onTabSelect={onTabSelect}
          onTabClose={onTabClose}
        />
      )}

      {!current ? (
        <div className="file-preview__empty">
          <span className="file-preview__empty-icon">◈</span>
          <span>No file open</span>
          <span className="file-preview__empty-hint">Click a file in the list to preview it</span>
        </div>
      ) : current.loading ? (
        <div className="file-preview__empty">
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Loading…</span>
        </div>
      ) : (
        <div className="file-preview__content">
          {lang ? (
            <SyntaxHighlighter
              language={lang}
              style={kvStyle}
              showLineNumbers
              lineNumberStyle={{ color: '#2e2e2e', minWidth: '2.5em', userSelect: 'none' }}
              wrapLongLines={false}
            >
              {current.content ?? ''}
            </SyntaxHighlighter>
          ) : (
            <pre className="file-preview__plain">{current.content ?? ''}</pre>
          )}
        </div>
      )}
    </div>
  )
}
