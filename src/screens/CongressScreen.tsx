import { useState, useEffect, useCallback } from 'react'
import { Tooltip } from '../components/Tooltip'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtDate(s: string) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch { return s.slice(0, 10) }
}

function AmtBadge({ amount }: { amount: string }) {
  const lower = (amount ?? '').toLowerCase()
  const isLarge = lower.includes('million') || lower.includes('1,000,000')
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 8, padding: '1px 6px', borderRadius: 3,
      background: isLarge ? 'rgba(240,168,50,0.12)' : 'rgba(77,166,255,0.08)',
      color: isLarge ? 'var(--yellow)' : 'var(--blue)',
      border: `1px solid ${isLarge ? 'rgba(240,168,50,0.2)' : 'rgba(77,166,255,0.15)'}`,
    }}>{amount}</span>
  )
}

function TradeRow({ t }: { t: any }) {
  const isBuy  = (t.transaction_date ?? t.type ?? '').toLowerCase().includes('purchase') ||
                 (t.type ?? '').toLowerCase().includes('buy')
  const isSell = (t.type ?? '').toLowerCase().includes('sale') ||
                 (t.type ?? '').toLowerCase().includes('sell')
  const typeColor = isBuy ? 'var(--green)' : isSell ? 'var(--red)' : 'var(--muted2)'
  const typeLabel = isBuy ? 'BUY' : isSell ? 'SELL' : (t.type ?? '').toUpperCase().slice(0, 6)

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
          {t.ticker ?? t.asset_name ?? '?'}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: typeColor,
          background: `${typeColor}18`, border: `1px solid ${typeColor}30`,
          padding: '1px 6px', borderRadius: 3 }}>{typeLabel}</span>
        {t.amount && <AmtBadge amount={t.amount} />}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)' }}>
          {fmtDate(t.transaction_date ?? t.disclosure_date ?? t.date ?? '')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: 'var(--muted2)' }}>
          {t.politician ?? t.name ?? t.representative ?? 'Unknown'}
        </span>
        {t.party && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7, padding: '1px 5px', borderRadius: 3,
            background: t.party === 'Republican' ? 'rgba(240,90,90,0.1)' : 'rgba(77,166,255,0.1)',
            color: t.party === 'Republican' ? 'var(--red)' : 'var(--blue)',
            border: `1px solid ${t.party === 'Republican' ? 'rgba(240,90,90,0.2)' : 'rgba(77,166,255,0.2)'}` }}>
            {t.party.slice(0, 1)}
          </span>
        )}
        {t.chamber && <span style={{ fontSize: 8, color: 'var(--muted)' }}>{t.chamber}</span>}
      </div>
      {t.asset_description && (
        <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>{t.asset_description}</div>
      )}
    </div>
  )
}

function LateRow({ r }: { r: any }) {
  const days = parseInt(r.days_late ?? r.late_days ?? '0') || 0
  const urgency = days > 180 ? 'var(--red)' : days > 60 ? 'var(--yellow)' : 'var(--muted2)'
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>
          {r.politician ?? r.name ?? r.representative ?? 'Unknown'}
        </div>
        <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>
          {r.ticker ?? r.asset ?? ''} · {fmtDate(r.transaction_date ?? r.date ?? '')}
        </div>
      </div>
      {days > 0 && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: urgency }}>
          {days}d late
        </span>
      )}
    </div>
  )
}

export default function CongressScreen() {
  const [trades,    setTrades]    = useState<any[]>([])
  const [lateRpts,  setLateRpts]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(false)
  const [activeTab, setActiveTab] = useState<'trades' | 'late'>('trades')
  const [filterTicker, setFilterTicker] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [td, lr] = await Promise.all([
        apiFetch('/api/congress-trades').catch(() => ({ trades: [], data: [] })),
        apiFetch('/api/congress-late').catch(() => ({ data: [] })),
      ])
      setTrades(td.trades ?? td.data ?? [])
      setLateRpts(lr.data ?? lr.late_reports ?? lr.reports ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const shown = trades.filter(t => {
    if (!filterTicker) return true
    return (t.ticker ?? t.asset_name ?? '').toLowerCase().includes(filterTicker.toLowerCase())
  })

  const lateCnt  = lateRpts.length
  const tradeCnt = trades.length

  return (
    <>
      <div className="panel" style={{ paddingBottom: 0 }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tooltip tip="Congressional stock trades reported via STOCK Act disclosures. Members of Congress must report trades within 45 days. Late reports are particularly notable — they may indicate the politician was hiding time-sensitive information. Use as a leading indicator of institutional knowledge.">
            Congress Trades
          </Tooltip>
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>STOCK Act</span>
          <button onClick={load} style={{ marginLeft: 'auto', fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'none', color: 'var(--muted2)', cursor: 'pointer' }}>
            {loading ? '...' : '↻'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginTop: 8 }}>
          {([
            { id: 'trades', label: `Recent Trades${tradeCnt ? ` (${tradeCnt})` : ''}` },
            { id: 'late',   label: `Late Reports${lateCnt ? ` (${lateCnt})` : ''}` },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '6px 0', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--green)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--green)' : 'var(--muted2)',
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'trades' && (
        <div className="panel">
          {/* Filter */}
          <input
            value={filterTicker}
            onChange={e => setFilterTicker(e.target.value)}
            placeholder="Filter by ticker…"
            style={{
              width: '100%', padding: '6px 10px', marginBottom: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 5, color: 'var(--text)', fontSize: 11,
              fontFamily: 'var(--mono)', outline: 'none',
            }}
          />
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 10, padding: 16 }}>Loading…</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 10, padding: 16 }}>
              {trades.length === 0 ? 'No trades loaded — tap ↻ to refresh' : 'No trades match filter'}
            </div>
          ) : (
            shown.slice(0, 60).map((t, i) => <TradeRow key={i} t={t} />)
          )}
        </div>
      )}

      {activeTab === 'late' && (
        <div className="panel">
          <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
            <Tooltip tip="Late reports are filings submitted after the 45-day STOCK Act deadline. They may indicate trades the politician wanted to delay disclosing. The longer the delay, the more suspicious the timing.">Late reports</Tooltip>
            {' '}are trades filed after the 45-day disclosure deadline. Longer delays = higher suspicion.
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 10, padding: 16 }}>Loading…</div>
          ) : lateRpts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 10, padding: 16 }}>No late reports loaded</div>
          ) : (
            lateRpts.slice(0, 40).map((r, i) => <LateRow key={i} r={r} />)
          )}
        </div>
      )}
    </>
  )
}
