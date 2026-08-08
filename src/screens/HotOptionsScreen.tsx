import { useState, useEffect, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtPrem(v: any) {
  const n = parseFloat(v) || 0
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

export default function HotOptionsScreen() {
  const [hotData, setHotData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ts, setTs] = useState('')

  const loadHot = useCallback(async () => {
    setLoading(true)
    try {
      const [spxRes, ndxRes] = await Promise.allSettled([
        apiFetch('/api/hot-options'),
        apiFetch('/api/ndx-hot-options'),
      ])
      const spxRows: any[] = (spxRes.status === 'fulfilled' ? spxRes.value.options ?? [] : []).map((r: any) => ({ ...r, ticker: 'SPX' }))
      const ndxRows: any[] = (ndxRes.status === 'fulfilled' ? ndxRes.value.options ?? [] : []).map((r: any) => ({ ...r, ticker: 'NDX' }))
      const combined = [...spxRows, ...ndxRows].sort((a: any, b: any) => {
        const ta = (a.call_prem ?? 0) + (a.put_prem ?? 0)
        const tb = (b.call_prem ?? 0) + (b.put_prem ?? 0)
        return tb - ta
      })
      setHotData(combined)
      setTs(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch { setHotData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadHot() }, [loadHot])

  return (
    <>
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Hot Options — Market Wide</span>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW LIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ts && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{ts}</span>}
            <button onClick={loadHot} disabled={loading} style={{ fontSize: 8, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted2)', cursor: 'pointer' }}>↻</button>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 36px 1fr 1fr 1fr 54px', gap: '0 6px', padding: '4px 0 6px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', fontWeight: 700 }}>
          <span>STRIKE</span>
          <span>TICKER</span>
          <span style={{ color: 'var(--green)' }}>CALL $</span>
          <span style={{ color: 'var(--red)' }}>PUT $</span>
          <span>TOTAL $</span>
          <span style={{ textAlign: 'right' }}>DOM</span>
        </div>

        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading hot options…</div>
        ) : hotData.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No data available</div>
        ) : (
          hotData.slice(0, 25).map((h: any, i: number) => {
            const callP  = h.call_prem  ?? h.call_premium  ?? 0
            const putP   = h.put_prem   ?? h.put_premium   ?? 0
            const total  = callP + putP
            const callDom = total > 0 && callP > putP
            const putDom  = total > 0 && putP >= callP
            const domColor = callDom ? 'var(--green)' : putDom ? 'var(--red)' : 'var(--muted2)'
            const domLabel = callDom ? '▲ CALL' : putDom ? '▼ PUT' : 'BALANCED'
            const tkColor = h.ticker === 'SPX' ? '#60a5fa' : '#a78bfa'
            const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 36px 1fr 1fr 1fr 54px', gap: '0 6px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: 10, background: rowBg, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{h.strike}</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: h.ticker === 'SPX' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)', color: tkColor, textAlign: 'center' }}>{h.ticker}</span>
                <span style={{ color: 'var(--green)' }}>{fmtPrem(callP)}</span>
                <span style={{ color: 'var(--red)' }}>{fmtPrem(putP)}</span>
                <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{fmtPrem(total)}</span>
                <span style={{ color: domColor, fontSize: 8, fontWeight: 700, textAlign: 'right' }}>{domLabel}</span>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
