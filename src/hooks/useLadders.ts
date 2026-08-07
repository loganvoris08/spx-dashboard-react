import { useState, useEffect, useRef, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
const POLL_MS = 30_000

let _token = () => localStorage.getItem('dash_token') ?? ''

async function fetchLadders() {
  const res = await fetch(`${BASE}/data/ladders`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token()}` },
  })
  if (!res.ok) throw new Error(`/data/ladders ${res.status}`)
  return res.json()
}

export function useLadders(active: boolean) {
  const [data, setData] = useState<any>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const d = await fetchLadders()
      setData(d)
    } catch {}
  }, [])

  useEffect(() => {
    if (!active) return
    refresh()
    timer.current = setInterval(refresh, POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [active, refresh])

  return data
}

export async function postAiRead(endpoint: string): Promise<string> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token()}` },
  })
  const d = await res.json()
  return d.text || d.read || d.result || 'No analysis available.'
}

export async function getMacro(): Promise<string> {
  const res = await fetch(`${BASE}/macro`, {
    headers: { 'Authorization': `Bearer ${_token()}` },
  })
  const d = await res.json()
  return d.text || d.read || d.result || 'No macro data available.'
}
