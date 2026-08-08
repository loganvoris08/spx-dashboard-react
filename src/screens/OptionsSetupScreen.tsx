import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLiveFutures } from '../lib/LiveFuturesContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const CALL_CHECKS = [
  'Negative Gamma regime', 'Price above VWAP', 'Opening Range break (above ORH)',
  'Higher highs / higher lows', 'Large call sweeps (ask-side)', 'Positive / bullish delta flow',
  'Dealer pressure bullish', 'VIX falling or flat', 'Breadth >80% bullish',
  'SPX + NDX confirming higher', 'No major resistance within 15-20 pts',
]
const PUT_CHECKS = [
  'Negative Gamma regime', 'Price below VWAP', 'Failed VWAP reclaim',
  'Lower highs / lower lows', 'Large put sweeps (ask-side)', 'Negative / bearish delta flow',
  'Rising VIX', 'Dealer pressure bearish', 'Weak breadth (<30%)',
  'SPX + NDX confirming lower', 'Room to next put wall (>15 pts)',
]
const SUB_ORDER = [
  { key: 'dealer',    label: 'Dealer Positioning',  weight: '20%' },
  { key: 'flow',      label: 'Order Flow',           weight: '20%' },
  { key: 'technical', label: 'Technical Structure',  weight: '20%' },
  { key: 'breadth',   label: 'Market Breadth',       weight: '15%' },
  { key: 'regime',    label: 'Market Regime',        weight: '10%' },
  { key: 'macro',     label: 'Macro',                weight: '5%'  },
  { key: 'liquidity', label: 'Liquidity',            weight: '5%'  },
  { key: 'risk',      label: 'Risk Engine',          weight: '—'   },
]
const LOADING_STEPS = [
  'Assembling market data', 'Fetching Polygon intraday bars',
  'Running Market Regime analysis', 'Running Order Flow analysis',
  'Running Market Breadth analysis', 'Running Technical Structure analysis',
  'Running Dealer Positioning analysis', 'Running Liquidity analysis',
  'Running Macro analysis', 'Running Risk Engine analysis',
  'Running Master Grade prompt…', 'Finalizing grades',
]

function gradeColor(g: string) {
  if (g === 'A+') return 'var(--green)'
  if (g === 'A')  return '#22c55e'
  if (g === 'B')  return 'var(--yellow)'
  if (g === 'C')  return '#f97316'
  return '#ef4444'
}
function scoreColor(s: number) {
  return s >= 75 ? 'var(--green)' : s >= 45 ? 'var(--yellow)' : 'var(--red)'
}
function recColor(r: string) {
  const u = (r || '').toUpperCase()
  if (u.includes('TAKE')) return { bg: 'rgba(0,255,136,.12)', color: 'var(--green)', border: 'rgba(0,255,136,.25)' }
  if (u.includes('DO NOT') || u.includes('SKIP')) return { bg: 'rgba(255,51,68,.12)', color: 'var(--red)', border: 'rgba(255,51,68,.25)' }
  return { bg: 'rgba(255,215,0,.1)', color: 'var(--yellow)', border: 'rgba(255,215,0,.2)' }
}
function pillColor(val: string) {
  const v = (val || '').toLowerCase()
  if (v.includes('bull') || v.includes('strong') || v === 'yes' || v === 'low') return { bg: 'rgba(0,255,136,.1)', color: 'var(--green)', border: 'rgba(0,255,136,.2)' }
  if (v.includes('bear') || v.includes('weak') || v === 'no' || v === 'high') return { bg: 'rgba(255,51,68,.1)', color: 'var(--red)', border: 'rgba(255,51,68,.2)' }
  return { bg: 'rgba(136,136,136,.1)', color: 'var(--muted2)', border: 'var(--border)' }
}
function flowCls(s: string) {
  const v = (s || '').toLowerCase()
  return v.includes('bull') ? 'var(--green)' : v.includes('bear') ? 'var(--red)' : 'var(--muted2)'
}
function pctCls(n: number) {
  return n > 0.15 ? 'var(--green)' : n < -0.15 ? 'var(--red)' : 'var(--yellow)'
}

function Chip({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border2)', color: color ?? 'var(--muted2)', whiteSpace: 'nowrap' }}>
      {label}: <b style={{ color: color ?? 'var(--text)' }}>{val}</b>
    </div>
  )
}

