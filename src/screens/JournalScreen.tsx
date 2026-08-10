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
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) + ' ' + new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}

export default function JournalScreen() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

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
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>No journal entries yet. Entries are auto-generated when trades complete.</div>
        ) : (
          entries.slice(0, 50).map((e: any, i: number) => {
            const pnl = e.pnl ?? e.profit_loss ?? null
            const pnlColor = pnl != null ? (pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)'
            const result = (e.result ?? '').toUpperCase()
            const isWin = result === 'WIN' || result === 'WINNER'
            const isLoss = result === 'LOSS' || result === 'LOSER'
            const signalType = e.signal_type ?? ''
            const isLong = signalType.toUpperCase().includes('LONG')
            const isShort = signalType.toUpperCase().includes('SHORT')
            const entryId = e.id || String(i)
            const isOpen = expanded === entryId
            return (
              <div key={i} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div
                  onClick={() => setExpanded(isOpen ? null : entryId)}
                  style={{ padding: '10px 0', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--muted2)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: isLong ? 'var(--green)' : isShort ? 'var(--red)' : 'var(--text)' }}>
                      {signalType || 'TRADE'}
                    </span>
                    {result && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                        background: isWin ? 'rgba(0,200,80,0.12)' : isLoss ? 'rgba(255,50,60,0.12)' : 'rgba(255,255,255,0.06)',
                        color: isWin ? 'var(--green)' : isLoss ? 'var(--red)' : 'var(--muted2)' }}>
                        {result}
                      </span>
                    )}
                    {pnl != null && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: pnlColor }}>
                        {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--muted2)', flexWrap: 'wrap' }}>
                    <span>{fmtDate(e.opened_at || e.created_at)}</span>
                    {e.points != null && e.points !== 0 && (
                      <span>
                        Points: <span style={{ fontFamily: 'var(--mono)', color: e.points >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {e.points >= 0 ? '+' : ''}{Number(e.points).toFixed(2)}
                        </span>
                      </span>
                    )}
                    {e.session && <span>Session: <span style={{ color: 'var(--text)' }}>{e.session}</span></span>}
                    {e.score && e.score !== '--' && <span>Score: <span style={{ color: 'var(--yellow)' }}>{e.score}</span></span>}
                  </div>
                </div>
                {isOpen && e.entry_text && (
                  <div style={{ padding: '10px 12px', marginBottom: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 11, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {e.entry_text}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
