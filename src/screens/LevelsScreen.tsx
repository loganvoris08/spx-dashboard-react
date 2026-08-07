import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'

function fmt(v: any, decimals = 0) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function LevelRow({ label, value, color, sub }: { label: string; value: any; color?: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
        {sub && <div style={{ color: 'var(--muted2)', fontSize: 10, marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: color ?? 'var(--text)' }}>
        {value != null && value !== '' ? value : '--'}
      </span>
    </div>
  )
}

function ZoneBar({ bot, top, mid, current, label }: { bot: number; top: number; mid: number; current: number; label: string }) {
  if (!bot || !top || !current) return null
  const range = top - bot
  const pct = Math.min(100, Math.max(0, ((current - bot) / range) * 100))
  const midPct = ((mid - bot) / range) * 100
  const inZone = current >= bot && current <= top
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 10, color: inZone ? 'var(--green)' : 'var(--muted2)', fontFamily: 'var(--mono)' }}>
          {inZone ? 'IN ZONE' : current > top ? 'ABOVE' : 'BELOW'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 24, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '40%', height: 1,
          background: 'var(--border2)',
        }} />
        <div style={{
          position: 'absolute', left: `${midPct}%`, top: 0, bottom: 0, width: 1,
          background: 'rgba(255,204,0,0.4)',
        }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '20%', bottom: '20%',
          width: 2, background: 'var(--yellow)', borderRadius: 1,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 6px rgba(255,204,0,0.8)',
        }} />
        <div style={{
          position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)',
        }}>{fmt(bot)}</div>
        <div style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted2)',
        }}>{fmt(top)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>mid {fmt(mid, 2)}</span>
        <span style={{ fontSize: 9, color: 'var(--yellow)', fontFamily: 'var(--mono)' }}>● {fmt(current, 2)}</span>
      </div>
    </div>
  )
}

function WallChip({ label, value, color }: { label: string; value: any; color: string }) {
  if (!value || value === '--') return null
  return (
    <div style={{
      flex: 1, padding: '10px 12px', borderRadius: 8,
      background: color + '10', border: `1px solid ${color}30`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color }}>{fmt(value)}</div>
    </div>
  )
}

