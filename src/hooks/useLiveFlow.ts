import { useState, useEffect, useRef } from 'react'
import { useSSE } from '../lib/SSEContext'

const BASE  = (import.meta as any).env?.VITE_API_URL ?? ''
function _token() { return localStorage.getItem('dash_token') ?? '' }
async function _get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${_token()}` } })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const LS_KEY = (side: string) => `liveflow_cache_${side}`

export function useLiveFlow(side: 'spx' | 'ndx') {
  const [alerts, setAlerts] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY(side)) ?? '[]') } catch { return [] }
  })
  const [count, setCount]   = useState(0)
  const seen                = useRef(new Set<string>())
  const { on }              = useSSE()

  // Seed seen set from initial localStorage state so SSE deduplication works
  useEffect(() => {
    seen.current.clear()
    try {
      const cached: any[] = JSON.parse(localStorage.getItem(LS_KEY(side)) ?? '[]')
      cached.forEach(item => seen.current.add(`${item.strike}|${item.type}|${item.expiry}|${item.premium}`))
    } catch { /* ignore */ }
  }, [side])

  // Initial REST fetch to populate from last known server data
  useEffect(() => {
    _get('/api/live-ticker').then((d: any) => {
      const raw: any[] = d?.contracts ?? []
      const filtered = raw.filter(item => {
        const ticker = (item.ticker ?? '').toUpperCase()
        return side === 'ndx' ? ticker === 'NDX' : ticker === 'SPX' || ticker === 'SPXW'
      })
      if (!filtered.length) return
      filtered.forEach(item => seen.current.add(`${item.strike}|${item.type}|${item.expiry}|${item.premium}`))
      setAlerts(filtered.slice(0, 30))
      try { localStorage.setItem(LS_KEY(side), JSON.stringify(filtered.slice(0, 30))) } catch { /* ignore */ }
    }).catch(() => { /* silently use localStorage fallback */ })
  }, [side])

  useEffect(() => {
    const off = on('flow', (msg) => {
      const item = msg.data
      if (!item) return

      const ticker = (item.ticker ?? '').toUpperCase()
      const matches = side === 'ndx'
        ? ticker === 'NDX'
        : ticker === 'SPX' || ticker === 'SPXW'
      if (!matches) return

      const key = `${item.strike}|${item.type}|${item.expiry}|${item.premium}`
      if (seen.current.has(key)) return
      seen.current.add(key)

      setAlerts(prev => {
        const next = [item, ...prev].slice(0, 30)
        try { localStorage.setItem(LS_KEY(side), JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
      setCount(prev => prev + 1)
    })

    return off
  }, [side, on])

  return { alerts, count }
}
