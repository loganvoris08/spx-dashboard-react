import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function fmtNum(v: any, d = 0) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function WallChip({ label, value, color }: { label: string; value: any; color: string }) {
  if (!value || value === '--') return null
  return (
    <div style={{
      flex: 1, padding: '8px 10px', borderRadius: 5,
      background: color + '0e', border: `1px solid ${color}33`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color }}>{fmtNum(value)}</div>
    </div>
  )
}

function ZoneBar({ bot, top, mid, current, label }: { bot: number; top: number; mid: number; current: number; label: string }) {
  if (!bot || !top || !current) return null
  const range  = top - bot
  const pct    = Math.min(100, Math.max(0, ((current - bot) / range) * 100))
  const midPct = ((mid - bot) / range) * 100
  const inZone = current >= bot && current <= top
  const state  = inZone ? 'IN ZONE' : current > top ? 'ABOVE' : 'BELOW'
  const stColor = inZone ? 'var(--green)' : current > top ? 'var(--green)' : 'var(--red2)'

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 9, color: stColor, fontFamily: 'var(--mono)', fontWeight: 700 }}>{state}</span>
      </div>
      <div style={{ position: 'relative', height: 20, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: `${midPct}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,204,0,0.35)' }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '15%', bottom: '15%', width: 2,
          background: 'var(--yellow)', borderRadius: 1, transform: 'translateX(-50%)',
          boxShadow: '0 0 5px rgba(255,204,0,0.7)',
        }} />
        <div style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)' }}>{fmtNum(bot, 2)}</div>
        <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)' }}>{fmtNum(top, 2)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>mid {fmtNum(mid, 2)}</span>
        <span style={{ fontSize: 8, color: 'var(--yellow)', fontFamily: 'var(--mono)' }}>● {fmtNum(current, 2)}</span>
      </div>
    </div>
  )
}

function Row({ label, value, color, sub }: { label: string; value: any; color?: string; sub?: string }) {
  return (
    <div className="data-row">
      <div>
        <span className="data-label">{label}</span>
        {sub && <span style={{ color: 'var(--muted2)', fontSize: 9, marginLeft: 6 }}>{sub}</span>}
      </div>
      <span className="data-val" style={{ color: color ?? 'var(--text)' }}>{value ?? '--'}</span>
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const nd = data?.ndx ?? {}

  const spxPrice = data?.daily_open ?? data?.spx_zone_mid ?? null

  const spxBot  = data?.spx_zone_bot
  const spxTop  = data?.spx_zone_top
  const spxMid  = data?.spx_zone_mid
  const spxState= data?.spx_zone_state
  const esDBot  = data?.es_d_zone_bot
  const esDTop  = data?.es_d_zone_top
  const esDMid  = data?.es_d_zone_mid
  const es10Bot = data?.es_10m_zone_bot
  const es10Top = data?.es_10m_zone_top
  const es10Mid = data?.es_10m_zone_mid

  const spxFlip = data?.gex_flip_zone_raw || data?.gex_flip_zone
  const spxCW   = data?.nearest_call_wall || data?.gex_nearest_call_wall
  const spxPW   = data?.nearest_put_wall  || data?.gex_nearest_put_wall
  const distCall= data?.dist_to_call
  const distPut = data?.dist_to_put

  const ndxFlip = nd.gex_flip_zone_raw || data?.ndx_gex_flip_zone
  const ndxCW   = nd.nearest_call_wall  || nd.gex_nearest_call_wall || data?.ndx_nearest_call_wall
  const ndxPW   = nd.nearest_put_wall   || nd.gex_nearest_put_wall  || data?.ndx_nearest_put_wall

  const flip  = isNdx ? ndxFlip : spxFlip
  const cWall = isNdx ? ndxCW   : spxCW
  const pWall = isNdx ? ndxPW   : spxPW

  const zones: any[] = data?.zones ?? []

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Wall chips ── */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div className="card-title">Key GEX Levels — {isNdx ? 'NDX' : 'SPX'}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: !isNdx && (distCall != null || distPut != null) ? 10 : 0 }}>
          <WallChip label="Put Wall"  value={pWall} color="var(--red)"    />
          <WallChip label="GEX Flip"  value={flip}  color="var(--yellow)" />
          <WallChip label="Call Wall" value={cWall} color="var(--green)"  />
        </div>
        {!isNdx && (distCall != null || distPut != null) && (
          <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {distPut  != null && <span style={{ fontSize: 10, color: 'var(--muted)' }}>Dist put: <span style={{ color: 'var(--red)',   fontFamily: 'var(--mono)' }}>{distPut}</span></span>}
            {distCall != null && <span style={{ fontSize: 10, color: 'var(--muted)' }}>Dist call: <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{distCall}</span></span>}
          </div>
        )}
      </div>

      {/* ── Zone bars ── */}
      {!isNdx && (spxBot || esDBot || es10Bot) && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Price Zones</div>
          {spxBot && spxTop && <ZoneBar bot={spxBot} top={spxTop} mid={spxMid ?? (spxBot + spxTop) / 2} current={spxPrice ?? spxMid} label={spxState ?? 'SPX Zone'} />}
          {esDBot && esDTop && <ZoneBar bot={esDBot} top={esDTop} mid={esDMid ?? (esDBot + esDTop) / 2} current={spxPrice ?? esDMid} label="ES Daily Zone" />}
          {es10Bot && es10Top && <ZoneBar bot={es10Bot} top={es10Top} mid={es10Mid ?? (es10Bot + es10Top) / 2} current={spxPrice ?? es10Mid} label="ES 10-Min Zone" />}
        </div>
      )}

      {/* ── Level details ── */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div className="card-title">Level Details — {isNdx ? 'NDX' : 'SPX'}</div>
        {!isNdx ? <>
          <Row label="Max Pain Strike"     value={fmtNum(data?.max_pain_strike)} sub={data?.max_pain_dte?.toUpperCase()} />
          <Row label="Net Delta Direction" value={data?.net_delta_dir} color={data?.net_delta_dir === 'LONG' ? 'var(--green)' : data?.net_delta_dir === 'SHORT' ? 'var(--red)' : undefined} />
          <Row label="Put/Call Ratio"      value={data?.put_call_ratio ? parseFloat(data.put_call_ratio).toFixed(2) : null} />
          <Row label="Daily Open"          value={fmtNum(data?.daily_open, 2)} />
          <Row label="Zone State"          value={spxState} />
        </> : <>
          <Row label="NDX Flip Zone"    value={fmtNum(ndxFlip)} color="var(--yellow)" />
          <Row label="NDX Call Wall"    value={fmtNum(ndxCW)}   color="var(--green)" />
          <Row label="NDX Put Wall"     value={fmtNum(ndxPW)}   color="var(--red)" />
          <Row label="NDX Net GEX"      value={nd.net_gex_state ?? data?.ndx_net_gex_state} />
          <Row label="NDX Gamma Regime" value={nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime} />
        </>}
      </div>

      {/* ── Saved zones ── */}
      {!isNdx && zones.length > 0 && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Saved Zones</div>
          {zones.map((z: any, i: number) => (
            <Row
              key={i}
              label={z.label ?? `Zone ${i + 1}`}
              value={z.top && z.bot ? `${fmtNum(z.bot)} – ${fmtNum(z.top)}` : fmtNum(z.level ?? z.price)}
              color={z.type === 'support' ? 'var(--green)' : z.type === 'resistance' ? 'var(--red)' : undefined}
            />
          ))}
        </div>
      )}

    </div>
  )
}
