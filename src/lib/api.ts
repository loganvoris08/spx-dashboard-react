const BASE = import.meta.env.VITE_API_URL ?? ''

let _token = localStorage.getItem('dash_token') ?? ''

export function getToken() { return _token }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) h['Authorization'] = `Bearer ${_token}`
  return h
}

async function get(path: string, timeoutMs = 15_000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers(), signal: ctrl.signal })
    clearTimeout(timer)
    if (res.status === 401) {
      _token = ''
      localStorage.removeItem('dash_token')
      window.location.reload()
    }
    return res
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`Request timed out: ${path}`)
    throw e
  }
}

export async function login(_username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res  = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (data.ok && data.token) {
      _token = data.token
      localStorage.setItem('dash_token', _token)
      return { ok: true }
    }
    return { ok: false, error: data.error ?? `Server error ${res.status}` }
  } catch (e: any) {
    clearTimeout(timer)
    const msg = e.name === 'AbortError' ? 'Connection timed out — backend unreachable' : `Network error: ${e.message}`
    return { ok: false, error: msg }
  }
}

export function logout() {
  _token = ''
  localStorage.removeItem('dash_token')
}

export async function fetchData() {
  const res = await get('/data')
  if (!res.ok) throw new Error(`/data ${res.status}`)
  return res.json()
}

export async function fetchAnalytics() {
  const res = await get('/data/analytics')
  if (!res.ok) throw new Error(`/data/analytics ${res.status}`)
  return res.json()
}

export async function fetchMacro() {
  const res = await get('/macro')
  if (!res.ok) throw new Error(`/macro ${res.status}`)
  return res.json()
}

export async function fetchPrice() {
  const res = await get('/price')
  if (!res.ok) throw new Error(`/price ${res.status}`)
  return res.json()
}

export async function fetchNdxFlow() {
  const res = await get('/api/ndx-flow')
  if (!res.ok) throw new Error(`/api/ndx-flow ${res.status}`)
  return res.json()
}

export async function fetchSpxFlow() {
  const res = await get('/api/spx-flow')
  if (!res.ok) throw new Error(`/api/spx-flow ${res.status}`)
  return res.json()
}