function SubItem({ sub, item }: { sub: any; item: typeof SUB_ORDER[0] }) {
  const [open, setOpen] = useState(false)
  const score = sub?.score ?? 50
  const barColor = score >= 75 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>
          {item.label}
          <span style={{ fontSize: 9, color: 'var(--muted2)', marginLeft: 5 }}>{item.weight}</span>
        </div>
        <div style={{ width: 80, height: 5, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: barColor, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right', color: scoreColor(score) }}>{score}</div>
        <div style={{ fontSize: 10, color: 'var(--muted2)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</div>
      </div>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {sub?.summary && <div style={{ fontSize: 10, lineHeight: 1.6, color: 'var(--muted2)', marginTop: 10 }}>{sub.summary}</div>}
          {sub?.key_factors?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {sub.key_factors.map((f: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--muted2)', padding: '3px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--border2)' }}>•</span>{f}
                </div>
              ))}
            </div>
          )}
          {/* Sub-specific extras */}
          <SubExtras sk={item.key} sub={sub} />
        </div>
      )}
    </div>
  )
}

function SubExtras({ sk, sub }: { sk: string; sub: any }) {
  const parts: [string, string][] = []
  if (sk === 'regime') {
    if (sub.regime) parts.push(['Regime', sub.regime])
    if (sub.confidence_bullish != null) parts.push(['Bull Conf', sub.confidence_bullish + '%'])
    if (sub.confidence_bearish != null) parts.push(['Bear Conf', sub.confidence_bearish + '%'])
    if (sub.confidence_trend   != null) parts.push(['Trend Conf', sub.confidence_trend + '%'])
  }
  if (sk === 'flow') {
    if (sub.bull_score  != null) parts.push(['Bull Score', String(sub.bull_score)])
    if (sub.bear_score  != null) parts.push(['Bear Score', String(sub.bear_score)])
    if (sub.dominant_side)       parts.push(['Dominant', sub.dominant_side])
    parts.push(['Sweeps', sub.sweeps_present ? 'YES' : 'NO'])
    parts.push(['Repeated Buyers', sub.repeated_buyers ? 'YES' : 'NO'])
  }
  if (sk === 'breadth') {
    if (sub.health)      parts.push(['Health', sub.health])
    if (sub.breadth_pct != null) parts.push(['Est Breadth', sub.breadth_pct + '%'])
    if (sub.sector_bias) parts.push(['Sector Bias', sub.sector_bias])
  }
  if (sk === 'technical') {
    if (sub.trend_direction) parts.push(['Direction', sub.trend_direction])
    if (sub.vwap_verdict)    parts.push(['VWAP', sub.vwap_verdict])
    if (sub.trend_continuation_prob != null) parts.push(['Continuation', sub.trend_continuation_prob + '%'])
    if (sub.reversal_prob != null)           parts.push(['Reversal', sub.reversal_prob + '%'])
  }
  if (sk === 'dealer') {
    if (sub.dealer_hedging_direction) parts.push(['Hedging Dir', sub.dealer_hedging_direction])
    if (sub.acceleration_prob != null) parts.push(['Accel Prob', sub.acceleration_prob + '%'])
    if (sub.pin_prob != null)          parts.push(['Pin Prob', sub.pin_prob + '%'])
    if (sub.nearest_magnet)            parts.push(['Nearest Magnet', sub.nearest_magnet])
  }
  if (sk === 'liquidity') {
    if (sub.highest_prob_target) parts.push(['Target', sub.highest_prob_target])
    if (sub.target_direction)    parts.push(['Direction', sub.target_direction])
    if (sub.buy_side_levels?.length)  parts.push(['Buy Side', sub.buy_side_levels.join(', ')])
    if (sub.sell_side_levels?.length) parts.push(['Sell Side', sub.sell_side_levels.join(', ')])
  }
  if (sk === 'macro') {
    if (sub.vol_expectation) parts.push(['Vol Expect', sub.vol_expectation])
    if (sub.event_risk)      parts.push(['Event Risk', sub.event_risk])
    if (sub.confidence != null) parts.push(['Confidence', sub.confidence + '%'])
  }
  if (sk === 'risk') {
    if (sub.best_call_strike) parts.push(['Best Call', sub.best_call_strike + ' (Δ' + sub.best_delta_call + ')'])
    if (sub.best_put_strike)  parts.push(['Best Put',  sub.best_put_strike  + ' (Δ' + sub.best_delta_put  + ')'])
    if (sub.expected_move_pts != null) parts.push(['Exp Move', '±' + sub.expected_move_pts + ' pts'])
    if (sub.call_win_pct != null) parts.push(['Call Win%', sub.call_win_pct + '%'])
    if (sub.put_win_pct  != null) parts.push(['Put Win%',  sub.put_win_pct  + '%'])
    if (sub.call_rr)  parts.push(['Call R/R', '1:' + sub.call_rr])
    if (sub.put_rr)   parts.push(['Put R/R',  '1:' + sub.put_rr])
  }
  if (!parts.length) return null
  return (
    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {parts.map(([k, v], i) => (
        <div key={i} style={{ fontSize: 9, color: 'var(--muted2)' }}>{k}: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span></div>
      ))}
    </div>
  )
}

