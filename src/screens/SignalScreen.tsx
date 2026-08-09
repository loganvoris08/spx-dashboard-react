import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
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

function sigClass(s?: string) {
  if (!s) return 'wait'
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))   return 'long'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'short'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'watch'
  return 'wait'
}


function fmtN(v: any, d = 0) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Row({ label, value, col }: { label: string; value: any; col?: string }) {
  return (
    <div className="td-row">
      <div className="td-label">{label}</div>
      <div className="td-val" style={{ color: col }}>{value ?? '--'}</div>
    </div>
  )
}

function ZoneBox({ label, bot, top, mid, state, pct, nextBot, nextTop, prevBot, prevTop }: {
  label: string; bot?: number; top?: number; mid?: number; state?: string; pct?: number
  nextBot?: number; nextTop?: number; prevBot?: number; prevTop?: number
}) {
  if (!bot && !top) return null
  const fmtRange = (b?: number, t?: number) => b != null && t != null ? `${fmtN(b, 2)} – ${fmtN(t, 2)}` : b != null ? fmtN(b, 2) : '--'
  return (
    <div className="zone-status-box">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div className="zone-state-label">{state ?? label}</div>
        {pct != null && <div style={{ fontSize: 9, color: 'var(--muted2)' }}>{pct.toFixed(1)}% through zone</div>}
      </div>
      <div className="zone-levels">
        {bot  != null && <div className="zl"><div className="zl-label"><Tooltip tip="Lower boundary of the current price zone. Price tends to find support here as dealers re-hedge their gamma exposure near this level.">Zone Bot</Tooltip></div><div className="zl-val">{fmtN(bot, 2)}</div></div>}
        {top  != null && <div className="zl"><div className="zl-label"><Tooltip tip="Upper boundary of the current price zone. Price often meets resistance or pauses here as dealers sell to stay delta-neutral.">Zone Top</Tooltip></div><div className="zl-val">{fmtN(top, 2)}</div></div>}
        {mid  != null && <div className="zl"><div className="zl-label"><Tooltip tip="Midpoint of the current zone. Acts as intrazone support or resistance — price often consolidates here before committing to bot or top.">Mid</Tooltip></div><div className="zl-val">{fmtN(mid, 2)}</div></div>}
        {prevBot != null && <div className="zl"><div className="zl-label"><Tooltip tip="The zone directly below current price. If price breaks under Zone Bot, this is the next target range to the downside.">Prev Zone</Tooltip></div><div className="zl-val put">{fmtRange(prevBot, prevTop)}</div></div>}
        {nextBot != null && <div className="zl"><div className="zl-label"><Tooltip tip="The zone directly above current price. If price breaks above Zone Top, this is the next target range to the upside.">Next Zone</Tooltip></div><div className="zl-val call">{fmtRange(nextBot, nextTop)}</div></div>}
      </div>
    </div>
  )
}

