import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { postAiRead } from '../hooks/useLadders'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmtN(v: any, d = 1) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (isNaN(n)) return String(v)
  return n.toFixed(d)
}

function VixBar({ label, val, maxV }: { label: string; val: number; maxV: number }) {
  const pct = Math.min(100, Math.round(val / maxV * 100))
  const color = val >= 30 ? 'var(--red)' : val >= 20 ? 'var(--yellow)' : 'var(--green)'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{val.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function VolScreen() {
  const { data } = useDashboard()
  const [termData,   setTermData]   = useState<any[]>([])
  const [rrData,     setRrData]     = useState<any[]>([])
  const [volStats,   setVolStats]   = useState<any>(null)
  const [volRead,    setVolRead]    = useState('')
  const [loadingVol, setLoadingVol] = useState(false)

  const vix   = parseFloat(String(data?.vix   ?? 0)) || 0
  const vix9d = parseFloat(String(data?.vix9d ?? 0)) || 0
  const vix3m = parseFloat(String(data?.vix3m ?? 0)) || 0
  const skew  = parseFloat(String(data?.skew  ?? 0)) || 0
  const implMove = parseFloat(String(data?.implied_weekly_move ?? 0)) || 0
  const implPct  = parseFloat(String(data?.implied_weekly_pct  ?? 0)) || 0
  const ivRank   = data?.spx_iv_rank  != null ? parseFloat(String(data.spx_iv_rank))  : null
  const ivRegime = data?.spx_iv_regime ?? null

  const allV = [vix, vix9d, vix3m].filter(v => v > 0)
  const maxV = allV.length ? Math.max(...allV) : 30

  // Term structure shape
  let tsLabel = '--', tsNote = ''
  if (vix9d > 0 && vix3m > 0) {
    const spread = vix9d - vix3m
    if (spread > 1.5)       { tsLabel = 'BACKWARDATION'; tsNote = 'Short-term fear spike — VIX9D elevated above VIX3M. Mean-reverts quickly.' }
    else if (spread < -1.5) { tsLabel = 'CONTANGO';      tsNote = 'Normal vol regime — VIX3M above VIX9D. Calm short-term environment.' }
    else                    { tsLabel = 'FLAT';           tsNote = 'Term structure flat — no strong near vs far vol signal. Mixed regime.' }
  }
  const tsColor = tsLabel === 'BACKWARDATION' ? 'var(--red)' : tsLabel === 'CONTANGO' ? 'var(--green)' : 'var(--muted2)'

  // VIX label
  const vixLabel = vix >= 30 ? 'EXTREME FEAR' : vix >= 20 ? 'ELEVATED' : vix >= 15 ? 'NORMAL' : 'CALM'
  const vixColor = vix >= 30 ? 'var(--red)' : vix >= 20 ? 'var(--yellow)' : 'var(--green)'

  // Skew label
  const skewLabel = skew > 8 ? 'High fear premium' : skew > 3 ? 'Moderate hedge demand' : skew < 0 ? 'Calls rich (unusual)' : 'Balanced skew'

  // IV bar color
  const ivColor = ivRegime === 'EXTREME' ? 'var(--red)' : ivRegime === 'HIGH' ? 'var(--yellow)' : ivRegime === 'ELEVATED' ? 'var(--text)' : ivRegime === 'LOW' ? 'var(--green)' : 'var(--muted2)'

  const loadTermStructure = useCallback(async () => {
    try {
      const d = await apiFetch('/api/vix-term-structure')
      setTermData(d.data || d.rows || [])
    } catch {}
  }, [])

  const loadRrSkew = useCallback(async () => {
    try {
      const d = await apiFetch('/api/rr-skew')
      setRrData(d.data || d.rows || [])
    } catch {}
  }, [])

  const loadVolStats = useCallback(async () => {
    try {
      const d = await apiFetch('/api/vol-stats')
      setVolStats(d)
    } catch {}
  }, [])

  useEffect(() => {
    loadTermStructure()
    loadRrSkew()
    loadVolStats()
  }, [loadTermStructure, loadRrSkew, loadVolStats])

  async function handleVolRead() {
    setLoadingVol(true)
    try { setVolRead(await postAiRead('/api/vol-read')) }
    catch (e: any) { setVolRead('Error: ' + e.message) }
    finally { setLoadingVol(false) }
  }

  return (
    <>
      {/* ── Volatility Regime Cards ── */}
      <div className="panel">
        <div className="panel-title">Volatility Regime</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
          {[
            { label: 'VIX', val: vix > 0 ? fmtN(vix, 2) : '--', sub: vixLabel, color: vixColor },
            { label: 'Term Structure', val: tsLabel, sub: tsNote.slice(0, 40) + (tsNote.length > 40 ? '…' : ''), color: tsColor },
            { label: 'Vol Skew', val: skew !== 0 ? (skew > 0 ? '+' : '') + fmtN(skew, 1) + ' vol pts' : '--', sub: skewLabel, color: skew > 8 ? 'var(--red)' : skew < 0 ? 'var(--green)' : 'var(--muted2)' },
            { label: 'Implied Weekly Move', val: implMove > 0 ? '±' + implMove.toFixed(0) + ' pts' : '--', sub: implPct > 0 ? '±' + implPct.toFixed(1) + '%' : '', color: 'var(--yellow)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: c.color }}>{c.val}</div>
              {c.sub && <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 3, lineHeight: 1.4 }}>{c.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── VIX Term Structure bars ── */}
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>VIX Term Structure</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)', color: tsColor }}>{tsLabel}</span>
        </div>
        {vix9d > 0 && <VixBar label="VIX 9D" val={vix9d} maxV={maxV} />}
        {vix   > 0 && <VixBar label="VIX (30D)" val={vix}   maxV={maxV} />}
        {vix3m > 0 && <VixBar label="VIX 3M" val={vix3m} maxV={maxV} />}
        {tsNote && <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', lineHeight: 1.6 }}>{tsNote}</div>}
      </div>

      {/* ── SPX IV Rank ── */}
      {ivRank != null && (
        <div className="panel">
          <div className="panel-title">SPX IV Rank</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, ivRank)}%`, borderRadius: 4, background: ivColor, transition: 'width .4s' }} />
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: ivColor, minWidth: 60, textAlign: 'right' }}>{ivRank.toFixed(0)}%</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['LOW', 'NORMAL', 'HIGH', 'EXTREME'].map((l, i) => (
              <span key={l} style={{ fontSize: 8, fontFamily: 'var(--mono)', color: ['var(--green)', 'var(--muted2)', 'var(--yellow)', 'var(--red)'][i] }}>{l}</span>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="td-row"><span className="td-label">Regime</span><span className="td-val" style={{ color: ivColor }}>{ivRegime || '--'}</span></div>
            {implMove > 0 && <div className="td-row"><span className="td-label">Implied Weekly Move</span><span className="td-val warn">±{implMove.toFixed(0)} pts ({implPct.toFixed(1)}%)</span></div>}
          </div>
        </div>
      )}

      {/* ── VIX Term Structure data from API ── */}
      {termData.length > 0 && (
        <div className="panel">
          <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}>VIX TERM STRUCTURE</div>
          {termData.map((row: any, i: number) => (
            <div key={i} className="td-row">
              <span className="td-label">{row.label || row.expiry || row.date || `Row ${i+1}`}</span>
              <span className="td-val" style={{ fontFamily: 'var(--mono)' }}>{row.value ?? row.iv ?? '--'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── SPX Risk Reversal Skew ── */}
      {rrData.length > 0 && (
        <div className="panel">
          <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}>SPX RISK REVERSAL SKEW (25Δ Put − Call)</div>
          {rrData.map((row: any, i: number) => (
            <div key={i} className="td-row">
              <span className="td-label">{row.label || row.expiry || `Row ${i+1}`}</span>
              <span className="td-val">{row.value ?? row.rr ?? '--'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Vol Stats IV vs RV ── */}
      {volStats && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Vol Stats — IV vs RV
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
            {[
              { label: 'IV',    val: volStats.iv,     color: 'var(--yellow)' },
              { label: 'RV',    val: volStats.rv,     color: 'var(--text)' },
              { label: 'IV Rank', val: volStats.iv_rank, color: 'var(--price)' },
              { label: 'IV−RV', val: volStats.spread ?? (volStats.iv != null && volStats.rv != null ? (volStats.iv - volStats.rv).toFixed(1) : null), color: 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: s.color }}>{s.val ?? '--'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Vol Read ── */}
      <button className="ai-read-btn" onClick={handleVolRead} disabled={loadingVol}>
        {loadingVol ? '⚡ LOADING...' : volRead ? '↻ REFRESH VOL READ' : '⚡ GET VOL READ FROM CLAUDE'}
      </button>
      {volRead && (
        <div style={{ margin: '6px 8px', padding: 10, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, lineHeight: 1.6, color: 'var(--text)' }}>
          {volRead}
        </div>
      )}
    </>
  )
}
