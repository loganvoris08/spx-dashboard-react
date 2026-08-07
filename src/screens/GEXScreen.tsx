import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'

function fmt(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function gexColor(regime?: string) {
  if (!regime) return 'var(--muted)'
  const u = regime.toUpperCase()
  if (u.includes('NEG')) return 'var(--red)'
  if (u.includes('POS') || u.includes('CALL')) return 'var(--green)'
  return 'var(--yellow)'
}

function FlowBar({ callPct, putPct, bias }: { callPct: number; putPct: number; bias: string }) {
  const biasColor = bias?.includes('CALL') ? 'var(--green)' : bias?.includes('PUT') ? 'var(--red)' : 'var(--muted)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)' }}>CALL {callPct.toFixed(0)}%</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: biasColor }}>{bias}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)' }}>PUT {putPct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${callPct}%`, background: 'var(--green)', borderRadius: '4px 0 0 4px', transition: 'width 0.4s' }} />
        <div style={{ width: `${putPct}%`, background: 'var(--red)',   borderRadius: '0 4px 4px 0', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function StatBox({ label, value, color, tip }: { label: string; value: any; color?: string; tip?: string }) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8,
      border: '1px solid var(--border)', minWidth: 0,
    }} title={tip}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: color ?? 'var(--text)' }}>{value ?? '--'}</div>
    </div>
  )
}

