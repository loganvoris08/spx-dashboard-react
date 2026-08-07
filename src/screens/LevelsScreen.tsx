import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function fmtNum(v: any, d = 0) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function statValClass(v?: string) {
  if (!v) return ''
  const u = v.toUpperCase()
  if (u.includes('BULL') || u.includes('POS') || u.includes('CALL') || u.includes('LONG') || u.includes('ABOVE')) return 'bull'
  if (u.includes('BEAR') || u.includes('NEG') || u.includes('PUT') || u.includes('SHORT') || u.includes('BELOW')) return 'bear'
  if (u.includes('WARN') || u.includes('NEUTRAL') || u.includes('NEUT')) return 'neut'
  return ''
}

function Row({ label, value, valClass }: { label: string; value: any; valClass?: string }) {
  return (
    <div className="td-row">
      <div className="td-label">{label}</div>
      <div className={`td-val${valClass ? ' ' + valClass : ''}`}>{value ?? '--'}</div>
    </div>
  )
}

function ZoneBox({ label, bot, top, mid, state }: { label: string; bot?: number; top?: number; mid?: number; state?: string }) {
  if (!bot || !top) return null
  return (
    <div className="zone-status-box">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="zone-state-label">{state ?? label}</div>
      </div>
      <div className="zone-levels">
        <div className="zl"><div className="zl-label">Zone Bot</div><div className="zl-val">{fmtNum(bot, 2)}</div></div>
        <div className="zl"><div className="zl-label">Zone Top</div><div className="zl-val">{fmtNum(top, 2)}</div></div>
        {mid != null && <div className="zl"><div className="zl-label">Mid</div><div className="zl-val">{fmtNum(mid, 2)}</div></div>}
      </div>
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const nd = data?.ndx ?? {}

  const spxFlip = data?.gex_flip_zone_raw || data?.gex_flip_zone
  const spxCW   = data?.nearest_call_wall || data?.gex_nearest_call_wall
  const spxPW   = data?.nearest_put_wall  || data?.gex_nearest_put_wall
  const distCall= data?.dist_to_call
  const distPut = data?.dist_to_put

  const ndxFlip = nd.gex_flip_zone_raw || data?.ndx_gex_flip_zone
  const ndxCW   = nd.nearest_call_wall  || nd.gex_nearest_call_wall
  const ndxPW   = nd.nearest_put_wall   || nd.gex_nearest_put_wall

  const flip  = isNdx ? ndxFlip : spxFlip
  const cWall = isNdx ? ndxCW   : spxCW
  const pWall = isNdx ? ndxPW   : spxPW

  const spxBot  = data?.spx_zone_bot
  const spxTop  = data?.spx_zone_top
  const spxMid  = data?.spx_zone_mid
  const spxState= data?.spx_zone_state
  const esDBot  = data?.es_d_zone_bot
  const esDTop  = data?.es_d_zone_top
  const esDMid  = data?.es_d_zone_mid
  const esDState= data?.es_d_zone_state
  const es10Bot = data?.es_10m_zone_bot
  const es10Top = data?.es_10m_zone_top
  const es10Mid = data?.es_10m_zone_mid
  const es10State= data?.es_10m_zone_state

  const zones: any[] = data?.zones ?? []

  const marketStats = [
    { label: 'Mode',       value: data?.market_mode ?? data?.mode },
    { label: 'Break',      value: data?.break_state },
    { label: 'Bias',       value: data?.bias },
    { label: 'Day Bias',   value: data?.day_bias },
    { label: 'Flow',       value: data?.flow_state },
    { label: 'Gamma',      value: data?.gamma_state },
    { label: 'OI State',   value: data?.oi_state },
    { label: 'Trap',       value: data?.trap_state !== 'None' ? data?.trap_state : null },
    { label: 'Price Loc',  value: data?.price_location_state },
    { label: 'Structure',  value: data?.structure_state },
  ].filter(r => r.value)

  return (
    <>
      {/* ── GEX Key Levels ── */}
      <div className="panel">
        <div className="panel-title">Key GEX Levels — {isNdx ? 'NDX' : 'SPX'}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: (!isNdx && (distCall != null || distPut != null)) ? 10 : 0 }}>
          {pWall && (
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 5, background: 'rgba(255,51,68,0.06)', border: '1px solid rgba(255,51,68,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Put Wall</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{fmtNum(pWall)}</div>
            </div>
          )}
          {flip && (
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 5, background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>GEX Flip</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--yellow)' }}>{fmtNum(flip)}</div>
            </div>
          )}
          {cWall && (
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 5, background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--muted2)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Call Wall</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmtNum(cWall)}</div>
            </div>
          )}
        </div>
        {!isNdx && (distCall != null || distPut != null) && (
          <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {distPut  != null && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Dist put: <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{distPut}</span></span>}
            {distCall != null && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>Dist call: <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{distCall}</span></span>}
          </div>
        )}
      </div>

      {/* ── Scalp Signal ── */}
      {!isNdx && (data?.entry || data?.target || data?.stop_logic) && (
        <div className="panel">
          <div className="panel-title">Scalp Signal — 10m Zone to Zone</div>
          {data.entry     && <Row label="Entry"  value={data.entry} valClass="green" />}
          {data.target    && <Row label="Target" value={data.target} valClass="yellow" />}
          {data.stop_logic && <Row label="Stop"  value={data.stop_logic} valClass="red" />}
          {data.reason && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6, fontStyle: 'italic' }}>{data.reason}</div>}
        </div>
      )}

      {/* ── Zones ── */}
      {!isNdx && (es10Bot || esDBot || spxBot) && (
        <div className="panel">
          <div className="panel-title">ES 10M Zone — Intraday</div>
          {es10Bot && es10Top && <ZoneBox label="ES 10M Zone" bot={es10Bot} top={es10Top} mid={es10Mid} state={es10State} />}
          {esDBot && esDTop && (
            <>
              <div className="panel-title" style={{ marginTop: 10 }}>ES Daily Zone — Swing</div>
              <ZoneBox label="ES Daily" bot={esDBot} top={esDTop} mid={esDMid} state={esDState} />
            </>
          )}
          {spxBot && spxTop && (
            <>
              <div className="panel-title" style={{ marginTop: 10 }}>SPX Daily Zone — Context</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">Zone Bot</div><div className="zl-val">{fmtNum(spxBot, 2)}</div></div>
                <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">Zone Top</div><div className="zl-val">{fmtNum(spxTop, 2)}</div></div>
                <div className="zl" style={{ flex: 1, minWidth: 80 }}><div className="zl-label">State</div><div className="zl-val" style={{ fontSize: 9 }}>{spxState ?? '--'}</div></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── NDX details ── */}
      {isNdx && (
        <div className="panel">
          <div className="panel-title">NDX Key Levels</div>
          <Row label="Flip Zone"    value={fmtNum(ndxFlip)} valClass="yellow" />
          <Row label="Call Wall"    value={fmtNum(ndxCW)}   valClass="green" />
          <Row label="Put Wall"     value={fmtNum(ndxPW)}   valClass="red" />
          <Row label="Net GEX"      value={nd.net_gex_state ?? data?.ndx_net_gex_state} />
          <Row label="Gamma Regime" value={nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime} />
        </div>
      )}

      {/* ── Level details (SPX) ── */}
      {!isNdx && (
        <div className="panel">
          <div className="panel-title">Level Details</div>
          <Row label="Max Pain"     value={fmtNum(data?.max_pain_strike)} />
          <Row label="Net Delta"    value={data?.net_delta_dir} valClass={data?.net_delta_dir === 'LONG' ? 'green' : data?.net_delta_dir === 'SHORT' ? 'red' : ''} />
          <Row label="P/C Ratio"    value={data?.put_call_ratio ? parseFloat(data.put_call_ratio).toFixed(2) : null} />
          <Row label="Daily Open"   value={fmtNum(data?.daily_open, 2)} />
        </div>
      )}

      {/* ── Market States ── */}
      {marketStats.length > 0 && !isNdx && (
        <div className="panel">
          <div className="panel-title">Market States</div>
          <div className="stat-grid">
            {marketStats.map((s, i) => (
              <div key={i} className="stat">
                <div className="stat-label">{s.label}</div>
                <div className={`stat-val ${statValClass(s.value)}`} style={{ fontSize: 10 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Saved zones ── */}
      {!isNdx && zones.length > 0 && (
        <div className="panel">
          <div className="panel-title">Saved Zones</div>
          {zones.map((z: any, i: number) => (
            <Row
              key={i}
              label={z.label ?? `Zone ${i + 1}`}
              value={z.top && z.bot ? `${fmtNum(z.bot)} – ${fmtNum(z.top)}` : fmtNum(z.level ?? z.price)}
              valClass={z.type === 'support' ? 'green' : z.type === 'resistance' ? 'red' : ''}
            />
          ))}
        </div>
      )}
    </>
  )
}
