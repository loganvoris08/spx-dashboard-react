import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { postAiRead } from '../hooks/useLadders'
import { useSSE } from '../lib/SSEContext'
import LiveBadge from '../components/LiveBadge'
import { Tooltip } from '../components/Tooltip'

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
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)' }}>
        {label === 'VIX 9D'    ? <Tooltip tip="9-day VIX. Short-term fear gauge — more reactive than standard VIX. Spikes hard into binary events (FOMC, CPI). If VIX9D > VIX, that's backwardation: near-term panic priced in.">VIX 9D</Tooltip>
        : label === 'VIX (30D)' ? <Tooltip tip="Standard 30-day implied volatility index. Below 15 = calm. 15–20 = normal. 20–30 = elevated. 30+ = fear. Watch if it's rising while price is rising (unusual — suspect the move).">VIX (30D)</Tooltip>
        : label === 'VIX 3M'   ? <Tooltip tip="3-month VIX. Normally above VIX (contango = healthy). If VIX3M drops below VIX, that's backwardation — the market is pricing near-term panic above longer-term uncertainty.">VIX 3M</Tooltip>
        : label}
      </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color }}>{val.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

function TermStructureCanvas({ rows, atm_iv }: { rows: any[]; atm_iv: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !rows.length) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = 90
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const sorted = [...rows].filter(r => r.dte > 0 && r.vol > 0).sort((a, b) => a.dte - b.dte)
    if (sorted.length < 2) return
    const vols = sorted.map(r => r.vol)
    const dtes = sorted.map(r => r.dte)
    const minV = Math.min(...vols) * 0.9
    const maxV = Math.max(...vols) * 1.05
    const maxD = Math.max(...dtes)
    const pad  = { l: 28, r: 8, t: 8, b: 18 }
    const cW   = W - pad.l - pad.r
    const cH   = H - pad.t - pad.b
    const xOf  = (d: number) => pad.l + (d / (maxD || 1)) * cW
    const yOf  = (v: number) => pad.t + (1 - (v - minV) / (maxV - minV || 1)) * cH
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * cH
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke()
    }
    const grad = ctx.createLinearGradient(0, pad.t, 0, H)
    grad.addColorStop(0, 'rgba(0,140,255,0.18)')
    grad.addColorStop(1, 'rgba(0,140,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(xOf(dtes[0]), cH + pad.t)
    sorted.forEach(r => ctx.lineTo(xOf(r.dte), yOf(r.vol)))
    ctx.lineTo(xOf(dtes[dtes.length - 1]), cH + pad.t)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.8
    ctx.lineJoin = 'round'
    ctx.setLineDash([])
    ctx.beginPath()
    sorted.forEach((r, i) => i === 0 ? ctx.moveTo(xOf(r.dte), yOf(r.vol)) : ctx.lineTo(xOf(r.dte), yOf(r.vol)))
    ctx.stroke()
    ctx.fillStyle = '#3b82f6'
    sorted.forEach(r => {
      ctx.beginPath()
      ctx.arc(xOf(r.dte), yOf(r.vol), 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(180,190,210,0.8)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(r.dte + 'd', xOf(r.dte), H - 4)
      ctx.fillStyle = '#3b82f6'
    })
    ctx.fillStyle = 'rgba(160,170,190,0.7)'
    ctx.font = '8px monospace'
    ctx.textAlign = 'right'
    ;[minV, (minV + maxV) / 2, maxV].forEach(v => {
      ctx.fillText(v.toFixed(1) + '%', pad.l - 2, yOf(v) + 3)
    })
    if (atm_iv > 0) {
      const atmY = yOf(atm_iv * 100)
      ctx.strokeStyle = 'rgba(255,204,0,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(pad.l, atmY); ctx.lineTo(W - pad.r, atmY); ctx.stroke()
      ctx.setLineDash([])
    }
  }, [rows, atm_iv])
  if (!rows.length) return <div style={{ color: 'var(--muted2)', fontSize: 10, textAlign: 'center', padding: 12 }}>No term structure data</div>
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} height={90} />
}