export default function SignalScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const { on }   = useSSE()
  const isNdx = side === 'ndx'

  const [patternData, setPatternData] = useState<any>(null)

  const loadPattern = useCallback(async () => {
    try { setPatternData(await apiFetch('/api/pattern-match')) } catch {}
  }, [])

  useEffect(() => {
    loadPattern()
    const off = on('update', loadPattern)
    return off
  }, [loadPattern, on])

  const signal    = data?.signal ?? 'WAIT'
  const score     = data?.score
  const maxScore  = data?.max_score
  const quality   = data?.setup_quality
  const entry     = data?.entry
  const target    = data?.target
  const stopLogic = data?.stop_logic
  const reason    = data?.reason
  const aiRead    = data?.ai_read
  const session   = data?.session
  const swing     = data?.swing_signal?.signal ?? data?.swing_history?.[0]?.signal

  const cls   = sigClass(signal)
  const swCls = sigClass(swing)

  // Session stats — session_stats is a nested object
  const ss         = data?.session_stats ?? {}
  const prevClose  = ss.prev_close  ?? data?.prev_close  ?? data?.previous_close
  const dayOpen    = ss.day_open    ?? data?.daily_open  ?? data?.day_open
  const gap        = ss.gap         ?? data?.open_gap    ?? data?.gap
  const dayHigh    = ss.day_high    ?? data?.day_high
  const dayLow     = ss.day_low     ?? data?.day_low
  const dayRange   = ss.range       ?? data?.day_range

  // Market context
  const vix9d      = data?.vix9d
  const vix        = data?.vix
  const vix3m      = data?.vix3m
  const implPts    = data?.implied_weekly_move  ?? data?.implied_move_pts
  const implPct    = data?.implied_weekly_pct   ?? data?.implied_move_pct
  const esBasis    = data?.es_basis
  const esBasisLbl = data?.es_basis_label
  const volSkew    = data?.skew ?? data?.vol_skew
  const volSkewLbl = data?.skew_label ?? data?.vol_skew_label

  // Zone data — next/prev are bot–top ranges
  const es10Bot     = data?.es_10m_zone_bot
  const es10Top     = data?.es_10m_zone_top
  const es10Mid     = data?.es_10m_zone_mid
  const es10State   = data?.es_10m_zone_state
  const es10Pct     = data?.es_10m_zone_pct
  const es10NextBot = data?.es_10m_zone_next_bot
  const es10NextTop = data?.es_10m_zone_next_top
  const es10PrevBot = data?.es_10m_zone_prev_bot
  const es10PrevTop = data?.es_10m_zone_prev_top

  const esDBot      = data?.es_d_zone_bot
  const esDTop      = data?.es_d_zone_top
  const esDMid      = data?.es_d_zone_mid
  const esDState    = data?.es_d_zone_state
  const esDPct      = data?.es_d_zone_pct
  const esDNextBot  = data?.es_d_zone_next_bot
  const esDNextTop  = data?.es_d_zone_next_top
  const esDPrevBot  = data?.es_d_zone_prev_bot
  const esDPrevTop  = data?.es_d_zone_prev_top

  const spxBot    = data?.spx_zone_bot
  const spxTop    = data?.spx_zone_top
  const spxState  = data?.spx_zone_state

  const swingSignal = data?.swing_signal

  const marketState = [
    { label: 'Mode',      tip: 'Overall market mode combining GEX regime, flow bias, and volatility. TRENDING = directional, RANGING = mean-reverting, PINNED = stuck near a GEX magnet.',   value: data?.market_mode ?? data?.mode },
    { label: 'Break',     tip: 'Whether price has confirmed a structural break above or below a key level. BREAK_UP = bullish, BREAK_DOWN = bearish, NONE = inside range.',                   value: data?.break_state },
    { label: 'Bias',      tip: 'Overall directional bias combining GEX regime, flow, and zone location. BULLISH/BEARISH = clear lean. NEUTRAL = conflicting signals, reduce size.',           value: data?.bias },
    { label: 'Day Bias',  tip: 'Intraday directional lean based on the opening gap, session flow, and GEX. Resets each morning. Use for same-day trade direction, not multi-day.',           value: data?.day_bias },
    { label: 'Flow',      tip: 'Net options flow bias for the session. CALL_DOMINANT = more call premium paid (bullish lean). PUT_DOMINANT = more put premium paid (hedging/bearish lean).',  value: data?.flow_state },
    { label: 'Gamma',     tip: 'Current gamma regime from GEX analysis. POSITIVE = dealers stabilize price near key strikes. NEGATIVE = dealers amplify moves away from flip zone.',          value: data?.gamma_state },
    { label: 'OI State',  tip: 'Where the heavy open interest concentration sits relative to current price. ABOVE = OI resistance overhead. BELOW = OI support beneath. PINNED = price near max OI.', value: data?.oi_state },
    { label: 'Trap',      tip: 'Potential bull or bear trap detected — a false breakout that is likely to reverse. Traps often occur at key OI or GEX levels where liquidity is thin above/below.', value: data?.trap_state !== 'None' ? data?.trap_state : null },
    { label: 'Price Loc', tip: 'Price location relative to key GEX levels. ABOVE_CALL_WALL = above resistance. BELOW_PUT_WALL = below support. BETWEEN = inside the range defined by call and put walls.', value: data?.price_location_state },
  ].filter(r => r.value)

  const hasSessionStats = prevClose || dayOpen || gap || dayHigh || dayLow || dayRange
  const hasMarketCtx    = vix9d || vix || vix3m || implPts || esBasis || volSkew

  return (
    <>
      {/* ── Signal Banner (tab-level) ── */}
      <div className="signal-banner" style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <div className={`sb-pill ${cls}`}>{signal}</div>
        {session && <div className="sb-session">{session.toUpperCase()}</div>}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {entry  && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green)' }}>{entry}</div>}
          {target && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--yellow)' }}>{target}</div>}
          {score != null && maxScore != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="sb-score-text">{quality ?? `${score}/${maxScore}`}</span>
              <div className="sb-bar-track">
                <div className="sb-bar-fill" style={{ width: `${Math.round((score / maxScore) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {swing && !swing.includes('NO ') && (
          <div className={`sb-swing ${swCls}`}>{swing}</div>
        )}
      </div>

      {/* ── Session Stats Bar ── */}
      {hasSessionStats && (
        <div className="sess-bar">
          {prevClose && <div className="sess-item"><div className="sess-label"><Tooltip tip="Yesterday's regular session closing price at 4pm ET.">Prev Close</Tooltip></div><div className="sess-val">{fmtN(prevClose, 2)}</div></div>}
          {dayOpen   && <div className="sess-item"><div className="sess-label"><Tooltip tip="Today's opening price at 9:30am ET. Compared to Prev Close to determine gap direction.">Day Open</Tooltip></div><div className="sess-val">{fmtN(dayOpen, 2)}</div></div>}
          {gap != null && (() => {
            const g = parseFloat(String(gap))
            const gPct = data?.session_stats?.gap_pct ?? data?.gap_pct
            const sign = g >= 0 ? '+' : ''
            const pctStr = gPct != null ? ` (${g >= 0 ? '+' : ''}${parseFloat(String(gPct)).toFixed(2)}%)` : ''
            return <div className="sess-item"><div className="sess-label"><Tooltip tip="Difference between today's open and yesterday's close. Gaps above key GEX levels often fill. Large gaps can trigger gamma-driven moves.">Gap</Tooltip></div><div className={`sess-val ${g > 0 ? 'pos' : g < 0 ? 'neg' : 'warn'}`}>{sign}{fmtN(gap, 2)}{pctStr}</div></div>
          })()}
          {dayHigh   && <div className="sess-item"><div className="sess-label"><Tooltip tip="Highest price reached during today's regular session (9:30am–4pm ET).">Day High</Tooltip></div><div className="sess-val pos">{fmtN(dayHigh, 2)}</div></div>}
          {dayLow    && <div className="sess-item"><div className="sess-label"><Tooltip tip="Lowest price reached during today's regular session.">Day Low</Tooltip></div><div className="sess-val neg">{fmtN(dayLow, 2)}</div></div>}
          {dayRange  && <div className="sess-item"><div className="sess-label"><Tooltip tip="Today's high minus today's low. Compare to the implied weekly move to see if the daily range is expanding or contracting relative to volatility expectations.">Range</Tooltip></div><div className="sess-val warn">{fmtN(dayRange, 2)}</div></div>}
        </div>
      )}

      {/* ── Market Context ── */}
      {hasMarketCtx && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Snapshot of current macro volatility conditions: VIX term structure, implied move, futures basis, and options skew. Use this to calibrate position sizing and directional conviction." label="Market Context">Market Context</Tooltip></div>
          {(vix9d || vix || vix3m) && (
            <div className="vix-ts-row">
              {vix9d && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label"><Tooltip tip="9-day VIX — short-term fear gauge. More reactive than standard VIX. Spikes hard into binary events (FOMC, CPI). Unusually low vs VIX = complacency. Unusually high = near-term fear spike.">VIX9D</Tooltip></div>
                  <div className="vix-ts-val" style={{ color: Number(vix9d) > 20 ? 'var(--red)' : Number(vix9d) < 14 ? 'var(--green)' : 'var(--yellow)' }}>{Number(vix9d).toFixed(1)}</div>
                </div>
              )}
              {vix && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label"><Tooltip tip="30-day implied volatility (CBOE VIX). Below 15 = calm, 15–20 = normal, 20–30 = elevated, 30+ = fear. Rising VIX while price falls = real selling. Rising VIX while price rises = unusual, suspect the move.">VIX</Tooltip></div>
                  <div className="vix-ts-val" style={{ color: Number(vix) > 20 ? 'var(--red)' : Number(vix) < 14 ? 'var(--green)' : 'var(--yellow)' }}>{Number(vix).toFixed(1)}</div>
                </div>
              )}
              {vix3m && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label"><Tooltip tip="3-month VIX — medium-term vol expectation. Normally above VIX (contango = healthy). If VIX3M drops below VIX, that's backwardation — the market is pricing a near-term panic above longer-term uncertainty.">VIX3M</Tooltip></div>
                  <div className="vix-ts-val" style={{ color: Number(vix3m) > 22 ? 'var(--red)' : Number(vix3m) < 15 ? 'var(--green)' : 'var(--yellow)' }}>{Number(vix3m).toFixed(1)}</div>
                </div>
              )}
            </div>
          )}
          {(implPts || esBasis || volSkew) && (
            <div className="mkt-ctx-grid">
              {(implPts || implPct) && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label"><Tooltip tip="The options market's expected SPX price range for this week. Derived from current at-the-money IV. Price has roughly 68% probability of staying within this range. Great for setting targets and stops.">Implied Weekly Move</Tooltip></div>
                  <div className="mkt-ctx-val warn">{implPts ? '±' + fmtN(implPts, 0) + ' pts' : '--'}</div>
                  {implPct && <div className="mkt-ctx-sub">±{Number(implPct).toFixed(2)}%</div>}
                </div>
              )}
              {esBasis != null && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label"><Tooltip tip="Fair value spread between ES futures and the SPX cash index. Positive = futures trading at a premium (normal). Large negative = unusual, often near dividend dates or risk-off. Used to detect futures-led moves.">ES Basis (ES−SPX)</Tooltip></div>
                  <div className="mkt-ctx-val" style={{ color: Number(esBasis) > 0 ? 'var(--green)' : Number(esBasis) < 0 ? 'var(--red)' : 'var(--text)' }}>{Number(esBasis).toFixed(2)}</div>
                  {esBasisLbl && <div className="mkt-ctx-sub">{esBasisLbl}</div>}
                </div>
              )}
              {volSkew != null && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label"><Tooltip tip="Put IV minus call IV at equal distance from current price. Positive skew = puts more expensive than calls (tail-risk hedging active, typical). Very high skew = fear of a crash. Negative skew = unusual upside demand.">Vol Skew</Tooltip></div>
                  <div className="mkt-ctx-val" style={{ color: Number(volSkew) > 2 ? 'var(--red)' : Number(volSkew) < -2 ? 'var(--green)' : 'var(--yellow)' }}>{(() => { const s = Number(volSkew); return (s > 0 ? '+' : '') + s.toFixed(1) + ' vol pts' })()}</div>
                  {volSkewLbl && <div className="mkt-ctx-sub">{volSkewLbl}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Market Brief (AI) ── */}
      {aiRead && (
        <div className="brief-panel">
          <div className="brief-header">
            <span className="brief-title">Market Brief</span>
            <button className="brief-btn" onClick={() => window.location.reload()}>REFRESH</button>
          </div>
          <div className="brief-text">{aiRead}</div>
        </div>
      )}

      {/* ── Zone Target Tracker ── */}
      {entry && (
        <div className="panel" style={{ paddingBottom: 6 }}>
          <div className="target-tracker">
            <div className="tt-header">
              <span className="tt-title">Zone Target Tracker</span>
              <span className={`tt-signal ${cls}`}>{signal}</span>
            </div>
            <div className="tt-ladder">
              <div className={`tt-level ${target ? 'target' : 'neutral'}`}>
                <span>Target</span>
                <span>{target ?? '--'}</span>
                <span className="tt-dist" />
              </div>
              {(() => {
                const tgt = target  ? parseFloat(String(target).replace(/,/g,'')) : null
                const ent = entry   ? parseFloat(String(entry).replace(/,/g,'')) : null
                const stp = stopLogic ? parseFloat(String(stopLogic).replace(/,/g,'')) : null
                const cur = data?.es_price != null ? parseFloat(String(data.es_price).replace(/,/g,'')) : null
                const fillPct = (tgt != null && ent != null && tgt !== ent)
                  ? Math.min(100, Math.max(0, Math.abs((cur ?? ent) - ent) / Math.abs(tgt - ent) * 100))
                  : 50
                const stopPct = (stp != null && ent != null && stp !== ent)
                  ? Math.min(100, Math.max(0, Math.abs((cur ?? ent) - ent) / Math.abs(stp - ent) * 100))
                  : 50
                const barColor = cls === 'long' ? 'var(--green)' : cls === 'short' ? 'var(--red)' : 'var(--yellow)'
                return <>
                  <div className="tt-progress"><div className="tt-progress-fill" style={{ width: `${fillPct}%`, background: barColor }} /></div>
                  <div className="tt-level current">
                    <span>ES Now</span>
                    <span>{cur != null ? cur.toFixed(2) : '--'}</span>
                  </div>
                  {stp != null && <>
                    <div className="tt-progress"><div className="tt-progress-fill" style={{ width: `${stopPct}%`, background: 'var(--red)' }} /></div>
                    <div className="tt-level stop">
                      <span>Stop</span>
                      <span>{stopLogic ?? '--'}</span>
                      <span className="tt-dist" />
                    </div>
                  </>}
                </>
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Scalp Signal ── */}
      <div className="panel">
        <div className="panel-title"><Tooltip tip="Short-term trade setup based on 10-minute ES zones. Entry = zone boundary to initiate from. Target = next zone level. Stop = invalidation point. Score = how many confluence conditions are met (more = higher conviction)." label="Scalp Signal">Scalp Signal — 10m Zone to Zone</Tooltip></div>
        <div className="td-row">
          <div className="td-label"><Tooltip tip="Zone boundary to initiate the trade from. For longs: buy the zone bot on a pullback. For shorts: sell the zone top on a failed breakout.">Entry</Tooltip></div>
          <div className="td-val green">{entry ?? '--'}</div>
        </div>
        <div className="td-row">
          <div className="td-label"><Tooltip tip="Next zone boundary in the signal direction. Exit or take profit when price reaches this level. Do not hold through without re-evaluating the setup.">Target</Tooltip></div>
          <div className="td-val yellow">{target ?? '--'}</div>
        </div>
        <div className="td-row">
          <div className="td-label"><Tooltip tip="Level that invalidates the trade setup. If price closes a candle beyond this on a 10-minute chart, the signal is wrong — exit to preserve capital.">Stop</Tooltip></div>
          <div className="td-val red">{stopLogic ?? '--'}</div>
        </div>
        {reason && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>{reason}</div>
        )}
        {score != null && maxScore != null && (() => {
          // Score conditions checklist
          const oi  = (data?.oi_context  ?? {}) as any
          const dc  = (data?.dealer_context ?? {}) as any
          const isLong   = signal.includes('LONG')
          const isRetest = signal.includes('RETEST')
          const conds = [
            { label: 'Break confirmed',  pass: data?.structure_confirmation === 'BREAK_UP' || data?.structure_confirmation === 'BREAK_DOWN', na: !isRetest },
            { label: 'Retest active',    pass: !!data?.retest_active, na: !isRetest },
            { label: 'OI room clear',    pass: oi.oi_resistance !== 'STRONG' && oi.oi_room !== 'LOW', na: false },
            { label: 'GEX favors move',  pass: (data?.gex_context as any)?.gex_mode === 'EXPANSION' || (data?.gex_context as any)?.gex_mode === 'NEUTRAL', na: false },
            { label: 'Not OI pinned',    pass: !oi.oi_pin, na: false },
            { label: 'Dealer aligned',   pass: isLong ? !!dc.long_alignment : !!dc.short_alignment, na: false },
            { label: 'Day bias aligned', pass: (isLong && data?.day_bias === 'BULLISH') || (!isLong && data?.day_bias === 'BEARISH') || data?.day_bias === 'NEUTRAL', na: false },
          ]
          const passCount = conds.filter(c => !c.na && c.pass).length
          const maxCount  = conds.filter(c => !c.na).length
          return (
            <details style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, userSelect: 'none' }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', fontWeight: 700 }}>Score Conditions · {passCount}/{maxCount} pass</span>
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>▸</span>
              </summary>
              <div style={{ marginTop: 4, padding: '6px 8px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5 }}>
                {conds.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ fontSize: 10, color: c.na ? 'var(--border2)' : c.pass ? 'var(--text)' : 'var(--muted2)' }}>{c.label}</span>
                    {c.na ? <span style={{ fontSize: 8, color: 'var(--border2)' }}>N/A</span> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.pass ? 'var(--green)' : 'var(--red)' }} />}
                  </div>
                ))}
              </div>
            </details>
          )
        })()}
      </div>

      {/* ── Swing Signal ── */}
      <div className="panel">
        <div className="panel-title"><Tooltip tip="Multi-day trade setup based on daily SPX zone breaks. Requires a confirmed close above or below a key daily level. Entries here are for overnight holds or 1–3 day swings, not intraday scalps." label="Swing Signal">Swing Signal — Daily Zone</Tooltip></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Daily Zone Break</span>
          <span className={`sb-pill ${swCls}`} style={{ fontSize: 10, padding: '3px 10px' }}>{swing ?? 'NO SWING'}</span>
        </div>
        {swingSignal && (
          <>
            {swingSignal.entry  && <Row label="Entry"  value={swingSignal.entry}  col="var(--green)" />}
            {swingSignal.target && <Row label="Target" value={swingSignal.target} col="var(--yellow)" />}
            {swingSignal.stop   && <Row label="Stop"   value={swingSignal.stop}   col="var(--red)" />}
            {swingSignal.reason && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic' }}>{swingSignal.reason}</div>}
          </>
        )}
      </div>

      {/* ── NDX Zone Note ── */}
      {isNdx && (
        <div className="panel">
          <div className="panel-title" style={{ color: 'var(--green)', marginBottom: 6 }}>NQ / NDX Context</div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6 }}>
            Zone logic runs on ES/SPX. The zones and signals below show ES/SPX levels — use them as reference even when trading NQ, since SPX zones are the primary structural anchors.
          </div>
        </div>
      )}

      {/* ── ES 10M Zone ── */}
      {(es10Bot || es10Top) && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="10-minute ES futures price zone. The scalp signal uses zone bot → top as the intraday target range. A confirmed break above Zone Top triggers a LONG setup toward the Next Zone. Break below Zone Bot triggers a SHORT setup toward Prev Zone.">ES 10M Zone — Intraday</Tooltip></div>
          <ZoneBox label="ES 10M" bot={es10Bot} top={es10Top} mid={es10Mid} state={es10State} pct={es10Pct}
            nextBot={es10NextBot} nextTop={es10NextTop} prevBot={es10PrevBot} prevTop={es10PrevTop} />
        </div>
      )}

      {/* ── ES Daily Zone ── */}
      {(esDBot || esDTop) && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Daily ES futures zone. Swing signals are generated when price closes above or below a daily zone boundary. These zones hold for multiple days — use them for overnight positions and multi-day swing trades, not intraday scalps.">ES Daily Zone — Swing</Tooltip></div>
          <ZoneBox label="ES Daily" bot={esDBot} top={esDTop} mid={esDMid} state={esDState} pct={esDPct}
            nextBot={esDNextBot} nextTop={esDNextTop} prevBot={esDPrevBot} prevTop={esDPrevTop} />
        </div>
      )}

      {/* ── SPX Daily Zone ── */}
      {(spxBot || spxTop) && (
        <div className="panel" style={{ paddingBottom: 6 }}>
          <div className="panel-title"><Tooltip tip="SPX cash index daily zone. Useful as a secondary reference — ES futures zones drive the scalp signals, but SPX zones confirm macro structure. Use for context when the ES zone and SPX zone are aligned.">SPX Daily Zone — Context</Tooltip></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {spxBot && <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">Zone Bot</div><div className="zl-val">{fmtN(spxBot, 2)}</div></div>}
            {spxTop && <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">Zone Top</div><div className="zl-val">{fmtN(spxTop, 2)}</div></div>}
            {spxState && <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">State</div><div className="zl-val" style={{ fontSize: 9 }}>{spxState}</div></div>}
          </div>
        </div>
      )}

      {/* ── Market States ── */}
      {marketState.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Composite view of current market conditions derived from GEX, options flow, open interest, and price structure. Each state updates every 30 seconds. Tap any label for a full explanation." label="Market States">Market States</Tooltip></div>
          <div className="stat-grid">
            {marketState.map((r, i) => (
              <div key={i} className="stat">
                <div className="stat-label"><Tooltip tip={r.tip ?? ''}>{r.label}</Tooltip></div>
                <div className={`stat-val${String(r.value ?? '').toUpperCase().includes('BULL') || String(r.value ?? '').toUpperCase().includes('LONG') || String(r.value ?? '').toUpperCase().includes('POS') ? ' bull' : String(r.value ?? '').toUpperCase().includes('BEAR') || String(r.value ?? '').toUpperCase().includes('SHORT') || String(r.value ?? '').toUpperCase().includes('NEG') ? ' bear' : ''}`} style={{ fontSize: 10 }}>
                  {r.value}
                </div>
                {r.label === 'Day Bias' && dayOpen && (
                  <div className="stat-sub">Open: {fmtN(dayOpen, 2)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pattern Match Engine ── */}
      {!isNdx && patternData && (() => {
        const c = patternData.current ?? {}
        const s = patternData.stats ?? {}
        const total = patternData.total_history ?? 0

        const regimeLabel = (() => {
          const gex  = String(c.gex_regime ?? '').toUpperCase()
          const flow = String(c.flow_bias  ?? '').toUpperCase()
          const vix  = String(c.vix_level  ?? '').toUpperCase()
          if (gex.includes('POSITIVE') && vix === 'LOW'    && flow.includes('CALL')) return { label: 'PIN REGIME',        sub: 'Positive GEX + calm vol + call flow → price magnetic', color: 'var(--green)' }
          if (gex.includes('POSITIVE') && vix === 'NORMAL')                          return { label: 'STABILIZING',       sub: 'Dealer gamma absorbing moves, range likely', color: 'var(--green)' }
          if (gex.includes('NEGATIVE') && vix === 'HIGH')                            return { label: 'VOLATILITY REGIME', sub: 'Negative GEX + elevated vol → amplified moves', color: 'var(--red)' }
          if (gex.includes('NEGATIVE') && vix === 'EXTREME')                         return { label: 'DANGER ZONE',       sub: 'Max negative GEX + fear spike → trend acceleration', color: 'var(--red)' }
          if (flow.includes('PUT'))                                                   return { label: 'DEFENSIVE FLOW',    sub: 'Put premium dominant — institutional hedging active', color: 'var(--yellow)' }
          if (flow.includes('CALL'))                                                  return { label: 'OFFENSIVE FLOW',    sub: 'Call premium dominant — risk-on positioning', color: 'var(--green)' }
          return { label: 'MIXED REGIME', sub: 'Conflicting signals — reduce size', color: 'var(--muted2)' }
        })()

        const chips = [
          { label: 'GEX',  tip: 'Gamma regime at the time of the pattern match. POSITIVE = dealers long gamma (stabilizing). NEGATIVE = dealers short gamma (amplifying). The regime shapes how large a move is possible.',  val: c.gex_regime ?? '--',  color: String(c.gex_regime ?? '').includes('POSITIVE') ? 'var(--green)' : String(c.gex_regime ?? '').includes('NEGATIVE') ? 'var(--red)' : 'var(--muted2)' },
          { label: 'VIX',  tip: 'VIX level bucket used for pattern matching. LOW = below 15. NORMAL = 15–20. HIGH = 20–30. EXTREME = 30+. Higher VIX historically correlates with larger 4h moves in both directions.',    val: c.vix_level  ?? '--',  color: c.vix_level === 'LOW' ? 'var(--green)' : c.vix_level === 'EXTREME' ? 'var(--red)' : c.vix_level === 'HIGH' ? 'var(--yellow)' : 'var(--muted2)' },
          { label: 'IV',   tip: 'Implied volatility regime. LOW = options cheap. HIGH/EXTREME = options expensive. When IV is elevated during a pattern match, historical outcomes show wider ranges — plan stops accordingly.',  val: c.iv_regime  ?? '--',  color: c.iv_regime === 'LOW' ? 'var(--green)' : c.iv_regime === 'EXTREME' || c.iv_regime === 'HIGH' ? 'var(--red)' : 'var(--muted2)' },
          { label: 'FLOW', tip: 'Options flow bias bucket. CALL HEAVY = more call premium flowing in. PUT HEAVY = put premium dominant. BALANCED = no clear edge. Flow bias narrows which historical sessions are true matches.', val: c.flow_bias  ?? '--',  color: String(c.flow_bias ?? '').includes('CALL') ? 'var(--green)' : String(c.flow_bias ?? '').includes('PUT') ? 'var(--red)' : 'var(--muted2)' },
          { label: 'TIME', tip: 'Time-of-day bucket for the pattern match. OPEN = 9:30–11am (highest vol). MIDDAY = 11am–2pm (lowest vol). CLOSE = 2–4pm (vol picks back up). Patterns from the same time bucket are more comparable.', val: c.time_bucket ?? '--', color: 'var(--muted2)' },
        ]

        return (
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tooltip tip="Looks up the current market regime (GEX, VIX, IV, flow, time of day) in a historical database and finds sessions with the same conditions. Shows what SPX did 4 hours later in those matching sessions. Higher match count = more reliable statistics." label="Pattern Match Engine">Pattern Match Engine</Tooltip>
              <LiveBadge variant="yellow" />
            </div>

            {/* Regime chips */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {chips.map(ch => (
                <div key={ch.label} style={{ background: 'var(--surface)', border: `1px solid ${ch.color}33`, borderRadius: 4, padding: '3px 7px', textAlign: 'center' }}>
                  <div style={{ fontSize: 6, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.5px' }}><Tooltip tip={ch.tip}>{ch.label}</Tooltip></div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, color: ch.color }}>{ch.val}</div>
                </div>
              ))}
            </div>

            {/* Regime label */}
            <div style={{ background: 'var(--surface)', border: `1px solid ${regimeLabel.color}44`, borderRadius: 5, padding: '7px 10px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: regimeLabel.color }}>{regimeLabel.label}</div>
              <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 3 }}>{regimeLabel.sub}</div>
            </div>

            {/* Historical stats */}
            {s.count >= 5 ? (
              <>
                <div style={{ fontSize: 8, color: 'var(--muted2)', marginBottom: 6 }}>
                  {s.count} matching setups in {total} session snapshots · 4h forward return
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 6 }}>
                  {[
                    { label: '↑ Up',   val: s.up_pct   + '%', color: 'var(--green)' },
                    { label: '— Flat', val: s.flat_pct + '%', color: 'var(--muted2)' },
                    { label: '↓ Down', val: s.down_pct + '%', color: 'var(--red)' },
                  ].map(b => (
                    <div key={b.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 7, color: 'var(--muted2)' }}>{b.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: b.color }}>{b.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
                  Avg 4h move: <span style={{ color: s.avg_move > 0 ? 'var(--green)' : s.avg_move < 0 ? 'var(--red)' : 'var(--muted2)', fontWeight: 700 }}>{s.avg_move > 0 ? '+' : ''}{s.avg_move} pts</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 9, color: 'var(--muted2)', textAlign: 'center', padding: '6px 0' }}>
                Collecting data — {total} session{total !== 1 ? 's' : ''} recorded so far
                {s.count > 0 && s.count < 5 && ` (${s.count} match${s.count !== 1 ? 'es' : ''}, need 5+)`}
              </div>
            )}
          </div>
        )
      })()}
    </>
  )
}
