const BASE = import.meta.env.VITE_API_URL ?? ''

let _token = localStorage.getItem('dash_token') ?? ''

export function getToken() { return _token }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) h['Authorization'] = `Bearer ${_token}`
  return h
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  if (res.status === 401) {
    _token = ''
    localStorage.removeItem('dash_token')
    window.location.reload()
  }
  return res
}

export async function login(username: string, password: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return false
  const data = await res.json()
  if (data.token) {
    _token = data.token
    localStorage.setItem('dash_token', _token)
  }
  return data.ok === true
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
