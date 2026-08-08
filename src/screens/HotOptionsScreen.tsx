import { useState, useEffect, useCallback, useRef } from 'react'
import { useSSE } from '../lib/SSEContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

type Status = 'SQUEEZE' | 'UNUSUAL' | 'HOT' | 'ACTIVE' | 'EARLY' | 'LATE' | 'CHASE'
type Timing = 'EARLY' | 'PRIME' | 'LATE' | 'CHASE'
type FilterTab = 'ALL' | 'SQUEEZE' | 'UNUSUAL' | 'HOT' | 'CALLS' | 'PUTS' | 'LATE'

function fmtPrem(v: number) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
}

const STATUS_CFG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  SQUEEZE: { label: '⚡ SQUEEZE', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)' },
  UNUSUAL: { label: '⚡ UNUSUAL', color: '#eab308', bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.35)' },
  HOT:     { label: '🔥 HOT',    color: '#ff3344', bg: 'rgba(255,51,68,0.10)',  border: 'rgba(255,51,68,0.35)'  },
  ACTIVE:  { label: '● ACTIVE',  color: '#9ca3af', bg: 'transparent',           border: 'rgba(255,255,255,0.1)' },
  EARLY:   { label: '◎ EARLY',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' },
  LATE:    { label: '⏱ LATE',    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)',border: 'rgba(167,139,250,0.3)' },
  CHASE:   { label: '✗ CHASE',   color: '#6b7280', bg: 'transparent',           border: 'rgba(255,255,255,0.07)' },
}
const TIMING_CFG: Record<Timing, { color: string }> = {
  EARLY: { color: '#60a5fa' },
  PRIME: { color: '#00ff88' },
  LATE:  { color: '#a78bfa' },
  CHASE: { color: '#6b7280' },
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color, fontWeight: 700, minWidth: 20 }}>{score}</span>
    </div>
  )
}

