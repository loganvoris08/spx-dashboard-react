import { useState, useEffect, useCallback } from 'react'
import { useSide } from '../lib/SideContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtPrem(v: any) {
  const n = parseFloat(v) || 0
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

export default function HotOptionsScreen() {
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [hotData, setHotData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ts, setTs] = useState('')

  const loadHot = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch(isNdx ? '/api/ndx-hot-options' : '/api/hot-options')
      setHotData(d.options ?? d.strikes ?? d.data ?? d ?? [])
      setTs(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch { setHotData([]) }
    finally { setLoading(false) }
  }, [isNdx])

  useEffect(() => { loadHot() }, [loadHot])

  return (
    <>
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Hot Options — {isNdx ? 'NDX' : 'SPX'}</span>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW LIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ts && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{ts}</span>}
            <button onClick={loadHot} disabled={loading} style={{ fontSize: 8, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted2)', cursor: 'pointer' }}>↻</button>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading hot options...</div>
        ) : hotData.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No hot options data available</div>
        ) : (
          hotData.slice(0, 30).map((h: any, i: number) => {
            const isCall = (h.type || h.side || '').toLowerCase().includes('call')
            const color = isCall ? 'var(--green)' : 'var(--red)'
            const prem = h.premium ?? h.notional ?? 0
            const exp = h.expiry ? String(h.expiry).replace(/^\d{4}-/, '').replace(/-/g, '/') : ''
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10, borderLeft: `2px solid ${color}`, paddingLeft: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isCall ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,68,0.15)', color, flexShrink: 0 }}>{isCall ? 'C' : 'P'}</span>
                <span style={{ fontWeight: 700, color }}>{h.strike}</span>
                <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{exp}</span>
                <span style={{ color, fontWeight: 700 }}>{fmtPrem(prem)}</span>
                {h.score != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--yellow)', fontWeight: 700 }}>score: {h.score}</span>
                )}
                {h.unusual_score != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--yellow)', fontWeight: 700 }}>⚡{h.unusual_score}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
