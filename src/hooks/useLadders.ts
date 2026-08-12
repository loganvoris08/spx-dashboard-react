import { useState, useEffect, useCallback } from 'react'
import { useSSE } from '../lib/SSEContext'

const BASE = import.meta.env.VITE_API_URL ?? ''

let _token = () => localStorage.getItem('dash_token') ?? ''

async function fetchLadders() {
  const res = await fetch(`${BASE}/data/ladders`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token()}` },
  })
  if (!res.ok) throw new Error(`/data/ladders ${res.status}`)
  return res.json()
}

const CACHE_KEY = 'ladders_cache'

function readCache(): any | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') } catch { return null }
}
function writeCache(d: any) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)) } catch {}
}

export function useLadders(active: boolean) {
  const [data, setData] = useState<any>(() => readCache())
  const { on } = useSSE()

  const refresh = useCallback(async () => {
    try {
      const d = await fetchLadders()
      // Only update if the response has actual ladder rows — don't overwrite good cached data with cold-start empties
      const hasRows = (d?.ladder_rows?.length > 0) || (d?.ndx?.ladder_rows?.length > 0)
      if (hasRows) {
        writeCache(d)
        setData(d)
      } else if (!readCache()) {
        setData(d) // first load, nothing cached — show empty so callers know request completed
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!active) return
    refresh()
    const off = on('update', () => refresh())
    return off
  }, [active, refresh, on])

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