export default function OptionsSetupScreen() {
  const { data } = useDashboard()
  const { esVwap, connected: futConnected } = useLiveFutures()
  const [snapOpen,    setSnapOpen]    = useState(true)
  const [snapshot,    setSnapshot]    = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [loadStep,    setLoadStep]    = useState(0)
  const [result,      setResult]      = useState<any>(null)
  const [error,       setError]       = useState('')
  const [lastRun,     setLastRun]     = useState('')
  const [session,     setSession]     = useState('—')
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load live snapshot data
  const loadSnapshot = useCallback(async () => {
    try { setSnapshot(await apiFetch('/api/trade-grade/snapshot')) } catch {}
  }, [])

  useEffect(() => {
    loadSnapshot()
  }, [loadSnapshot])

  // Compute session badge from current ET time
  useEffect(() => {
    const now = new Date()
    const mo = now.getUTCMonth()
    const isDST = mo >= 2 && mo <= 10
    const etH = (now.getUTCHours() + (isDST ? -4 : -5) + 24) % 24
    const mins = etH * 60 + now.getUTCMinutes()
    const dow = now.getDay()
    if (dow === 0 || dow === 6)      setSession('CLOSED (Weekend)')
    else if (mins < 570)             setSession('PRE-MARKET')
    else if (mins < 600)             setSession('RTH OPEN')
    else if (mins < 720)             setSession('MORNING')
    else if (mins < 840)             setSession('LUNCH')
    else if (mins < 930)             setSession('AFTERNOON')
    else if (mins < 960)             setSession('POWER HOUR')
    else if (mins < 1200)            setSession('AFTER-HOURS')
    else                             setSession('CLOSED')
  }, [])

  async function runAnalysis() {
    setLoading(true)
    setResult(null)
    setError('')
    setLoadStep(0)
    stepTimer.current = setInterval(() => setLoadStep(s => (s + 1) % LOADING_STEPS.length), 1800)
    try {
      const d = await apiFetch('/api/trade-grade', { method: 'POST', body: '{}' })
      clearInterval(stepTimer.current!)
      if (!d.ok) { setError(d.error || 'Analysis failed'); return }
      setResult(d)
      setLastRun('Last run: ' + (d.timestamp || ''))
      if (d.session) setSession(d.session)
    } catch (e: any) {
      clearInterval(stepTimer.current!)
      setError('Network error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const d = data ?? {}
  const snap = snapshot ?? {}
  const spx = d.spx ?? '—'
  const prevClose = parseFloat(String(d.prev_close ?? '').replace(/,/g,'')) || 0
  const spxNum = parseFloat(String(d.spx ?? '').replace(/,/g,'')) || 0
  const spxChg = spxNum > 0 && prevClose > 0 ? spxNum - prevClose : null
  const spxPct = spxChg != null && prevClose > 0 ? spxChg / prevClose * 100 : null
  const vixNum = parseFloat(String(d.vix ?? '')) || 0
  const vixColor = vixNum >= 20 ? 'var(--red)' : vixNum >= 15 ? 'var(--yellow)' : 'var(--green)'
  const vixPrevClose = parseFloat(String(d.vix_prev_close ?? '')) || 0
  const vixChg = vixNum > 0 && vixPrevClose > 0 ? vixNum - vixPrevClose : null
  const basis = parseFloat(String(d.es_basis ?? '')) || 0

  return (
    <>
      {/* ── Market Snapshot ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
        <div onClick={() => setSnapOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted2)', flex: 1 }}>Market Snapshot</span>
          <span style={{ fontSize: 9, color: 'var(--muted2)' }}>{d.last_update ?? ''}</span>
          <span style={{ fontSize: 11, color: 'var(--muted2)', transition: 'transform .2s', transform: snapOpen ? 'none' : 'rotate(-90deg)' }}>▾</span>
        </div>
        {snapOpen && (
          <div style={{ padding: '2px 12px 12px' }}>
            {/* Price row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: '8px 0' }}>
              {[
                { label: 'SPX', val: String(spx), sub: spxChg != null ? `${spxChg >= 0 ? '+' : ''}${spxChg.toFixed(1)} (${spxPct!.toFixed(2)}%)` : '—', subColor: spxChg != null ? (spxChg >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--muted2)' },
                { label: 'VIX', val: String(d.vix ?? '—'), sub: vixChg != null ? `${vixChg >= 0 ? '+' : ''}${vixChg.toFixed(2)} (${(vixChg / vixPrevClose * 100).toFixed(2)}%)` : '—', subColor: vixChg != null ? (vixChg >= 0 ? 'var(--red)' : 'var(--green)') : 'var(--muted2)', valColor: vixColor },
                { label: 'ES Basis', val: `${basis >= 0 ? '+' : ''}${basis.toFixed(1)}`, sub: `ES ${d.es ?? '—'}`, subColor: 'var(--muted2)', valColor: basis > 3 ? 'var(--green)' : basis < -3 ? 'var(--red)' : 'var(--text)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ fontSize: 8, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: s.valColor ?? 'var(--text)' }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: s.subColor, marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Dealer / GEX chips */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0 0' }}>
              <div style={{ fontSize: 8, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>Dealer / GEX</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <Chip label="Gamma Regime" val={String(d.uw_gamma_regime ?? '—')} color={(() => { const r = String(d.uw_gamma_regime ?? '').toLowerCase(); return r.includes('neg') ? 'var(--red)' : r.includes('pos') ? 'var(--green)' : 'var(--yellow)' })()} />
                <Chip label="Flip" val={String(d.gex_flip_zone ?? '—')} />
                <Chip label="Call Wall" val={String(d.nearest_call_wall ?? '—')} color="var(--red)" />
                <Chip label="Put Wall" val={String(d.nearest_put_wall ?? '—')} color="var(--green)" />
                <Chip label="Dealer" val={String(d.delta_hedging_pressure ?? '—')} color={(() => { const v = String(d.delta_hedging_pressure ?? '').toUpperCase(); return v === 'BULLISH' ? 'var(--green)' : v === 'BEARISH' ? 'var(--red)' : 'var(--muted2)' })()} />
              </div>
            </div>

            {/* Options Flow chips */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0 0', marginTop: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>Options Flow</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <Chip label="Flow" val={String(d.flow_state ?? '—')} color={flowCls(String(d.flow_state ?? ''))} />
                <Chip label="Calls" val={`${parseFloat(String(d.flow_call_pct ?? 50)).toFixed(0)}%`} color={parseFloat(String(d.flow_call_pct ?? 50)) > 55 ? 'var(--green)' : parseFloat(String(d.flow_call_pct ?? 50)) < 45 ? 'var(--red)' : undefined} />
                <Chip label="Puts" val={`${parseFloat(String(d.flow_put_pct ?? 50)).toFixed(0)}%`} color={parseFloat(String(d.flow_put_pct ?? 50)) > 55 ? 'var(--red)' : parseFloat(String(d.flow_put_pct ?? 50)) < 45 ? 'var(--green)' : undefined} />
                {d.put_call_ratio && <Chip label="PCR" val={parseFloat(String(d.put_call_ratio)).toFixed(2)} color={parseFloat(String(d.put_call_ratio)) > 1.2 ? 'var(--red)' : parseFloat(String(d.put_call_ratio)) < 0.7 ? 'var(--green)' : undefined} />}
                {d.skew && <Chip label="Skew" val={`${parseFloat(String(d.skew)).toFixed(1)} pts`} color={parseFloat(String(d.skew)) > 8 ? 'var(--red)' : undefined} />}
              </div>
            </div>

            {/* Technical */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0 0', marginTop: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>
                Technical {!snap.vwap && <span style={{ fontWeight: 400, opacity: .6, textTransform: 'none' }}>• loading…</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {snap.vwap && <Chip label="VWAP" val={`${snap.vwap}${snap.vwap_dist != null ? ` (${snap.vwap_dist >= 0 ? '+' : ''}${snap.vwap_dist}pts)` : ''}`} color={snap.price_vs_vwap?.includes('ABOVE') ? 'var(--green)' : snap.price_vs_vwap?.includes('BELOW') ? 'var(--red)' : undefined} />}
                {esVwap != null && (
                  <Chip
                    label="ES VWAP"
                    val={esVwap.toFixed(2) + (futConnected ? ' ●' : '')}
                    color={futConnected ? 'var(--green)' : 'var(--muted2)'}
                  />
                )}}
                {snap.or_high && <Chip label="OR" val={snap.price_vs_or ?? '—'} color={snap.price_vs_or?.includes('ABOVE') ? 'var(--green)' : snap.price_vs_or?.includes('BELOW') ? 'var(--red)' : undefined} />}
                {snap.pdh && <Chip label="PDH" val={String(snap.pdh)} />}
                {snap.pdl && <Chip label="PDL" val={String(snap.pdl)} />}
                {snap.ema9  && <Chip label="EMA9"  val={String(snap.ema9)}  />}
                {snap.ema20 && <Chip label="EMA20" val={String(snap.ema20)} />}
                {snap.ema50 && <Chip label="EMA50" val={String(snap.ema50)} />}
                {snap.atr   && <Chip label="ATR"   val={String(snap.atr)}   />}
              </div>
              {snap.trend_structure && <div style={{ fontSize: 9, color: 'var(--muted2)', padding: '2px 0 6px' }}>{snap.trend_structure}</div>}
            </div>

            {/* Breadth */}
            {(snap.spx_chg != null || snap.ndx_chg != null) && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0 0', marginTop: 4 }}>
                <div style={{ fontSize: 8, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>Breadth</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {snap.spx_chg != null && <Chip label="SPX" val={`${snap.spx_chg >= 0 ? '+' : ''}${snap.spx_chg.toFixed(2)}%`} color={pctCls(snap.spx_chg)} />}
                  {snap.ndx_chg != null && <Chip label="NDX" val={`${snap.ndx_chg >= 0 ? '+' : ''}${snap.ndx_chg.toFixed(2)}%`} color={pctCls(snap.ndx_chg)} />}
                  {snap.rut_chg != null && <Chip label="RUT" val={`${snap.rut_chg >= 0 ? '+' : ''}${snap.rut_chg.toFixed(2)}%`} color={pctCls(snap.rut_chg)} />}
                </div>
              </div>
            )}

            {/* Macro */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0 0', marginTop: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>Macro / Calendar</div>
              {snap.fomc_text && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>{snap.fomc_text}</div>}
              {snap.gap_fill && <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 2 }}>{snap.gap_fill}</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Run Button ── */}
      <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{ background: 'var(--green)', color: '#000', border: 'none', fontSize: 12, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '13px 40px', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? '⟳ Analyzing…' : '▶ Run Analysis'}
        </button>
        <div style={{ display: 'inline-block', marginLeft: 10, marginTop: 8, fontSize: 9, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted2)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>{session}</div>
        {lastRun && <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 6 }}>{lastRun}</div>}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border2)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 11, color: 'var(--muted2)', letterSpacing: '.5px' }}>Running 8-prompt AI analysis…</div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 6 }}>{LOADING_STEPS[loadStep]}</div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ background: 'rgba(255,51,68,.08)', border: '1px solid rgba(255,51,68,.2)', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 11, color: 'var(--red)' }}>{error}</div>
      )}

      {/* ── Results ── */}
      {result && (() => {
        const g = result.grade
        const subs = result.subs || {}
        const hist = result.historical

        return (
          <>
            {/* Grade cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { type: 'CALL', grade: g.call_grade, score: g.call_score, conf: g.call_confidence, rec: g.call_recommendation, win: g.call_est_win_pct, hf: g.hedge_fund_call, borderColor: 'rgba(0,255,136,.18)' },
                { type: 'PUT',  grade: g.put_grade,  score: g.put_score,  conf: g.put_confidence,  rec: g.put_recommendation,  win: g.put_est_win_pct,  hf: g.hedge_fund_put,  borderColor: 'rgba(255,51,68,.18)'  },
              ].map(c => {
                const rc = recColor(c.rec)
                return (
                  <div key={c.type} style={{ background: 'var(--panel)', border: `1px solid ${c.borderColor}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, color: c.type === 'CALL' ? 'var(--green)' : 'var(--red)' }}>{c.type} Grade</div>
                    <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: gradeColor(c.grade) }}>{c.grade}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--muted2)' }}>{c.score} / 100</div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 6 }}>Confidence {c.conf}%</div>
                    <div style={{ marginTop: 12, fontSize: 10, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', padding: '7px 10px', borderRadius: 7, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>{c.rec || 'WAIT'}</div>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: 'var(--muted2)' }}>
                      <div>Win Est<br /><span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.win ?? '?'}%</span></div>
                      <div>HF Trade<br /><span style={{ color: c.hf === 'YES' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{c.hf ?? '?'}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Would you wait? */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Would you wait? (Call)', val: g.would_wait_call },
                { label: 'Would you wait? (Put)',  val: g.would_wait_put  },
              ].map(w => (
                <div key={w.label} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>{w.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: w.val === 'YES' ? 'var(--yellow)' : 'var(--green)' }}>{w.val ?? '?'}</div>
                </div>
              ))}
            </div>

            {/* Why Not A+? */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 10 }}>Why Not A+?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Call Checklist', color: 'var(--green)', missing: g.call_missing_for_aplus ?? [], isAplus: g.call_grade === 'A+', checks: CALL_CHECKS },
                  { label: 'Put Checklist',  color: 'var(--red)',   missing: g.put_missing_for_aplus  ?? [], isAplus: g.put_grade  === 'A+', checks: PUT_CHECKS  },
                ].map(side => (
                  <div key={side.label}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: side.color, marginBottom: 6 }}>{side.label}</div>
                    {side.isAplus && side.missing.length === 0 ? (
                      <div style={{ fontSize: 10, color: 'var(--green)' }}>✅ All conditions met — A+ setup!</div>
                    ) : side.missing.length > 0 ? (
                      <>
                        {side.missing.map((m: string, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10, color: '#999', marginBottom: 4, lineHeight: 1.4 }}><span>❌</span>{m}</div>
                        ))}
                        {side.checks.length - side.missing.length > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 4 }}>+{side.checks.length - side.missing.length} conditions met</div>
                        )}
                      </>
                    ) : (
                      side.checks.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10, color: '#333', marginBottom: 4, lineHeight: 1.4 }}><span>✅</span>{c}</div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Context */}
            {hist && (
              <div style={{ background: 'var(--panel)', border: '1px solid rgba(99,102,241,.25)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(99,102,241,.8)', marginBottom: 8 }}>Historical Context</div>
                {hist.building || (hist.n ?? 0) < 5 ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 4 }}>Building data... ({hist.n || 0}/5 runs collected for this setup type)</div>
                    <div style={{ fontSize: 9, color: 'var(--muted2)' }}>Outcomes logged automatically +30/+60/+120min after each analysis.</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 10 }}>{hist.n} similar setups — {hist.gamma} gamma · {hist.vwap_side} VWAP · VIX {hist.vix_dir}</div>
                    <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
                      {[
                        { val: `${hist.up_pct}%`,  lbl: 'UP',   color: 'var(--green)' },
                        { val: `${hist.down_pct}%`, lbl: 'DOWN', color: 'var(--red)' },
                        { val: `${hist.flat_pct}%`, lbl: 'FLAT', color: 'var(--muted2)' },
                        { val: `${hist.avg_move >= 0 ? '+' : ''}${hist.avg_move}pts`, lbl: 'AVG 60min', color: hist.avg_move > 1 ? 'var(--green)' : hist.avg_move < -1 ? 'var(--red)' : 'var(--muted2)' },
                      ].map((s, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: 'rgba(255,255,255,.03)', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</span>
                          <span style={{ display: 'block', fontSize: 8, color: 'var(--muted2)', marginTop: 2, letterSpacing: '.5px', textTransform: 'uppercase' }}>{s.lbl}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI Market Read */}
            {g.explanation && (
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>AI Market Read</div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text)' }}>{g.explanation}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {[
                    g.regime           && { label: g.regime },
                    g.dealer_direction && { label: `Dealer: ${g.dealer_direction}` },
                    g.flow_direction   && { label: `Flow: ${g.flow_direction}` },
                    g.breadth          && { label: `Breadth: ${g.breadth}` },
                    g.risk_level       && { label: `Risk: ${g.risk_level}` },
                  ].filter(Boolean).map((p: any, i: number) => {
                    const pc = pillColor(p.label)
                    return (
                      <div key={i} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.6px', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{p.label}</div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sub-Analysis Accordion */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>Sub-Analysis Breakdown</div>
            {SUB_ORDER.map(item => (
              <SubItem key={item.key} sub={subs[item.key]} item={item} />
            ))}
            <div style={{ height: 40 }} />
          </>
        )
      })()}
    </>
  )
}