export default function LevelsScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const nd = data?.ndx ?? {}

  const spxPrice   = data?.daily_open ?? data?.spx_zone_mid ?? null
  const ndxPrice   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? null
  const currentPx  = isNdx ? ndxPrice : spxPrice

  // SPX zones
  const spxBot  = data?.spx_zone_bot
  const spxTop  = data?.spx_zone_top
  const spxMid  = data?.spx_zone_mid
  const spxState = data?.spx_zone_state

  // ES daily zones
  const esDBot = data?.es_d_zone_bot
  const esDTop = data?.es_d_zone_top
  const esDMid = data?.es_d_zone_mid

  // ES 10m zones
  const es10Bot = data?.es_10m_zone_bot
  const es10Top = data?.es_10m_zone_top
  const es10Mid = data?.es_10m_zone_mid

  // GEX walls — SPX
  const spxFlip  = data?.gex_flip_zone_raw || data?.gex_flip_zone
  const spxCWall = data?.nearest_call_wall || data?.gex_nearest_call_wall
  const spxPWall = data?.nearest_put_wall  || data?.gex_nearest_put_wall
  const distCall = data?.dist_to_call
  const distPut  = data?.dist_to_put

  // GEX walls — NDX
  const ndxFlip  = nd.gex_flip_zone_raw || data?.ndx_gex_flip_zone
  const ndxCWall = nd.nearest_call_wall  || nd.gex_nearest_call_wall || data?.ndx_nearest_call_wall
  const ndxPWall = nd.nearest_put_wall   || nd.gex_nearest_put_wall  || data?.ndx_nearest_put_wall

  const flip  = isNdx ? ndxFlip  : spxFlip
  const cWall = isNdx ? ndxCWall : spxCWall
  const pWall = isNdx ? ndxPWall : spxPWall

  // Custom zones
  const zones: any[] = data?.zones ?? []

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Wall chips ── */}
      <div className="card">
        <div className="card-title">Key GEX Levels — {isNdx ? 'NDX' : 'SPX'}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <WallChip label="Put Wall" value={pWall} color="var(--red)" />
          <WallChip label="GEX Flip" value={flip}  color="var(--yellow)" />
          <WallChip label="Call Wall" value={cWall} color="var(--green)" />
        </div>
        {!isNdx && (distCall != null || distPut != null) && (
          <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {distPut  != null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Dist to put wall: <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{distPut}</span></span>}
            {distCall != null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Dist to call wall: <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{distCall}</span></span>}
          </div>
        )}
      </div>

      {/* ── SPX Zone bar ── */}
      {!isNdx && spxBot && spxTop && (
        <div className="card">
          <div className="card-title">SPX Zone</div>
          <ZoneBar bot={spxBot} top={spxTop} mid={spxMid ?? (spxBot + spxTop) / 2} current={spxPrice ?? spxMid} label={spxState ?? 'SPX Zone'} />
          <div style={{ display: 'flex', gap: 16 }}>
            <LevelRow label="Zone Bottom" value={fmt(spxBot, 2)} />
            <LevelRow label="Zone Top"    value={fmt(spxTop, 2)} />
          </div>
        </div>
      )}

      {/* ── ES Daily zone ── */}
      {!isNdx && esDBot && esDTop && (
        <div className="card">
          <div className="card-title">ES Daily Zone</div>
          <ZoneBar bot={esDBot} top={esDTop} mid={esDMid ?? (esDBot + esDTop) / 2} current={spxPrice ?? esDMid} label="ES Daily" />
          <LevelRow label="Mid" value={fmt(esDMid, 2)} />
        </div>
      )}

      {/* ── ES 10m zone ── */}
      {!isNdx && es10Bot && es10Top && (
        <div className="card">
          <div className="card-title">ES 10-Minute Zone</div>
          <ZoneBar bot={es10Bot} top={es10Top} mid={es10Mid ?? (es10Bot + es10Top) / 2} current={spxPrice ?? es10Mid} label="ES 10m" />
          <LevelRow label="Mid" value={fmt(es10Mid, 2)} />
        </div>
      )}

      {/* ── Additional GEX level details ── */}
      <div className="card">
        <div className="card-title">Level Details — {isNdx ? 'NDX' : 'SPX'}</div>
        {!isNdx && <>
          <LevelRow label="Max Pain Strike"    value={fmt(data?.max_pain_strike)} sub={data?.max_pain_dte?.toUpperCase()} />
          <LevelRow label="Net Delta Direction" value={data?.net_delta_dir} color={data?.net_delta_dir === 'LONG' ? 'var(--green)' : data?.net_delta_dir === 'SHORT' ? 'var(--red)' : undefined} />
          <LevelRow label="Put/Call Ratio"     value={data?.put_call_ratio ? parseFloat(data.put_call_ratio).toFixed(2) : null} />
          <LevelRow label="Daily Open"         value={fmt(data?.daily_open, 2)} />
        </>}
        {isNdx && <>
          <LevelRow label="NDX Flip Zone"   value={fmt(ndxFlip)} color="var(--yellow)" />
          <LevelRow label="NDX Call Wall"   value={fmt(ndxCWall)} color="var(--green)" />
          <LevelRow label="NDX Put Wall"    value={fmt(ndxPWall)} color="var(--red)" />
          <LevelRow label="NDX Net GEX"     value={nd.net_gex_state ?? data?.ndx_net_gex_state} />
          <LevelRow label="NDX Gamma Regime" value={nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime} />
        </>}
      </div>

      {/* ── Custom zones ── */}
      {!isNdx && zones.length > 0 && (
        <div className="card">
          <div className="card-title">Saved Zones</div>
          {zones.map((z: any, i: number) => (
            <LevelRow
              key={i}
              label={z.label ?? `Zone ${i + 1}`}
              value={z.top && z.bot ? `${fmt(z.bot)} – ${fmt(z.top)}` : fmt(z.level ?? z.price)}
              color={z.type === 'support' ? 'var(--green)' : z.type === 'resistance' ? 'var(--red)' : undefined}
            />
          ))}
        </div>
      )}

    </div>
  )
}
