function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function text(data, { status = 200, headers = {} } = {}) {
  return new Response(data, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  })
}

function err(detail, { status = 400 } = {}) {
  return json({ detail }, { status })
}

function normalizePath(p) {
  const s = String(p || '').replace(/\\/g, '/')
  const cleaned = s.replace(/\/+/g, '/')
  if (!cleaned) return '/'
  if (cleaned.length > 1 && cleaned.endsWith('/')) return cleaned.slice(0, -1)
  return cleaned
}

function baseName(p) {
  const n = normalizePath(p)
  if (n === '/') return '/'
  const parts = n.split('/').filter(Boolean)
  return parts[parts.length - 1] || n
}

function dirName(p) {
  const n = normalizePath(p)
  if (n === '/') return '/'
  const parts = n.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

function joinPath(parent, name) {
  const p = normalizePath(parent)
  if (p === '/') return '/' + name
  return p + '/' + name
}

function nowIso() {
  return new Date().toISOString()
}

// In-memory mock filesystem (browser-only).
const state = {
  pinned: [],
  nodes: /** @type {Record<string, any>} */ ({}),
}

function ensureDemoFs() {
  if (state.nodes['/']) return

  // folders
  state.nodes['/'] = { type: 'folder', name: '/', children: [] }
  state.nodes['/demo'] = { type: 'folder', name: 'demo', children: [] }
  state.nodes['/demo/docs'] = { type: 'folder', name: 'docs', children: [] }
  state.nodes['/demo/src'] = { type: 'folder', name: 'src', children: [] }
  state.nodes['/demo/media'] = { type: 'folder', name: 'media', children: [] }
  state.nodes['/demo/trash'] = { type: 'folder', name: 'trash', children: [] }

  // files
  const readmePath = '/demo/README.txt'
  state.nodes[readmePath] = {
    type: 'file',
    name: 'README.txt',
    content:
      'Kinetic Vault — MOCK MODE\\n\\n- No filesystem access\\n- No network calls to a local API\\n\\nTry: open, edit, rename, duplicate, delete, pin, search.\\n',
    mtime: nowIso(),
    size: 0,
  }

  const notePath = '/demo/docs/notes.md'
  state.nodes[notePath] = {
    type: 'file',
    name: 'notes.md',
    content:
      '## Demo notes (mock data)\\n\\nThis is in-memory content. Saving updates only this browser tab.\\n',
    mtime: nowIso(),
    size: 0,
  }

  const appPath = '/demo/src/app.js'
  state.nodes[appPath] = {
    type: 'file',
    name: 'app.js',
    content: "export function hello() { return 'hello from mock mode' }\\n",
    mtime: nowIso(),
    size: 0,
  }

  // wire children
  state.nodes['/'].children = ['/demo']
  state.nodes['/demo'].children = ['/demo/README.txt', '/demo/docs', '/demo/src', '/demo/media', '/demo/trash']
  state.nodes['/demo/docs'].children = ['/demo/docs/notes.md']
  state.nodes['/demo/src'].children = ['/demo/src/app.js']
  state.nodes['/demo/media'].children = []
  state.nodes['/demo/trash'].children = []

  // update sizes
  for (const [p, n] of Object.entries(state.nodes)) {
    if (n.type === 'file') n.size = (n.content || '').length
  }
}

function listDir(path) {
  ensureDemoFs()
  const p = normalizePath(path)
  const node = state.nodes[p]
  if (!node || node.type !== 'folder') return null
  const kids = node.children || []
  return kids
    .map((kp) => {
      const kn = state.nodes[kp]
      if (!kn) return null
      return {
        name: kn.name,
        path: kp,
        type: kn.type === 'folder' ? 'folder' : 'file',
        size: kn.type === 'file' ? kn.size : 0,
        modified: kn.mtime || nowIso(),
      }
    })
    .filter(Boolean)
}

function findByNameSubstring(root, q, limit = 150) {
  ensureDemoFs()
  const rootN = normalizePath(root || '/')
  const query = (q || '').toLowerCase()
  const out = []
  for (const [p, n] of Object.entries(state.nodes)) {
    if (!p.startsWith(rootN === '/' ? '/' : rootN + '/')) continue
    if (n.name.toLowerCase().includes(query)) {
      out.push({
        name: n.name,
        path: p,
        type: n.type === 'folder' ? 'folder' : 'file',
        size: n.type === 'file' ? n.size : 0,
        modified: n.mtime || nowIso(),
      })
    }
    if (out.length >= limit) break
  }
  return out
}

function renameNode(oldPath, newName) {
  ensureDemoFs()
  const op = normalizePath(oldPath)
  const node = state.nodes[op]
  if (!node) return null
  if (!newName || /[\\/]/.test(newName)) return { error: 'Use a file name only (no slashes).' }
  const parent = dirName(op)
  const np = joinPath(parent, newName)
  if (state.nodes[np]) return { error: 'A file/folder with that name already exists.' }

  // Only rename the node itself for demo simplicity (no deep folder rename).
  // If it is a folder, keep its children paths unchanged and disallow rename.
  if (node.type === 'folder') return { error: 'Mock mode: renaming folders is disabled.' }

  state.nodes[np] = { ...node, name: newName }
  delete state.nodes[op]

  // update parent children
  const parentNode = state.nodes[parent]
  if (parentNode?.type === 'folder') {
    parentNode.children = (parentNode.children || []).map((c) => (c === op ? np : c))
  }

  // update pins
  state.pinned = state.pinned.map((x) => (x.path === op ? { ...x, path: np, name: newName } : x))

  return { new_path: np }
}

function deleteNode(path) {
  ensureDemoFs()
  const p = normalizePath(path)
  const node = state.nodes[p]
  if (!node) return { ok: false, error: 'Not found' }
  if (p === '/' || p === '/demo') return { ok: false, error: 'Mock mode: protected path.' }
  if (node.type === 'folder') return { ok: false, error: 'Mock mode: deleting folders is disabled.' }

  const parent = dirName(p)
  const parentNode = state.nodes[parent]
  if (parentNode?.type === 'folder') {
    parentNode.children = (parentNode.children || []).filter((c) => c !== p)
  }
  delete state.nodes[p]
  state.pinned = state.pinned.filter((x) => x.path !== p)
  return { ok: true }
}

function duplicateNode(path) {
  ensureDemoFs()
  const p = normalizePath(path)
  const node = state.nodes[p]
  if (!node) return { ok: false, error: 'Not found' }
  if (node.type !== 'file') return { ok: false, error: 'Mock mode: only files can be duplicated.' }
  const parent = dirName(p)
  const base = baseName(p)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''

  let i = 1
  let name = `${stem} copy${ext}`
  let np = joinPath(parent, name)
  while (state.nodes[np]) {
    i += 1
    name = `${stem} copy ${i}${ext}`
    np = joinPath(parent, name)
  }

  state.nodes[np] = {
    ...node,
    name,
    mtime: nowIso(),
  }
  state.nodes[np].size = (state.nodes[np].content || '').length
  const parentNode = state.nodes[parent]
  if (parentNode?.type === 'folder') parentNode.children = [...(parentNode.children || []), np]

  return { ok: true, data: { path: np, name, type: 'file' } }
}

function createFile(parentPath, name) {
  ensureDemoFs()
  const parent = normalizePath(parentPath)
  const parentNode = state.nodes[parent]
  if (!parentNode || parentNode.type !== 'folder') return { ok: false, error: 'Parent folder not found.' }
  if (!name || /[\\/]/.test(name)) return { ok: false, error: 'Use a file name only (no slashes).' }
  const p = joinPath(parent, name)
  if (state.nodes[p]) return { ok: false, error: 'Already exists.' }

  state.nodes[p] = { type: 'file', name, content: '', mtime: nowIso(), size: 0 }
  parentNode.children = [...(parentNode.children || []), p]
  return { ok: true, data: { path: p, name, type: 'file' } }
}

function writeFile(path, content) {
  ensureDemoFs()
  const p = normalizePath(path)
  const node = state.nodes[p]
  if (!node || node.type !== 'file') return { ok: false, error: 'Not a file.' }
  node.content = String(content ?? '')
  node.mtime = nowIso()
  node.size = node.content.length
  return { ok: true }
}

function pin(path, name) {
  ensureDemoFs()
  const p = normalizePath(path)
  const node = state.nodes[p]
  if (!node) return { ok: false, status: 404, error: 'Not found' }
  if (state.pinned.some((x) => x.path === p)) return { ok: false, status: 409, error: 'Already pinned' }
  state.pinned.push({
    path: p,
    name: name || node.name,
    kind: node.type === 'folder' ? 'folder' : 'file',
  })
  return { ok: true }
}

function unpin(path) {
  ensureDemoFs()
  const p = normalizePath(path)
  const before = state.pinned.length
  state.pinned = state.pinned.filter((x) => x.path !== p)
  return { ok: state.pinned.length !== before }
}

function mockHomePayload() {
  ensureDemoFs()
  return {
    home: '/demo',
    documents: '/demo/docs',
    media: '/demo/media',
    system: null,
    trash: '/demo/trash',
    projects: [
      {
        name: 'KineticVault (mock)',
        path: '/demo',
        expanded: true,
        children: [
          { name: 'docs', path: '/demo/docs' },
          { name: 'src', path: '/demo/src' },
        ],
      },
    ],
    pinned: state.pinned,
  }
}

async function readJsonBody(init) {
  const body = init?.body
  if (body == null) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }
  // Request objects / streams not supported in mock mode; keep it simple.
  return null
}

