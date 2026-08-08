import { useState, useEffect, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtDate(s?: string) {
  if (!s) return '--'
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) }
  catch { return s }
}

export default function JournalScreen() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadJournal = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/journal')
      setEntries(d.entries ?? d.trades ?? d ?? [])
    } catch { setEntries([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadJournal() }, [loadJournal])

  return (
    <>
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Trade Journal</span>
          <button onClick={loadJournal} style={{ fontSize: 8, padding: '3px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted2)', cursor: 'pointer' }}>↻ Refresh</button>
        </div>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>Loading journal...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No journal entries found.</div>
        ) : (
          entries.slice(0, 50).map((e: any, i: number) => {
            const pnl = e.pnl ?? e.profit_loss ?? null
            const pnlColor = pnl != null ? (pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)'
            const isCall = (e.type || e.side || '').toLowerCase().includes('call')
            const isLong = (e.direction || '').toLowerCase().includes('long') || (e.action || '').toLowerCase().includes('buy')
            return (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: isCall ? 'var(--green)' : 'var(--red)' }}>
                    {e.ticker ?? e.symbol ?? 'SPX'}
                  </span>
                  {e.strike && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{e.strike}</span>}
                  {e.expiry && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)' }}>{e.expiry}</span>}
                  {pnl != null && (
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: pnlColor }}>
                      {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(0)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--muted2)', flexWrap: 'wrap' }}>
                  <span>{fmtDate(e.date ?? e.trade_date ?? e.entry_date)}</span>
                  {e.direction && <span style={{ color: isLong ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{e.direction.toUpperCase()}</span>}
                  {e.entry  && <span>Entry: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{e.entry}</span></span>}
                  {e.exit   && <span>Exit: <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{e.exit}</span></span>}
                  {e.notes  && <span style={{ color: 'var(--muted2)' }}>{e.notes}</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
