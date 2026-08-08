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
  const [rrData25,   setRrData25]   = useState<any[]>([])
  const [rrData10,   setRrData10]   = useState<any[]>([])
  const [ivCurve,    setIvCurve]    = useState<any[]>([])
  const [volStats,   setVolStats]   = useState<any>(null)
  const [volRead,    setVolRead]    = useState('')
  const [loadingVol, setLoadingVol] = useState(false)

  const vix   = parseFloat(String(data?.vix   ?? 0)) || 0
  const apiVix9d = termData.find((r: any) => r.tenor?.includes('9') || r.label?.includes('9'))?.vix
  const apiVix3m = termData.find((r: any) => r.tenor?.includes('3M') || r.label?.includes('3M'))?.vix
  const vix9d = parseFloat(String(data?.vix9d ?? apiVix9d ?? 0)) || 0
  const vix3m = parseFloat(String(data?.vix3m ?? apiVix3m ?? 0)) || 0
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
      const d = await apiFetch('/api/spx-skew')
      setRrData25(d.data_25 || d.data || [])
      setRrData10(d.data_10 || [])
    } catch {}
  }, [])

  const loadIvCurve = useCallback(async () => {
    try {
      const d = await apiFetch('/api/spx-realized-vol')
      const rows: any[] = (d.data || []).filter((r: any) => r.days && r.iv > 0)
      const showDays = [1, 5, 7, 14, 21, 30, 60, 90, 180, 365]
      const byDay: Record<number, any> = {}
      rows.forEach((r: any) => { byDay[r.days] = r })
      const filtered = showDays.map(d => byDay[d]).filter(Boolean)
      setIvCurve(filtered.length ? filtered : rows.slice(0, 10))
    } catch {}
  }, [])

  useEffect(() => {
    loadTermStructure()
    loadRrSkew()
    loadIvCurve()
  }, [loadTermStructure, loadRrSkew, loadIvCurve])

  // vol_stats comes from the main /data endpoint via useDashboard
  useEffect(() => {
    if (data?.vol_stats && Object.keys(data.vol_stats).length > 0) {
      setVolStats(data.vol_stats)
    }
  }, [data])

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
        {data?.vr_read && (
          <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>{data.vr_read}</div>
        )}
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
              <span className="td-label">{row.tenor ?? row.label ?? row.expiry ?? row.date ?? `Row ${i+1}`}</span>
              <span className="td-val" style={{ fontFamily: 'var(--mono)' }}>{row.vix ?? row.value ?? row.iv ?? '--'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── SPX Risk Reversal Skew ── */}
      {(rrData25.length > 0 || rrData10.length > 0) && (() => {
        function rrLast(rows: any[]) {
          for (let i = rows.length - 1; i >= 0; i--) {
            const v = parseFloat(rows[i].risk_reversal ?? rows[i].skew ?? rows[i].rr ?? rows[i].value ?? '')
            if (!isNaN(v) && Math.abs(v) >= 0.1) {
              const scaled = Math.abs(v) < 1 && v !== 0 ? v * 100 : v
              return scaled
            }
          }
          return null
        }
        const last25 = rrLast(rrData25)
        const last10 = rrLast(rrData10)
        const rrColor = (v: number) => v <= -3 ? 'var(--green)' : v >= 3 ? 'var(--red)' : 'var(--muted2)'
        return (
          <div className="panel">
            <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}>SPX RISK REVERSAL SKEW (25Δ Put − Call)</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {last25 != null && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--muted2)' }}>25Δ RR</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: rrColor(last25) }}>{(last25 >= 0 ? '+' : '') + last25.toFixed(2)} vol pts</div>
                </div>
              )}
              {last10 != null && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--muted2)' }}>10Δ RR</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: rrColor(last10) }}>{(last10 >= 0 ? '+' : '') + last10.toFixed(2)} vol pts</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── IV Term Structure (interpolated) ── */}
      {ivCurve.length > 0 && (
        <div className="panel">
          <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}>IV TERM STRUCTURE</div>
          {ivCurve.map((r: any, i: number) => {
            const days = r.days
            const label = days <= 7 ? `${days}d` : days <= 30 ? `${days}d` : days <= 90 ? `${Math.round(days / 7)}w` : `${Math.round(days / 30)}m`
            const iv = parseFloat(r.iv) || 0
            const maxIv = Math.max(...ivCurve.map((x: any) => parseFloat(x.iv) || 0))
            const pct = maxIv > 0 ? Math.round((iv / maxIv) * 80) + 10 : 50
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', minWidth: 28 }}>{label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: iv >= 25 ? 'var(--red)' : iv >= 18 ? 'var(--yellow)' : 'var(--green)', borderRadius: 3 }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{iv.toFixed(1)}%</span>
              </div>
            )
          })}
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
          {(volStats.iv_low != null || volStats.rv_low != null) && (
            <div style={{ display: 'flex', gap: 5, marginTop: 5, fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
              {volStats.iv_low != null && <span>IV range: {volStats.iv_low.toFixed(1)}–{(volStats.iv_high ?? 0).toFixed(1)}%</span>}
              {volStats.rv_low != null && <span style={{ marginLeft: 'auto' }}>RV range: {volStats.rv_low.toFixed(1)}–{(volStats.rv_high ?? 0).toFixed(1)}%</span>}
            </div>
          )}
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