export async function mockFetch(input, init = {}) {
  ensureDemoFs()

  const url = new URL(typeof input === 'string' ? input : String(input?.url || input), window.location.origin)
  const path = url.pathname
  const method = (init.method || 'GET').toUpperCase()

  // Non-API requests should go to the network (Vite, assets, etc.)
  if (!path.startsWith('/api/')) return fetch(input, init)

  // --- Files ---
  if (path === '/api/files/home' && method === 'GET') return json(mockHomePayload())

  if (path === '/api/files/pinned' && method === 'GET') return json(state.pinned)
  if (path === '/api/files/pinned' && method === 'POST') {
    const b = await readJsonBody(init)
    const res = pin(b?.path, b?.name)
    if (!res.ok) return err(res.error, { status: res.status || 400 })
    return json({ ok: true })
  }
  if (path === '/api/files/pinned' && method === 'DELETE') {
    const p = url.searchParams.get('path')
    if (!p) return err('Missing path', { status: 422 })
    unpin(p)
    return json({ ok: true })
  }

  if (path === '/api/files' && method === 'GET') {
    const p = url.searchParams.get('path')
    if (!p) return err('Missing path', { status: 422 })
    const items = listDir(p)
    if (!items) return err('Not a folder', { status: 400 })
    return json(items)
  }

  if (path === '/api/files' && method === 'DELETE') {
    const p = url.searchParams.get('path')
    if (!p) return err('Missing path', { status: 422 })
    const r = deleteNode(p)
    if (!r.ok) return err(r.error || 'Delete failed', { status: 400 })
    return json({ ok: true })
  }

  if (path === '/api/files/read' && method === 'GET') {
    const p = url.searchParams.get('path')
    if (!p) return err('Missing path', { status: 422 })
    const node = state.nodes[normalizePath(p)]
    if (!node || node.type !== 'file') return err('Not found', { status: 404 })
    return json({ content: node.content || '' })
  }

  if (path === '/api/files/write' && method === 'POST') {
    const b = await readJsonBody(init)
    const r = writeFile(b?.path, b?.content)
    if (!r.ok) return err(r.error || 'Write failed', { status: 400 })
    return json({ ok: true })
  }

  if (path === '/api/files/rename' && method === 'POST') {
    const b = await readJsonBody(init)
    const r = renameNode(b?.old_path, b?.new_name)
    if (!r) return err('Not found', { status: 404 })
    if (r.error) return err(r.error, { status: 400 })
    return json(r)
  }

  if (path === '/api/files/duplicate' && method === 'POST') {
    const b = await readJsonBody(init)
    const r = duplicateNode(b?.path)
    if (!r.ok) return err(r.error || 'Duplicate failed', { status: 400 })
    return json(r.data)
  }

  if (path === '/api/files/create' && method === 'POST') {
    const b = await readJsonBody(init)
    const r = createFile(b?.parent_path, b?.name)
    if (!r.ok) return err(r.error || 'Create failed', { status: 400 })
    return json(r.data)
  }

  if (path === '/api/files/search' && method === 'GET') {
    const q = url.searchParams.get('q') || ''
    const root = url.searchParams.get('root') || '/demo'
    const limit = Math.max(1, Math.min(2000, parseInt(url.searchParams.get('limit') || '150', 10) || 150))
    if (!q.trim()) return json([])
    return json(findByNameSubstring(root, q, limit))
  }

  // --- AI ---
  if (path === '/api/ai/tts/status' && method === 'GET') return json({ enabled: false, provider: null })

  if (path === '/api/ai/command' && method === 'POST') {
    const b = await readJsonBody(init)
    const cmd = String(b?.command || '').trim()
    if (!cmd) return err('Missing command', { status: 422 })
    return json({
      reply:
        "### Mock mode\\n\\nYou're viewing a **safe demo** with **no filesystem access**.\\n\\nTo try the real app:\\n- Set `KV_API_TOKEN` in `server/.env`\\n- Start the API\\n- Set the token in the Command Bar\\n\\nCommands are not executed in mock mode.",
      result: [
        { path: '/demo', kind: 'folder', text: 'Open /demo' },
        { path: '/demo/README.txt', kind: 'file', text: 'Open README.txt' },
      ],
    })
  }

  return err(`Mock mode: unhandled endpoint ${method} ${path}`, { status: 404 })
}

