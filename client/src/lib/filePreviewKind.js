/**
 * How to preview a file in the side panel. Binary types use GET /api/files/raw.
 */
const PDF = new Set(['pdf'])

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

/** Office / archives: offer download; no in-app renderer */
const BINARY = new Set([
  'heic', 'heif',
  'xlsx', 'xls', 'xlsm', 'docx', 'doc', 'pptx', 'ppt', 'odt', 'ods', 'odp',
  'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'dmg', 'iso',
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'sqlite', 'db',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
])

function extension(filename) {
  if (!filename || typeof filename !== 'string') return ''
  const base = filename.split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function getPreviewKind(filename) {
  const ext = extension(filename)
  if (PDF.has(ext)) return 'pdf'
  if (IMAGE.has(ext)) return 'image'
  if (BINARY.has(ext)) return 'binary'
  return 'text'
}

export function rawFileUrl(fsPath) {
  return `/api/files/raw?path=${encodeURIComponent(fsPath)}`
}
