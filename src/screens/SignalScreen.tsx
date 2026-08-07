import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function sigClass(s?: string) {
  if (!s) return 'wait'
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))  return 'long'
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

function stateColor(s?: string) {
  if (!s) return undefined
  const u = s.toUpperCase()
  if (u.includes('BULL') || u.includes('CALL') || u.includes('POS') || u.includes('LONG')) return 'var(--green)'
  if (u.includes('BEAR') || u.includes('PUT')  || u.includes('NEG') || u.includes('SHORT')) return 'var(--red)'
  return undefined
}

function fmt(v: any) { return v != null && v !== '' ? String(v) : '—' }

function Row({ label, value, col }: { label: string; value: any; col?: string }) {
  return (
    <div className="td-row">
      <div className="td-label">{label}</div>
      <div className="td-val" style={{ color: col }}>{fmt(value)}</div>
    </div>
  )
}

function HistoryRow({ item, isScalp }: { item: any; isScalp: boolean }) {
  const cls   = sigClass(item.signal)
  const color = sigColor(cls)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>{item.signal}</div>
        <div style={{ color: 'var(--muted2)', fontSize: 9, marginTop: 1 }}>
          {item.time}{item.es ? ` · ES ${item.es}` : ''}{isScalp && item.entry ? ` · entry ${item.entry}` : ''}
        </div>
      </div>
      {item.session && <span style={{ color: 'var(--muted2)', fontSize: 9 }}>{item.session}</span>}
    </div>
  )
}

export default function SignalScreen() {
  const { data, lastUpdated } = useDashboard()
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

  const swingSignal = data?.swing_signal
  const swingSig    = swingSignal?.signal ?? data?.swing_history?.[0]?.signal

  const isActionable = signal && signal !== 'WAIT' && signal !== 'NO SIGNAL'
  const cls   = sigClass(signal)
  const color = sigColor(cls)

  const scalpHistory: any[] = data?.scalp_history ?? []
  const swingHistory: any[] = data?.swing_history  ?? []

  const marketState = [
    { label: 'Gamma Regime',   value: data?.gamma_state },
    { label: 'Net GEX',        value: data?.net_gex_state },
    { label: 'Flow',           value: data?.flow_state,           color: stateColor(data?.flow_state) },
    { label: 'Bias',           value: data?.bias,                 color: stateColor(data?.bias) },
    { label: 'Structure',      value: data?.structure_state },
    { label: 'Price Loc',      value: data?.price_location_state },
    { label: 'Auction',        value: data?.auction_state },
    { label: 'Trap',           value: data?.trap_state !== 'None' ? data?.trap_state : null, color: 'var(--yellow)' },
  ].filter(r => r.value)

  return (
    <>
      {/* ── Signal hero ── */}
      <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div className="sig-hero" style={{ color, textShadow: `0 0 32px ${color}55` }}>
          {signal}
        </div>

        {score != null && maxScore != null && !signal.includes('WAIT') && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{ width: 100, height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((score / maxScore) * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted2)' }}>{score}/{maxScore}</span>
            {quality && (
              <span style={{
                padding: '1px 8px', borderRadius: 3,
                background: color + '15', border: `1px solid ${color}30`,
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em',
              }}>{quality}</span>
            )}
          </div>
        )}

        {lastUpdated && (
          <div style={{ color: 'var(--muted2)', fontSize: 9, marginTop: 10, letterSpacing: '0.04em' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* ── Trade setup ── */}
      {isActionable && (entry || target || stopLogic) && (
        <div className="panel">
          <div className="panel-title">Scalp Signal — 10m Zone to Zone</div>
          {entry     && <Row label="Entry"  value={entry} col="var(--green)" />}
          {target    && <Row label="Target" value={target} col="var(--yellow)" />}
          {stopLogic && <Row label="Stop"   value={stopLogic} col="var(--red)" />}
          {reason && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic' }}>{reason}</div>}
        </div>
      )}

      {/* ── AI read ── */}
      {aiRead && (
        <div className="panel">
          <div className="panel-title">AI Market Read</div>
          <div style={{ color: 'var(--text2)', fontSize: 11, lineHeight: 1.7 }}>{aiRead}</div>
        </div>
      )}

      {/* ── Swing signal ── */}
      {swingSig && !swingSig.includes('NO ') && (
        <div className="panel">
          <div className="panel-title">Swing Signal — Daily Zone</div>
          <Row label="Direction" value={swingSig} col={(() => { const c = sigClass(swingSig); return sigColor(c) })()} />
          {swingSignal?.entry  && <Row label="Entry"  value={swingSignal.entry} />}
          {swingSignal?.target && <Row label="Target" value={swingSignal.target} col="var(--green)" />}
          {swingSignal?.reason && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic' }}>{swingSignal.reason}</div>}
        </div>
      )}

      {/* ── Market state ── */}
      {marketState.length > 0 && (
        <div className="panel">
          <div className="panel-title">Market States</div>
          <div className="stat-grid">
            {marketState.map((r, i) => (
              <div key={i} className="stat">
                <div className="stat-label">{r.label}</div>
                <div className="stat-val" style={{ color: r.color ?? 'var(--text)', fontSize: 10 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Scalp history ── */}
      {scalpHistory.length > 0 && (
        <div className="panel">
          <div className="panel-title">Recent Scalp Signals</div>
          {scalpHistory.slice(0, 8).map((h, i) => <HistoryRow key={i} item={h} isScalp />)}
        </div>
      )}

      {/* ── Swing history ── */}
      {swingHistory.length > 0 && (
        <div className="panel">
          <div className="panel-title">Recent Swing Signals</div>
          {swingHistory.slice(0, 5).map((h, i) => <HistoryRow key={i} item={h} isScalp={false} />)}
        </div>
      )}
    </>
  )
}
