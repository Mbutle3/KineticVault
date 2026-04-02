import { mockFetch } from '../mock/mockApi.js'

export function getKvApiToken() {
  try {
    return (localStorage.getItem('kv-api-token') || '').trim()
  } catch {
    return ''
  }
}

export function setKvApiToken(token) {
  try {
    const t = (token || '').trim()
    if (!t) localStorage.removeItem('kv-api-token')
    else localStorage.setItem('kv-api-token', t)
  } catch {
    /* ignore */
  }
}

export function isMockMode() {
  try {
    return String(import.meta.env.VITE_MOCK_MODE || '') === '1'
  } catch {
    return false
  }
}

export async function apiFetch(input, init = {}) {
  if (isMockMode()) return mockFetch(input, init)

  const token = getKvApiToken()
  if (!token) return fetch(input, init)

  const headers = new Headers(init.headers || {})
  if (!headers.has('x-kv-token') && !headers.has('authorization')) {
    headers.set('x-kv-token', token)
  }

  return fetch(input, { ...init, headers })
}

