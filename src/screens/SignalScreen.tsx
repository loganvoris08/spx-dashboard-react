import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function signalColor(s?: string) {
  if (!s) return 'var(--muted)'
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))  return 'var(--green)'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'var(--red)'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'var(--yellow)'
  return 'var(--muted)'
}

function stateColor(s?: string) {
  if (!s) return 'var(--text)'
  const u = s.toUpperCase()
  if (u.includes('BULL') || u.includes('CALL') || u.includes('POS')) return 'var(--green)'
  if (u.includes('BEAR') || u.includes('PUT')  || u.includes('NEG')) return 'var(--red)'
  return 'var(--text)'
}

function fmt(v: any) { return v != null && v !== '' ? String(v) : '—' }

function Row({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500, color: color ?? 'var(--text)' }}>
        {fmt(value)}
      </span>
    </div>
  )
}

function HistoryRow({ item, isScalp }: { item: any; isScalp: boolean }) {
  const color = signalColor(item.signal)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color }}>{item.signal}</div>
        <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
          {item.time}
          {item.es ? ` · ES ${item.es}` : ''}
          {isScalp && item.entry ? ` · entry ${item.entry}` : ''}
        </div>
      </div>
      {item.session && <span style={{ color: 'var(--muted2)', fontSize: 10 }}>{item.session}</span>}
    </div>
  )
}

export default function SignalScreen() {
  const { data, lastUpdated } = useDashboard()
  useSide() // provides context; side used in future panels

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
  const sigColor     = signalColor(signal)

  const scalpHistory: any[] = data?.scalp_history ?? []
  const swingHistory: any[] = data?.swing_history ?? []

  const gammaState    = data?.gamma_state
  const netGex        = data?.net_gex_state
  const flowState     = data?.flow_state
  const bias          = data?.bias
  const structState   = data?.structure_state
  const priceLocState = data?.price_location_state
  const auctionState  = data?.auction_state
  const trapState     = data?.trap_state

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Signal hero ── */}
      <div className="card" style={{
        background: `linear-gradient(135deg, var(--surface) 0%, ${sigColor}08 100%)`,
        border: `1px solid ${sigColor}22`,
        textAlign: 'center', padding: '28px 20px',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 42, fontWeight: 800,
          color: sigColor, letterSpacing: '0.04em',
          textShadow: `0 0 40px ${sigColor}66`,
        }}>
          {signal}
        </div>

        {score != null && maxScore != null && !signal.includes('WAIT') && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <ScoreBar score={score} max={maxScore} color={sigColor} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)' }}>
              {score}/{maxScore}
            </span>
          </div>
        )}

        {quality && !signal.includes('WAIT') && (
          <div style={{
            display: 'inline-block', marginTop: 10,
            padding: '3px 10px', borderRadius: 5,
            background: sigColor + '18', border: `1px solid ${sigColor}33`,
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            color: sigColor, letterSpacing: '0.08em',
          }}>
            {quality}
          </div>
        )}

        {lastUpdated && (
          <div style={{ color: 'var(--muted2)', fontSize: 10, marginTop: 12 }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* ── Trade setup ── */}
      {isActionable && (entry || target || stopLogic) && (
        <div className="card">
          <div className="card-title">Trade Setup</div>
          {entry     && <Row label="Entry"  value={entry} />}
          {target    && <Row label="Target" value={target} color="var(--green)" />}
          {stopLogic && <Row label="Stop"   value={stopLogic} color="var(--red)" />}
          {reason && (
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, lineHeight: 1.6, fontStyle: 'italic' }}>
              {reason}
            </p>
          )}
        </div>
      )}

      {/* ── AI read ── */}
      {aiRead && (
        <div className="card">
          <div className="card-title">AI Market Read</div>
          <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.7 }}>{aiRead}</p>
        </div>
      )}

      {/* ── Swing signal ── */}
      {swingSig && !swingSig.includes('NO ') && (
        <div className="card">
          <div className="card-title">Swing Signal</div>
          <Row label="Direction" value={swingSig} color={signalColor(swingSig)} />
          {swingSignal?.entry  && <Row label="Entry"  value={swingSignal.entry} />}
          {swingSignal?.target && <Row label="Target" value={swingSignal.target} color="var(--green)" />}
          {swingSignal?.reason && (
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, lineHeight: 1.6, fontStyle: 'italic' }}>
              {swingSignal.reason}
            </p>
          )}
        </div>
      )}

      {/* ── Market state ── */}
      <div className="card">
        <div className="card-title">Market State</div>
        <Row label="Gamma Regime"   value={gammaState} />
        <Row label="Net GEX State"  value={netGex} />
        <Row label="Flow State"     value={flowState}     color={stateColor(flowState)} />
        <Row label="Bias"           value={bias}          color={stateColor(bias)} />
        <Row label="Structure"      value={structState} />
        <Row label="Price Location" value={priceLocState} />
        {auctionState && <Row label="Auction" value={auctionState} />}
        {trapState && trapState !== 'None' && (
          <Row label="Trap" value={trapState} color="var(--yellow)" />
        )}
      </div>

      {/* ── Scalp history ── */}
      {scalpHistory.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Scalp Signals</div>
          {scalpHistory.slice(0, 8).map((h, i) => <HistoryRow key={i} item={h} isScalp />)}
        </div>
      )}

      {/* ── Swing history ── */}
      {swingHistory.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Swing Signals</div>
          {swingHistory.slice(0, 5).map((h, i) => <HistoryRow key={i} item={h} isScalp={false} />)}
        </div>
      )}

    </div>
  )
}

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div style={{ width: 120, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  )
}