function HBars({ rows, priceStrike, callWall, putWall, flipZone }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number; flipZone: number
}) {
  if (!rows?.length) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No data</div>
  )

  const maxVal = Math.max(...rows.map((r: any) => Math.max(r.call_value || 0, r.put_value || 0)), 1)

  return (
    <div style={{ fontSize: 0 }}>
      {rows.map((row: any, i: number) => {
        const strike = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice    = row.is_price_zone || Math.abs(strike - priceStrike) < 3
        const isCallWall = callWall && Math.abs(strike - callWall) < 3
        const isPutWall  = putWall  && Math.abs(strike - putWall)  < 3
        const isFlip     = flipZone && Math.abs(strike - flipZone) < 3

        const callFill = Math.min(1, (row.call_value || 0) / maxVal)
        const putFill  = Math.min(1, (row.put_value  || 0) / maxVal)
        const callW    = `${(callFill * 48).toFixed(1)}%`
        const putW     = `${(putFill  * 48).toFixed(1)}%`

        const rowBg = isPrice    ? 'rgba(255,204,0,0.06)'
                    : isCallWall ? 'rgba(0,230,118,0.04)'
                    : isPutWall  ? 'rgba(255,23,68,0.04)'
                    : isFlip     ? 'rgba(255,204,0,0.03)'
                    : 'transparent'

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '44px 1fr 4px 1fr 44px',
            height: 18, alignItems: 'center',
            background: rowBg,
            borderBottom: '0.5px solid var(--border)',
          }}>
            {/* Put bar (left, reversed) */}
            <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: isPutWall ? 'var(--red)' : 'var(--muted2)', textAlign: 'right', paddingRight: 4 }}>
              {isPutWall ? '▼PUT' : row.put_value > 0 ? fmt(row.put_value, 0) : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', overflow: 'hidden', paddingRight: 2 }}>
              <div style={{ height: 5, width: putW, background: 'rgba(255,23,68,0.7)', borderRadius: '2px 0 0 2px', flexShrink: 0 }} />
            </div>

            {/* Center axis — price/flip indicator */}
            <div style={{
              width: 4, height: '100%',
              background: isPrice ? 'var(--yellow)' : isFlip ? 'rgba(255,204,0,0.4)' : 'var(--border2)',
              position: 'relative',
            }} />

            {/* Call bar (right) */}
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden', paddingLeft: 2 }}>
              <div style={{ height: 5, width: callW, background: 'rgba(0,230,118,0.7)', borderRadius: '0 2px 2px 0', flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: isCallWall ? 'var(--green)' : isPrice ? 'var(--yellow)' : 'var(--muted2)', paddingLeft: 4 }}>
              {isPrice ? `●${row.strike}` : isCallWall ? '▲CALL' : row.call_value > 0 ? fmt(row.call_value, 0) : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function GEXScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const isNdx = side === 'ndx'
  const [bucket, setBucket] = useState<Bucket>('all')
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}

  const regime      = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : data?.uw_gamma_regime
  const netGexState = isNdx ? (nd.net_gex_state ?? data?.ndx_net_gex_state)     : data?.net_gex_state
  const flipRaw     = isNdx ? (nd.gex_flip_zone_raw ?? data?.ndx_gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const cWall       = isNdx ? (nd.gex_nearest_call_wall ?? nd.nearest_call_wall ?? data?.ndx_gex_nearest_call_wall) : (data?.gex_nearest_call_wall ?? data?.nearest_call_wall)
  const pWall       = isNdx ? (nd.gex_nearest_put_wall  ?? nd.nearest_put_wall  ?? data?.ndx_gex_nearest_put_wall)  : (data?.gex_nearest_put_wall  ?? data?.nearest_put_wall)

  const dgDollar    = isNdx ? (nd.dealer_gamma_dollar_per_pct ?? data?.ndx_dealer_gamma_dollar_per_pct ?? 0) : (data?.dealer_gamma_dollar_per_pct ?? 0)
  const dgM         = (dgDollar / 1e6).toFixed(1)
  const dgColor     = dgDollar > 0 ? 'var(--green)' : dgDollar < 0 ? 'var(--red)' : 'var(--muted)'

  const callPct  = isNdx ? (nd.flow_call_pct ?? data?.ndx_flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct   = isNdx ? (nd.flow_put_pct  ?? data?.ndx_flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias = isNdx ? (nd.flow_bias      ?? data?.ndx_flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')

  const ndDelta  = data?.net_delta_dir ?? 'NEUTRAL'
  const ndColor  = ndDelta === 'LONG' ? 'var(--green)' : ndDelta === 'SHORT' ? 'var(--red)' : 'var(--muted)'
  const pcr      = data?.put_call_ratio

  const dhPressure = data?.delta_hedging_pressure ?? 'NEUTRAL'
  const dhColor    = dhPressure === 'BUYING' ? 'var(--green)' : dhPressure === 'SELLING' ? 'var(--red)' : 'var(--muted)'
  const charmFlow  = data?.charm_flow ?? '--'
  const vannaFlow  = data?.vanna_flow ?? '--'

  // Ladder data
  const spxPrice = data?.daily_open ?? 0
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceNum = isNdx ? ndxNum : spxPrice

  const flipNum  = parseFloat(String(flipRaw).replace(/,/g, '')) || 0
  const cwNum    = parseFloat(String(cWall).replace(/,/g, ''))   || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, ''))   || 0

  const bucketData = isNdx
    ? (ladders?.ndx?.gex_ladder_buckets?.[bucket] ?? ladders?.ndx?.gex_ladder_rows ?? [])
    : (ladders?.gex_ladder_buckets?.[bucket]       ?? ladders?.gex_ladder_rows      ?? [])

  const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']
  const regimeColor = gexColor(regime)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Regime header ── */}
      <div className="card" style={{
        background: `linear-gradient(135deg, var(--surface) 0%, ${regimeColor}08 100%)`,
        border: `1px solid ${regimeColor}22`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Gamma Regime — {isNdx ? 'NDX' : 'SPX'}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: regimeColor }}>
              {regime ?? '--'}
            </div>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 6,
            background: regimeColor + '15', border: `1px solid ${regimeColor}40`,
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: regimeColor,
          }}>
            {netGexState ?? '--'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatBox label="GEX Flip" value={fmt(flipRaw)} color="var(--yellow)" tip="Strike where net GEX crosses zero — directional acceleration zone" />
          <StatBox label="Call Wall" value={fmt(cWall)} color="var(--green)" tip="Nearest strike with heavy call GEX — acts as ceiling" />
          <StatBox label="Put Wall"  value={fmt(pWall)} color="var(--red)"   tip="Nearest strike with heavy put GEX — acts as floor" />
          {!isNdx && <StatBox label="Dealer γ/1%" value={(parseFloat(dgM) >= 0 ? '+' : '') + dgM + 'M'} color={dgColor} tip="Dealer gamma $ per 1% move" />}
          {!isNdx && pcr && <StatBox label="P/C Ratio" value={parseFloat(pcr).toFixed(2)} color={parseFloat(pcr) > 1.2 ? 'var(--red)' : parseFloat(pcr) < 0.7 ? 'var(--green)' : undefined} />}
        </div>
      </div>

      {/* ── Flow bias bars ── */}
      <div className="card">
        <div className="card-title">GEX Flow Bias — {isNdx ? 'NDX' : 'SPX'}</div>
        <FlowBar callPct={callPct} putPct={putPct} bias={flowBias} />
      </div>

      {/* ── Delta hedging (SPX only) ── */}
      {!isNdx && (
        <div className="card">
          <div className="card-title">Delta Hedging Pressure</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatBox label="DH Pressure" value={dhPressure} color={dhColor} />
            <StatBox label="Net Delta"   value={ndDelta}    color={ndColor} />
            <StatBox label="Charm Flow"  value={charmFlow}  color={charmFlow === 'BUYING' ? 'var(--green)' : charmFlow === 'SELLING' ? 'var(--red)' : undefined} />
            <StatBox label="Vanna"       value={vannaFlow}  color={vannaFlow === 'AMPLIFIED' ? 'var(--red)' : vannaFlow === 'ELEVATED' ? 'var(--yellow)' : undefined} />
          </div>
          {data?.delta_hedging_note && (
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              {data.delta_hedging_note}
            </p>
          )}
        </div>
      )}

      {/* ── GEX horizontal bar chart ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
          <div className="card-title" style={{ margin: 0 }}>GEX Ladder — {isNdx ? 'NDX' : 'SPX'}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <button key={b} onClick={() => setBucket(b)} style={{
                fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 3,
                border: `1px solid ${bucket === b ? 'var(--green)' : 'var(--border2)'}`,
                background: bucket === b ? 'var(--green-bg)' : 'none',
                color: bucket === b ? 'var(--green)' : 'var(--muted)',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{b}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <HBars
            rows={bucketData}
            priceStrike={priceNum}
            callWall={cwNum}
            putWall={pwNum}
            flipZone={flipNum}
          />
        </div>
        {!ladders && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading ladder data…</div>
        )}
      </div>

    </div>
  )
}