export default function VolScreen() {
  const { data } = useDashboard()
  const { on } = useSSE()
  const [termData,   setTermData]   = useState<any[]>([])
  const [rrData25,   setRrData25]   = useState<any[]>([])
  const [rrData10,   setRrData10]   = useState<any[]>([])
  const [ivCurve,    setIvCurve]    = useState<any[]>([])
  const [volStats,   setVolStats]   = useState<any>(null)
  const [skewTermData, setSkewTermData] = useState<{ term_structure: any[]; atm_iv: number; skew: number; iv_rank: number; iv_regime: string } | null>(null)
  const [sectorData,   setSectorData]   = useState<any[]>([])
  const [volAnomalyData, setVolAnomalyData] = useState<any>(null)
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

  const loadSkewTerm = useCallback(async () => {
    try {
      const d = await apiFetch('/api/vol-term-structure')
      if (d.term_structure?.length) setSkewTermData(d)
    } catch {}
  }, [])

  const loadSectorFlow = useCallback(async () => {
    try {
      const d = await apiFetch('/api/sector-tide')
      const rows: any[] = (d.data || [])
        .map((r: any) => ({ ...r, net_flow: (r.net_call_premium ?? 0) - (r.net_put_premium ?? 0) }))
        .sort((a: any, b: any) => Math.abs(b.net_flow) - Math.abs(a.net_flow))
      setSectorData(rows)
    } catch {}
  }, [])

  const loadVolAnomaly = useCallback(async () => {
    try {
      const d = await apiFetch('/api/vol-anomaly')
      setVolAnomalyData(d)
    } catch {}
  }, [])

  useEffect(() => {
    loadTermStructure()
    loadRrSkew()
    loadIvCurve()
    loadSkewTerm()
    loadSectorFlow()
    loadVolAnomaly()
    const off1 = on('update', () => loadTermStructure())
    const off2 = on('update', () => loadRrSkew())
    const off3 = on('update', () => loadIvCurve())
    const off4 = on('update', () => loadSkewTerm())
    const off5 = on('update', () => loadSectorFlow())
    return () => { off1(); off2(); off3(); off4(); off5() }
  }, [loadTermStructure, loadRrSkew, loadIvCurve, loadSkewTerm, loadSectorFlow, loadVolAnomaly, on])

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
        <div className="panel-title"><Tooltip tip="Summary of current volatility environment. Combines VIX level, term structure shape, put/call skew, and implied weekly move. High volatility regimes favor wider stops and smaller size." label="Volatility Regime">Volatility Regime</Tooltip></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
          {[
            { label: 'VIX', tip: 'CBOE 30-day implied volatility index. Below 15 = calm. 15–20 = normal. 20–30 = elevated. 30+ = fear. Higher VIX = wider daily SPX ranges expected.', val: vix > 0 ? fmtN(vix, 2) : '--', sub: vixLabel, color: vixColor },
            { label: 'Term Structure', tip: 'Shape of VIX across time. CONTANGO = VIX3M above VIX (normal, calm). BACKWARDATION = VIX above VIX3M (near-term panic priced in, often a short-term vol top).', val: tsLabel, sub: tsNote.slice(0, 40) + (tsNote.length > 40 ? '…' : ''), color: tsColor },
            { label: 'Vol Skew', tip: 'Put IV minus call IV at equal delta. Positive = puts more expensive (hedging active, typical). Very high (>10) = extreme tail-risk fear. Negative = calls more expensive (unusual, call frenzy).', val: skew !== 0 ? (skew > 0 ? '+' : '') + fmtN(skew, 1) + ' vol pts' : '--', sub: skewLabel, color: skew > 8 ? 'var(--red)' : skew < 0 ? 'var(--green)' : 'var(--muted2)' },
            { label: 'Implied Weekly Move', tip: "Options market's expected SPX range for the week. 68% probability price stays within this range. Use for setting targets and stops — going for more than 2× the implied move is low-probability.", val: implMove > 0 ? '±' + implMove.toFixed(0) + ' pts' : '--', sub: implPct > 0 ? '±' + implPct.toFixed(1) + '%' : '', color: 'var(--yellow)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}><Tooltip tip={c.tip ?? ''}>{c.label}</Tooltip></div>
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
          <span><Tooltip tip="Compares VIX at 9-day, 30-day, and 3-month tenors. The slope tells you where fear is concentrated. Bars longer to the right = higher vol at that tenor. A steep upward slope is normal (contango). Flat or inverted = near-term stress." label="VIX Term Structure">VIX Term Structure</Tooltip></span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border2)', color: tsColor }}>{tsLabel}</span>
        </div>
        {vix9d > 0 && <VixBar label="VIX 9D" val={vix9d} maxV={maxV} />}
        {vix   > 0 && <VixBar label="VIX (30D)" val={vix}   maxV={maxV} />}
        {vix3m > 0 && <VixBar label="VIX 3M" val={vix3m} maxV={maxV} />}
        {tsNote && <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)', lineHeight: 1.6 }}>{tsNote}</div>}
      </div>

      {/* ── Live Skew Monitor ── */}
      {skewTermData && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Live Skew Monitor
            <LiveBadge label="UW LIVE" />
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 3, padding: '1px 5px' }}>VOL TERM</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="At-the-money implied volatility — the annualized volatility the market prices into near-term SPX options right now. 15% = calm, 20–25% = elevated, 30%+ = high fear. Higher = options are more expensive to buy.">ATM IV</Tooltip></div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)', color: skewTermData.atm_iv > 0.25 ? 'var(--red)' : skewTermData.atm_iv > 0.15 ? 'var(--yellow)' : 'var(--green)' }}>
                {skewTermData.atm_iv > 0 ? (skewTermData.atm_iv * 100).toFixed(1) + '%' : '--'}
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="25-delta put IV minus 25-delta call IV. Positive = puts more expensive than calls (bearish hedging demand, typical). Negative = calls more expensive (unusual call-side demand, risk-on). Values above +5 = significant hedge buying.">25Δ Skew</Tooltip></div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)', color: skewTermData.skew > 2 ? 'var(--red)' : skewTermData.skew < -2 ? 'var(--green)' : 'var(--yellow)' }}>
                {skewTermData.skew != null ? (skewTermData.skew > 0 ? '+' : '') + Number(skewTermData.skew).toFixed(1) : '--'}
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip="Implied volatility regime classification. EXTREME = ATM IV above 30% (high fear, sells rich). HIGH = 20–30%. ELEVATED = 15–20%. NORMAL = below 15% (cheap options, good time to buy premium).">IV Regime</Tooltip></div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: skewTermData.iv_regime === 'EXTREME' || skewTermData.iv_regime === 'HIGH' ? 'var(--red)' : skewTermData.iv_regime === 'ELEVATED' ? 'var(--yellow)' : 'var(--green)' }}>
                {skewTermData.iv_regime ?? '--'}
              </div>
              {skewTermData.iv_rank > 0 && <div style={{ fontSize: 8, color: 'var(--muted2)' }}>IVR {skewTermData.iv_rank.toFixed(0)}</div>}
            </div>
          </div>
          <TermStructureCanvas rows={skewTermData.term_structure} atm_iv={skewTermData.atm_iv} />
          {(() => {
            const rows = skewTermData.term_structure
            if (rows.length < 2) return null
            const sorted = [...rows].filter(r => r.dte > 0 && r.vol > 0).sort((a, b) => a.dte - b.dte)
            if (sorted.length < 2) return null
            const front = sorted[0].vol
            const back  = sorted[sorted.length - 1].vol
            const slope = front > back * 1.02 ? 'BACKWARDATION' : back > front * 1.02 ? 'CONTANGO' : 'FLAT'
            const slopeColor = slope === 'BACKWARDATION' ? 'var(--red)' : slope === 'CONTANGO' ? 'var(--green)' : 'var(--yellow)'
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'var(--muted2)' }}>
                <span>Term structure: <span style={{ color: slopeColor, fontWeight: 700, fontFamily: 'var(--mono)' }}>{slope}</span></span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>
                  {sorted[0].dte}d: {front.toFixed(1)}% → {sorted[sorted.length - 1].dte}d: {back.toFixed(1)}%
                </span>
              </div>
            )
          })()}
          <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 6 }}>IV% by DTE. Backwardation = near-term fear elevated. Contango = term premium normal.</div>
        </div>
      )}

      {/* ── SPX IV Rank ── */}
      {ivRank != null && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Where current SPX implied volatility sits relative to its 52-week range. IVR 0 = lowest IV of the past year (options are cheap — consider buying). IVR 100 = highest IV of the year (options are expensive — consider selling). Above 50 = elevated relative to recent history." label="SPX IV Rank">SPX IV Rank</Tooltip></div>
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
            <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}><Tooltip tip="Risk Reversal = put IV minus call IV at the same delta. Negative = puts more expensive than calls (bearish hedging dominates, typical). Very negative = fear spike. Near zero or positive = unusual call demand.">SPX RISK REVERSAL SKEW (25Δ Put − Call)</Tooltip></div>
            <div style={{ display: 'flex', gap: 16 }}>
              {last25 != null && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--muted2)' }}>25Δ RR</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: rrColor(last25) }}>{(last25 >= 0 ? '+' : '') + last25.toFixed(2)} vol pts</div>
                </div>
              )}
              {last10 != null && (
                <div>
                  <div style={{ fontSize: 8, color: 'var(--muted2)' }}><Tooltip tip="10-delta risk reversal: IV of the 10Δ put minus 10Δ call. These are deep out-of-the-money options — this skew captures tail-risk demand specifically. Very negative = institutions are buying crash protection. Divergence from 25Δ RR can signal stress concentration.">10Δ RR</Tooltip></div>
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
          <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, marginBottom: 8 }}><Tooltip tip="Implied volatility at different expirations plotted as bars. Each bar shows IV for that specific DTE (days-to-expiration). Normal shape = longer dates have higher IV (contango). Inverted = near-term IV higher than far-term (backwardation, stress signal). Yellow dashed line = current ATM IV.">IV TERM STRUCTURE</Tooltip></div>
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
            <Tooltip tip="Compares implied volatility (what the market expects) against realized volatility (what actually happened). When IV > RV, options are expensive relative to history — premiums are rich. When IV < RV, options are cheap. IV−RV spread is the vol risk premium." label="Vol Stats — IV vs RV">Vol Stats — IV vs RV</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
            {[
              { label: 'IV',      val: volStats.iv,     color: 'var(--yellow)', tip: "Current implied volatility for SPX options. This is what the market prices in as the expected annualized move. Higher IV = more expensive options. Compare to RV to see if vol is cheap or rich." },
              { label: 'RV',      val: volStats.rv,     color: 'var(--text)',   tip: "Realized volatility — what SPX actually moved over the recent period. If IV > RV, options are pricing in more fear than what's actually happening (sellers edge). If RV > IV, market is moving more than priced (buyers edge)." },
              { label: 'IV Rank', val: volStats.iv_rank, color: 'var(--price)', tip: "IV Rank: where current IV sits within its 52-week range (0–100). 0 = cheapest IV of the year. 100 = most expensive. Above 50 = elevated relative to recent history — consider selling premium." },
              { label: 'IV−RV',   val: volStats.spread ?? (volStats.iv != null && volStats.rv != null ? (volStats.iv - volStats.rv).toFixed(1) : null), color: 'var(--text)', tip: "The volatility risk premium: how much more you pay for options (IV) vs what actually happens (RV). Positive = options are expensive. Negative = options cheap. Persistently positive is why selling vol has a long-run edge." },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted2)' }}><Tooltip tip={s.tip}>{s.label}</Tooltip></div>
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

      {/* ── Sector Options Flow ── */}
      {sectorData.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Net options premium flow per sector (calls minus puts). Shows where institutional money is positioned at the sector level. Useful for identifying rotation — sectors with strong positive flow have a vol-driven tailwind." label="Sector Options Flow">Sector Options Flow</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 8 }}>Net call − put premium per sector. Shows where institutional options money is flowing.</div>
          {sectorData.slice(0, 8).map((r: any, i: number) => {
            const flow  = r.net_flow ?? 0
            const maxF  = Math.max(...sectorData.slice(0, 8).map((x: any) => Math.abs(x.net_flow ?? 0)), 1)
            const pct   = Math.round(Math.abs(flow) / maxF * 85) + 5
            const isPos = flow >= 0
            const fmtFlow = (v: number) => {
              const a = Math.abs(v)
              return (v >= 0 ? '+' : '-') + (a >= 1e9 ? (a / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(0) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(0) + 'K' : a.toFixed(0))
            }
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', minWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.sector}
                </span>
                <div style={{ flex: 1, height: 7, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isPos ? 'var(--green)' : 'var(--red)', borderRadius: 3, opacity: 0.8 }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)', minWidth: 48, textAlign: 'right' }}>
                  {fmtFlow(flow)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Volatility Anomaly / Character / VRP ── */}
      {volAnomalyData && (
        <div className="panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Advanced volatility regime signals from Unusual Whales. Anomaly Score flags when IV is behaving unusually vs history. Character classifies whether vol is trending or mean-reverting. VRP (Variance Risk Premium) measures how much options sellers are being paid above realized vol." label="Vol Anomaly & VRP">Vol Anomaly &amp; VRP</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
          </div>
          {(() => {
            const spxData = volAnomalyData?.tickers?.SPX || volAnomalyData?.tickers?.SPXW || {}
            const anomaly  = spxData.anomaly  || {}
            const char_    = spxData.character || {}
            const vrp      = spxData.vrp       || {}
            const anomScore = parseFloat(anomaly.score ?? anomaly.anomaly_score ?? '0') || 0
            const charLabel = char_.character || char_.regime || '--'
            const vrpVal    = parseFloat(vrp.vrp ?? vrp.variance_risk_premium ?? '0') || 0
            const anomColor = anomScore > 0.7 ? 'var(--red)' : anomScore > 0.4 ? 'var(--yellow)' : 'var(--green)'
            const vrpColor  = vrpVal > 3 ? 'var(--green)' : vrpVal < -1 ? 'var(--red)' : 'var(--muted2)'
            const charColor = charLabel.toLowerCase().includes('trend') ? 'var(--yellow)' : charLabel.toLowerCase().includes('mean') ? 'var(--green)' : 'var(--muted2)'
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 5, padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 4 }}>
                    <Tooltip tip="Volatility Anomaly Score (0–1). High score means current IV behavior is statistically unusual relative to historical norms. Above 0.7 = significant anomaly worth noting.">ANOMALY SCORE</Tooltip>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: anomColor }}>
                    {anomScore > 0 ? anomScore.toFixed(2) : '--'}
                  </div>
                  <div style={{ fontSize: 9, color: anomColor, marginTop: 2 }}>
                    {anomScore > 0.7 ? 'HIGH ANOMALY' : anomScore > 0.4 ? 'ELEVATED' : anomScore > 0 ? 'NORMAL' : '--'}
                  </div>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 5, padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 4 }}>
                    <Tooltip tip="Volatility Character: whether vol is TRENDING (rising/falling persistently), MEAN-REVERTING (bouncing around a stable level), or in a BREAKOUT regime. Trending vol calls for momentum strategies; mean-reverting vol favors selling premium.">VOL CHARACTER</Tooltip>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: charColor, lineHeight: 1.3 }}>
                    {charLabel !== '--' ? charLabel.toUpperCase() : '--'}
                  </div>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 5, padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 4 }}>
                    <Tooltip tip="Variance Risk Premium (VRP) = Implied Vol minus Realized Vol. Positive VRP means options are expensive — sellers collect a premium above actual moves. Negative VRP means options are cheap relative to realized vol — buyers have an edge.">VRP</Tooltip>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: vrpColor }}>
                    {vrpVal !== 0 ? (vrpVal > 0 ? '+' : '') + vrpVal.toFixed(1) : '--'}
                  </div>
                  <div style={{ fontSize: 9, color: vrpColor, marginTop: 2 }}>
                    {vrpVal > 3 ? 'SELL VOL' : vrpVal > 0 ? 'VOL RICH' : vrpVal < -1 ? 'BUY VOL' : vrpVal < 0 ? 'VOL CHEAP' : '--'}
                  </div>
                </div>
              </div>
            )
          })()}
          {/* Top anomalies list */}
          {volAnomalyData?.top_anomaly?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted2)', marginBottom: 5 }}>TOP VOL ANOMALIES</div>
              {(volAnomalyData.top_anomaly as any[]).slice(0, 5).map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.ticker}</span>
                  <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{r.character || r.regime || ''}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: parseFloat(r.score ?? '0') > 0.7 ? 'var(--red)' : 'var(--yellow)' }}>
                    {parseFloat(r.score ?? '0').toFixed(2)}
                  </span>
                </div>
              ))}
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