function DetailPanel({ row, onClose }: { row: any; onClose: () => void }) {
  const status = row.status as Status
  const sCfg = STATUS_CFG[status] ?? STATUS_CFG.ACTIVE
  const timing = row.timing as Timing
  const tCfg = TIMING_CFG[timing] ?? TIMING_CFG.PRIME

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 14, marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{row.ticker}</span>
          <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 3, background: sCfg.bg, border: `1px solid ${sCfg.border}`, color: sCfg.color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{sCfg.label}</span>
          {row.squeeze_signals >= 3 && (
            <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 3, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316', fontFamily: 'var(--mono)', fontWeight: 700 }}>SQUEEZE x{row.squeeze_signals}</span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}>✕</button>
      </div>

      {/* Score row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: '.06em', marginBottom: 4 }}>OPPORTUNITY SCORE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 22, color: row.opp_score >= 70 ? 'var(--green)' : row.opp_score >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{row.opp_score}</span>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>/100</span>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 8, color: 'var(--muted2)', letterSpacing: '.06em', marginBottom: 4 }}>ENTRY TIMING</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 22, color: tCfg.color }}>{row.timing_score}</span>
            <span style={{ fontSize: 9, color: tCfg.color, fontWeight: 700 }}>{timing}</span>
          </div>
        </div>
      </div>

      {/* Flow stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12, fontSize: 9, fontFamily: 'var(--mono)' }}>
        {[
          { label: 'Total Prem', val: fmtPrem(row.total_prem), color: 'var(--text)' },
          { label: 'Call Prem',  val: fmtPrem(row.call_prem),  color: 'var(--green)' },
          { label: 'Put Prem',   val: fmtPrem(row.put_prem),   color: 'var(--red)' },
          { label: 'Call %',     val: `${row.call_pct}%`,       color: row.call_pct > 60 ? 'var(--green)' : row.call_pct < 40 ? 'var(--red)' : 'var(--muted2)' },
          { label: 'Avg Vol/OI', val: `${row.avg_vol_oi}x`,     color: row.avg_vol_oi >= 3 ? 'var(--yellow)' : 'var(--muted2)' },
          { label: 'Max Vol/OI', val: `${row.max_vol_oi}x`,     color: row.max_vol_oi >= 5 ? '#f97316' : 'var(--muted2)' },
          { label: 'Sweeps',     val: String(row.sweep_count),   color: row.sweep_count >= 3 ? 'var(--green)' : 'var(--muted2)' },
          { label: 'Unusual',    val: String(row.unusual_count), color: row.unusual_count >= 2 ? 'var(--yellow)' : 'var(--muted2)' },
          { label: 'ASK Agg',   val: `${row.ask_pct}%`,         color: row.ask_pct >= 60 ? 'var(--green)' : 'var(--muted2)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 3, padding: '5px 7px' }}>
            <div style={{ fontSize: 7, color: 'var(--muted2)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Best contract */}
      {row.strike && (
        <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 4, padding: '8px 10px', marginBottom: 12 }}>
          <div style={{ fontSize: 8, color: 'var(--green)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 4 }}>TOP FLOW CONTRACT</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            {row.ticker} {row.strike} {(row.last_type || '').toUpperCase()[0]}
            {row.expiry && <span style={{ fontSize: 9, color: 'var(--muted2)', fontWeight: 400, marginLeft: 6 }}>{row.expiry}{row.dte != null ? ` (${row.dte}d)` : ''}</span>}
          </div>
          {row.last_premium && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2 }}>Premium: {fmtPrem(row.last_premium)}</div>}
        </div>
      )}

      {/* Recent alerts */}
      {row.recent?.length > 0 && (
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted2)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>RECENT FLOW ({row.recent.length})</div>
          {row.recent.slice(0, 6).map((a: any, i: number) => {
            const isCall = a.type === 'call'
            const c = isCall ? 'var(--green)' : 'var(--red)'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: 9 }}>
                <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: isCall ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,68,0.15)', color: c, fontWeight: 700, flexShrink: 0 }}>{isCall ? 'C' : 'P'}</span>
                <span style={{ color: c, fontWeight: 700 }}>{a.strike}</span>
                <span style={{ color: 'var(--muted2)', fontSize: 8 }}>{a.expiry}</span>
                <span style={{ color: c }}>{fmtPrem(a.premium)}</span>
                {a.cond_label && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>{a.cond_label}</span>}
                {a.unusual && a.unusual.includes('⚡') && <span style={{ fontSize: 7, color: '#eab308' }}>{a.unusual}</span>}
                {a.vol_oi && <span style={{ fontSize: 8, color: a.vol_oi >= 3 ? '#eab308' : 'var(--muted2)' }}>{a.vol_oi}x</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'ALL',     label: 'All' },
  { id: 'SQUEEZE', label: '⚡ Squeeze' },
  { id: 'UNUSUAL', label: 'Unusual' },
  { id: 'HOT',     label: '🔥 Hot' },
  { id: 'CALLS',   label: 'Calls' },
  { id: 'PUTS',    label: 'Puts' },
  { id: 'LATE',    label: 'Late/Chase' },
]

export default function HotOptionsScreen() {
  const { on } = useSSE()
  const [results,  setResults]  = useState<any[]>([])
  const [stats,    setStats]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterTab>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ts,       setTs]       = useState('')
  const timerRef = useRef<any>(null)

  const loadScanner = useCallback(async () => {
    try {
      const [scanRes, statRes] = await Promise.allSettled([
        apiFetch('/api/market-scanner'),
        apiFetch('/api/market-scanner/stats'),
      ])
      if (scanRes.status === 'fulfilled') {
        setResults(scanRes.value.results ?? [])
        setTs(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
      if (statRes.status === 'fulfilled') setStats(statRes.value)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadScanner()
    // Refresh every 20s (matches backend TTL)
    timerRef.current = setInterval(loadScanner, 20_000)
    const off = on('update', loadScanner)
    return () => { clearInterval(timerRef.current); off() }
  }, [loadScanner, on])

  const filtered = results.filter(r => {
    if (filter === 'ALL')     return true
    if (filter === 'SQUEEZE') return r.status === 'SQUEEZE'
    if (filter === 'UNUSUAL') return r.status === 'UNUSUAL'
    if (filter === 'HOT')     return r.status === 'HOT'
    if (filter === 'CALLS')   return r.direction === 'CALL'
    if (filter === 'PUTS')    return r.direction === 'PUT'
    if (filter === 'LATE')    return r.status === 'LATE' || r.status === 'CHASE'
    return true
  })

  const squeezeCount  = results.filter(r => r.status === 'SQUEEZE').length
  const unusualCount  = results.filter(r => r.status === 'UNUSUAL').length
  const hotCount      = results.filter(r => r.status === 'HOT').length

  return (
    <>
      {/* ── Market stats header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 6 }}>
        {[
          { label: 'TICKERS',  val: String(stats?.ticker_count ?? results.length ?? '--'), color: 'var(--text)' },
          { label: 'TOTAL $',  val: stats ? fmtPrem(stats.total_prem) : '--', color: 'var(--text)' },
          { label: 'CALL %',   val: stats ? `${stats.call_pct}%` : '--', color: 'var(--green)' },
          { label: 'SQUEEZE',  val: String(squeezeCount), color: '#f97316' },
          { label: 'UNUSUAL',  val: String(unusualCount + hotCount), color: '#eab308' },
        ].map(s => (
          <div key={s.label} className="panel" style={{ padding: '6px 8px', textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 7, color: 'var(--muted2)', letterSpacing: '.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Filter tabs + refresh ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0 8px', overflowX: 'auto', flexShrink: 0 }}>
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            fontSize: 9, padding: '3px 9px', borderRadius: 3, border: `1px solid ${filter === t.id ? 'var(--green)' : 'var(--border)'}`,
            background: filter === t.id ? 'rgba(0,255,136,0.08)' : 'var(--surface)',
            color: filter === t.id ? 'var(--green)' : 'var(--muted2)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {ts && <span style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{ts}</span>}
        <button onClick={loadScanner} disabled={loading} style={{ fontSize: 8, padding: '3px 8px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted2)', cursor: 'pointer', flexShrink: 0 }}>↻</button>
      </div>

      {/* ── Live badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>UW LIVE</span>
        <span style={{ fontSize: 9, color: 'var(--muted2)' }}>Market-wide · all optionable tickers · {filtered.length} results</span>
      </div>

      {/* ── Column headers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 54px 56px 44px 44px 36px 38px 70px', gap: '0 4px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px 4px 0 0', fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)', fontWeight: 700, letterSpacing: '.04em' }}>
        <span>TICKER</span>
        <span>TOTAL $</span>
        <span>CALL%/PUT%</span>
        <span>VOL/OI</span>
        <span>SWEEPS</span>
        <span>OPP</span>
        <span>TIMING</span>
        <span>STATUS</span>
      </div>

      {/* ── Results ── */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>
          Connecting to live market flow…
          <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 6 }}>Market-wide scanner builds as trades arrive via UW WebSocket</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 10 }}>
          {results.length === 0 ? 'No market flow captured yet — scanner populates in real time as option trades arrive' : `No results for "${filter}" filter`}
        </div>
      ) : (
        filtered.map((r: any) => {
          const status  = r.status as Status
          const timing  = r.timing as Timing
          const sCfg    = STATUS_CFG[status] ?? STATUS_CFG.ACTIVE
          const tCfg    = TIMING_CFG[timing] ?? TIMING_CFG.PRIME
          const isOpen  = expanded === r.ticker
          return (
            <div key={r.ticker}>
              <div
                onClick={() => setExpanded(isOpen ? null : r.ticker)}
                style={{ display: 'grid', gridTemplateColumns: '50px 54px 56px 44px 44px 36px 38px 70px', gap: '0 4px', padding: '7px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent', alignItems: 'center' }}
              >
                {/* Ticker */}
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--text)' }}>{r.ticker}</span>

                {/* Total $ */}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', fontWeight: 700 }}>{fmtPrem(r.total_prem)}</span>

                {/* Call%/Put% */}
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--green)' }}>{r.call_pct}C</span>
                  <span style={{ fontSize: 7, color: 'var(--muted2)' }}>·</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--red)' }}>{100 - r.call_pct}P</span>
                </div>

                {/* Vol/OI */}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: r.avg_vol_oi >= 3 ? '#eab308' : r.avg_vol_oi >= 1.5 ? 'var(--text2)' : 'var(--muted2)', fontWeight: r.avg_vol_oi >= 3 ? 700 : 400 }}>
                  {r.avg_vol_oi}x
                </span>

                {/* Sweeps */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: r.sweep_count >= 3 ? 'var(--green)' : 'var(--muted2)' }}>{r.sweep_count}SW</span>
                  {r.unusual_count > 0 && <span style={{ fontSize: 7, color: '#eab308' }}>⚡{r.unusual_count}</span>}
                </div>

                {/* Opp score */}
                <ScoreBar score={r.opp_score} color={r.opp_score >= 70 ? 'var(--green)' : r.opp_score >= 50 ? 'var(--yellow)' : '#9ca3af'} />

                {/* Timing */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: tCfg.color, fontWeight: 700 }}>{timing}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--muted2)' }}>{r.timing_score}</span>
                </div>

                {/* Status badge */}
                <span style={{ fontSize: 7, padding: '2px 5px', borderRadius: 3, background: sCfg.bg, border: `1px solid ${sCfg.border}`, color: sCfg.color, fontFamily: 'var(--mono)', fontWeight: 700, textAlign: 'center' }}>{sCfg.label}</span>
              </div>

              {isOpen && <DetailPanel row={r} onClose={() => setExpanded(null)} />}
            </div>
          )
        })
      )}
    </>
  )
}
