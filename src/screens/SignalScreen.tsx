import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function sigClass(s?: string) {
  if (!s) return 'wait'
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))   return 'long'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'short'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'watch'
  return 'wait'
}

function sigColor(cls: string) {
  if (cls === 'long')  return 'var(--green)'
  if (cls === 'short') return 'var(--red)'
  if (cls === 'watch') return 'var(--yellow)'
  return 'var(--muted2)'
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

function ZoneBox({ label, bot, top, mid, state, next, prev }: {
  label: string; bot?: number; top?: number; mid?: number; state?: string; next?: number; prev?: number
}) {
  if (!bot && !top) return null
  return (
    <div className="zone-status-box">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div className="zone-state-label">{state ?? label}</div>
      </div>
      <div className="zone-levels">
        {bot  != null && <div className="zl"><div className="zl-label">Zone Bot</div><div className="zl-val">{fmtN(bot, 2)}</div></div>}
        {top  != null && <div className="zl"><div className="zl-label">Zone Top</div><div className="zl-val">{fmtN(top, 2)}</div></div>}
        {mid  != null && <div className="zl"><div className="zl-label">Mid</div><div className="zl-val">{fmtN(mid, 2)}</div></div>}
        {prev != null && <div className="zl"><div className="zl-label">Prev Zone</div><div className="zl-val put">{fmtN(prev, 2)}</div></div>}
        {next != null && <div className="zl"><div className="zl-label">Next Zone</div><div className="zl-val call">{fmtN(next, 2)}</div></div>}
      </div>
    </div>
  )
}

export default function SignalScreen() {
  const { data } = useDashboard()
  useSide()

  const signal    = data?.trade_signal ?? data?.signal ?? 'WAIT'
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
  const color = sigColor(cls)
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

  // Zone data
  const es10Bot   = data?.es_10m_zone_bot
  const es10Top   = data?.es_10m_zone_top
  const es10Mid   = data?.es_10m_zone_mid
  const es10State = data?.es_10m_zone_state
  const es10Next  = data?.es_10m_next_zone
  const es10Prev  = data?.es_10m_prev_zone

  const esDBot    = data?.es_d_zone_bot
  const esDTop    = data?.es_d_zone_top
  const esDMid    = data?.es_d_zone_mid
  const esDState  = data?.es_d_zone_state
  const esDNext   = data?.es_d_next_zone
  const esDPrev   = data?.es_d_prev_zone

  const spxBot    = data?.spx_zone_bot
  const spxTop    = data?.spx_zone_top
  const spxState  = data?.spx_zone_state

  const swingSignal = data?.swing_signal

  const marketState = [
    { label: 'Mode',      value: data?.market_mode ?? data?.mode },
    { label: 'Break',     value: data?.break_state },
    { label: 'Bias',      value: data?.bias },
    { label: 'Day Bias',  value: data?.day_bias },
    { label: 'Flow',      value: data?.flow_state },
    { label: 'Gamma',     value: data?.gamma_state },
    { label: 'OI State',  value: data?.oi_state },
    { label: 'Trap',      value: data?.trap_state !== 'None' ? data?.trap_state : null },
    { label: 'Price Loc', value: data?.price_location_state },
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
          {prevClose && <div className="sess-item"><div className="sess-label">Prev Close</div><div className="sess-val">{fmtN(prevClose, 2)}</div></div>}
          {dayOpen   && <div className="sess-item"><div className="sess-label">Day Open</div><div className="sess-val">{fmtN(dayOpen, 2)}</div></div>}
          {gap != null && <div className="sess-item"><div className="sess-label">Gap</div><div className="sess-val warn">{fmtN(gap, 2)}</div></div>}
          {dayHigh   && <div className="sess-item"><div className="sess-label">Day High</div><div className="sess-val pos">{fmtN(dayHigh, 2)}</div></div>}
          {dayLow    && <div className="sess-item"><div className="sess-label">Day Low</div><div className="sess-val neg">{fmtN(dayLow, 2)}</div></div>}
          {dayRange  && <div className="sess-item"><div className="sess-label">Range</div><div className="sess-val warn">{fmtN(dayRange, 2)}</div></div>}
        </div>
      )}

      {/* ── Market Context ── */}
      {hasMarketCtx && (
        <div className="panel">
          <div className="panel-title">Market Context</div>
          {(vix9d || vix || vix3m) && (
            <div className="vix-ts-row">
              {vix9d && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label">VIX9D</div>
                  <div className="vix-ts-val" style={{ color: Number(vix9d) > 20 ? 'var(--red)' : 'var(--text)' }}>{Number(vix9d).toFixed(1)}</div>
                </div>
              )}
              {vix && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label">VIX</div>
                  <div className="vix-ts-val" style={{ color: Number(vix) > 20 ? 'var(--red)' : 'var(--text)' }}>{Number(vix).toFixed(1)}</div>
                </div>
              )}
              {vix3m && (
                <div className="vix-ts-item">
                  <div className="vix-ts-label">VIX3M</div>
                  <div className="vix-ts-val">{Number(vix3m).toFixed(1)}</div>
                </div>
              )}
            </div>
          )}
          {(implPts || esBasis || volSkew) && (
            <div className="mkt-ctx-grid">
              {(implPts || implPct) && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label">Implied Weekly Move</div>
                  <div className="mkt-ctx-val warn">{implPts ? fmtN(implPts, 0) + ' pts' : '--'}</div>
                  {implPct && <div className="mkt-ctx-sub">{Number(implPct).toFixed(1)}%</div>}
                </div>
              )}
              {esBasis != null && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label">ES Basis (ES−SPX)</div>
                  <div className="mkt-ctx-val" style={{ color: Number(esBasis) > 0 ? 'var(--green)' : Number(esBasis) < 0 ? 'var(--red)' : 'var(--text)' }}>{Number(esBasis).toFixed(2)}</div>
                  {esBasisLbl && <div className="mkt-ctx-sub">{esBasisLbl}</div>}
                </div>
              )}
              {volSkew != null && (
                <div className="mkt-ctx-item">
                  <div className="mkt-ctx-label">Vol Skew</div>
                  <div className="mkt-ctx-val">{Number(volSkew).toFixed(1)}</div>
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
        <div className="panel-title">Scalp Signal — 10m Zone to Zone</div>
        <div className="td-row">
          <div className="td-label">Entry</div>
          <div className="td-val green">{entry ?? '--'}</div>
        </div>
        <div className="td-row">
          <div className="td-label">Target</div>
          <div className="td-val yellow">{target ?? '--'}</div>
        </div>
        <div className="td-row">
          <div className="td-label">Stop</div>
          <div className="td-val red">{stopLogic ?? '--'}</div>
        </div>
        {reason && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>{reason}</div>
        )}
        {score != null && maxScore != null && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, borderTop: reason ? 'none' : '1px solid var(--border)', paddingTop: reason ? 0 : 8 }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{score}/{maxScore}</span>
            {quality && <span style={{ fontSize: 9, color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{quality}</span>}
            <div style={{ flex: 1, height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((score / maxScore) * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Swing Signal ── */}
      <div className="panel">
        <div className="panel-title">Swing Signal — Daily Zone</div>
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

      {/* ── ES 10M Zone ── */}
      {(es10Bot || es10Top) && (
        <div className="panel">
          <div className="panel-title">ES 10M Zone — Intraday</div>
          <ZoneBox label="ES 10M" bot={es10Bot} top={es10Top} mid={es10Mid} state={es10State} next={es10Next} prev={es10Prev} />
        </div>
      )}

      {/* ── ES Daily Zone ── */}
      {(esDBot || esDTop) && (
        <div className="panel">
          <div className="panel-title">ES Daily Zone — Swing</div>
          <ZoneBox label="ES Daily" bot={esDBot} top={esDTop} mid={esDMid} state={esDState} next={esDNext} prev={esDPrev} />
        </div>
      )}

      {/* ── SPX Daily Zone ── */}
      {(spxBot || spxTop) && (
        <div className="panel" style={{ paddingBottom: 6 }}>
          <div className="panel-title">SPX Daily Zone — Context</div>
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
          <div className="panel-title">Market States</div>
          <div className="stat-grid">
            {marketState.map((r, i) => (
              <div key={i} className="stat">
                <div className="stat-label">{r.label}</div>
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
    </>
  )
}
