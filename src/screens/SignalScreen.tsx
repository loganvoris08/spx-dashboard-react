import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function sigClass(s?: string) {
  if (!s) return 'sig-wait'
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))  return 'sig-long'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'sig-short'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'sig-watch'
  return 'sig-wait'
}

function stateColor(s?: string) {
  if (!s) return undefined
  const u = s.toUpperCase()
  if (u.includes('BULL') || u.includes('CALL') || u.includes('POS') || u.includes('LONG')) return 'var(--green)'
  if (u.includes('BEAR') || u.includes('PUT')  || u.includes('NEG') || u.includes('SHORT')) return 'var(--red)'
  return undefined
}

function fmt(v: any) { return v != null && v !== '' ? String(v) : '—' }

function Row({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className="data-val" style={{ color: color ?? 'var(--text)' }}>{fmt(value)}</span>
    </div>
  )
}

function HistoryRow({ item, isScalp }: { item: any; isScalp: boolean }) {
  const sc = sigClass(item.signal)
  const color = sc === 'sig-long' ? 'var(--green)' : sc === 'sig-short' ? 'var(--red)' : sc === 'sig-watch' ? 'var(--yellow)' : 'var(--muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>{item.signal}</div>
        <div style={{ color: 'var(--muted)', fontSize: 9, marginTop: 1 }}>
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
  const sc = sigClass(signal)
  const sigColor = sc === 'sig-long' ? 'var(--green)' : sc === 'sig-short' ? 'var(--red)' : sc === 'sig-watch' ? 'var(--yellow)' : 'var(--muted)'

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
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Signal hero ── */}
      <div className="card" style={{
        background: `linear-gradient(135deg, var(--surface) 0%, ${sigColor}06 100%)`,
        border: `1px solid ${sigColor}22`,
        padding: '20px 16px', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 38, fontWeight: 800,
          color: sigColor, letterSpacing: '0.04em',
          textShadow: `0 0 32px ${sigColor}55`,
        }}>
          {signal}
        </div>

        {score != null && maxScore != null && !signal.includes('WAIT') && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{ width: 100, height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((score / maxScore) * 100)}%`, height: '100%', background: sigColor, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{score}/{maxScore}</span>
            {quality && (
              <span style={{
                padding: '1px 8px', borderRadius: 3,
                background: sigColor + '15', border: `1px solid ${sigColor}30`,
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: sigColor, letterSpacing: '0.08em',
              }}>{quality}</span>
            )}
          </div>
        )}

        {lastUpdated && (
          <div style={{ color: 'var(--muted)', fontSize: 9, marginTop: 10, letterSpacing: '0.04em' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* ── Trade setup ── */}
      {isActionable && (entry || target || stopLogic) && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Trade Setup</div>
          {entry     && <Row label="Entry"  value={entry} />}
          {target    && <Row label="Target" value={target} color="var(--green)" />}
          {stopLogic && <Row label="Stop"   value={stopLogic} color="var(--red)" />}
          {reason && <p style={{ color: 'var(--text2)', fontSize: 11, marginTop: 8, lineHeight: 1.6, fontStyle: 'italic' }}>{reason}</p>}
        </div>
      )}

      {/* ── AI read ── */}
      {aiRead && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">AI Market Read</div>
          <p style={{ color: '#bbb', fontSize: 12, lineHeight: 1.7 }}>{aiRead}</p>
        </div>
      )}

      {/* ── Swing signal ── */}
      {swingSig && !swingSig.includes('NO ') && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Swing Signal</div>
          <Row label="Direction" value={swingSig} color={(() => { const c = sigClass(swingSig); return c === 'sig-long' ? 'var(--green)' : c === 'sig-short' ? 'var(--red)' : 'var(--yellow)' })()} />
          {swingSignal?.entry  && <Row label="Entry"  value={swingSignal.entry} />}
          {swingSignal?.target && <Row label="Target" value={swingSignal.target} color="var(--green)" />}
          {swingSignal?.reason && <p style={{ color: 'var(--text2)', fontSize: 11, marginTop: 8, lineHeight: 1.6, fontStyle: 'italic' }}>{swingSignal.reason}</p>}
        </div>
      )}

      {/* ── Market state — dense grid ── */}
      {marketState.length > 0 && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Market State</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            {marketState.map((r, i) => (
              <div key={i} className="data-row">
                <span className="data-label">{r.label}</span>
                <span className="data-val" style={{ color: r.color ?? 'var(--text)', fontSize: 10, textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Scalp history ── */}
      {scalpHistory.length > 0 && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Recent Scalp Signals</div>
          {scalpHistory.slice(0, 8).map((h, i) => <HistoryRow key={i} item={h} isScalp />)}
        </div>
      )}

      {/* ── Swing history ── */}
      {swingHistory.length > 0 && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Recent Swing Signals</div>
          {swingHistory.slice(0, 5).map((h, i) => <HistoryRow key={i} item={h} isScalp={false} />)}
        </div>
      )}

    </div>
  )
}
