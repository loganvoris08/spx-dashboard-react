import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'
const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']

function fmtNum(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function regimeClass(r?: string) {
  if (!r) return 'regime-neut'
  const u = r.toUpperCase()
  if (u.includes('NEG')) return 'regime-neg'
  if (u.includes('POS') || u.includes('STRONG')) return 'regime-pos'
  return 'regime-neut'
}

function StatGrid({ items }: { items: { label: string; value: any; color?: string; tip?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 5 }}>
      {items.map((s, i) => (
        <div key={i} className="stat" title={s.tip}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-val" style={{ color: s.color ?? 'var(--text)', fontSize: 12 }}>{s.value ?? '--'}</div>
        </div>
      ))}
    </div>
  )
}

function FlowBar({ callPct, putPct, bias }: { callPct: number; putPct: number; bias: string }) {
  const biasColor = bias?.includes('CALL') ? 'var(--green)' : bias?.includes('PUT') ? 'var(--red)' : 'var(--muted)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green)' }}>CALL {callPct.toFixed(0)}%</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: biasColor, letterSpacing: '0.08em' }}>{bias || 'BALANCED'}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)' }}>PUT {putPct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${callPct}%`, background: 'var(--green)', borderRadius: '3px 0 0 3px', transition: 'width 0.4s' }} />
        <div style={{ width: `${putPct}%`, background: 'var(--red)',   borderRadius: '0 3px 3px 0', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function GEXHBars({ rows, priceStrike, callWall, putWall, flipZone }: {
  rows: any[]; priceStrike: number; callWall: number; putWall: number; flipZone: number
}) {
  if (!rows?.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No data</div>
  )
  const maxVal = Math.max(...rows.map((r: any) => Math.max(r.call_value || 0, r.put_value || 0)), 1)

  return (
    <div>
      {rows.map((row: any, i: number) => {
        const strike    = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice   = row.is_price_zone || (priceStrike && Math.abs(strike - priceStrike) < 3)
        const isCall    = callWall && Math.abs(strike - callWall) < 3
        const isPut     = putWall  && Math.abs(strike - putWall)  < 3
        const isFlip    = flipZone && Math.abs(strike - flipZone) < 3

        const cFill = Math.min(1, (row.call_value || 0) / maxVal)
        const pFill = Math.min(1, (row.put_value  || 0) / maxVal)

        const bg = isPrice ? 'rgba(255,204,0,0.06)'
                 : isCall  ? 'rgba(0,255,136,0.04)'
                 : isPut   ? 'rgba(255,51,68,0.04)'
                 : isFlip  ? 'rgba(255,204,0,0.03)'
                 : 'transparent'

        return (
          <div key={i} className="hbar-row" style={{ background: bg }}>
            <div className={`hbar-label${isPut ? ' put-wall' : ''}`}>
              {isPut ? '▼PUT' : row.put_value > 0 ? fmtNum(row.put_value) : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', overflow: 'hidden', paddingRight: 2 }}>
              <div style={{
                height: 5, width: `${pFill * 100}%`, maxWidth: '100%',
                background: 'rgba(255,51,68,0.75)', borderRadius: '2px 0 0 2px', flexShrink: 0,
              }} />
            </div>
            <div style={{
              width: 4, height: '100%',
              background: isPrice ? 'var(--yellow)' : isFlip ? 'rgba(255,204,0,0.35)' : 'var(--border)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden', paddingLeft: 2 }}>
              <div style={{
                height: 5, width: `${cFill * 100}%`, maxWidth: '100%',
                background: 'rgba(0,255,136,0.75)', borderRadius: '0 2px 2px 0', flexShrink: 0,
              }} />
            </div>
            <div className={`hbar-label${isCall ? ' call-wall' : isPrice ? ' price-row' : ''}`} style={{ textAlign: 'left', paddingRight: 0, paddingLeft: 5 }}>
              {isPrice ? `●${row.strike}` : isCall ? '▲CALL' : row.call_value > 0 ? fmtNum(row.call_value) : ''}
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

  const regime  = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : data?.uw_gamma_regime
  const netState= isNdx ? (nd.net_gex_state   ?? data?.ndx_net_gex_state)   : data?.net_gex_state
  const flipRaw = isNdx ? (nd.gex_flip_zone_raw ?? data?.ndx_gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const cWall   = isNdx ? (nd.gex_nearest_call_wall ?? nd.nearest_call_wall ?? data?.ndx_gex_nearest_call_wall) : (data?.gex_nearest_call_wall ?? data?.nearest_call_wall)
  const pWall   = isNdx ? (nd.gex_nearest_put_wall  ?? nd.nearest_put_wall  ?? data?.ndx_gex_nearest_put_wall)  : (data?.gex_nearest_put_wall  ?? data?.nearest_put_wall)
  const dgDollar= isNdx ? (nd.dealer_gamma_dollar_per_pct ?? data?.ndx_dealer_gamma_dollar_per_pct ?? 0) : (data?.dealer_gamma_dollar_per_pct ?? 0)
  const dgM     = (dgDollar / 1e6)
  const callPct = isNdx ? (nd.flow_call_pct ?? data?.ndx_flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct  = isNdx ? (nd.flow_put_pct  ?? data?.ndx_flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const flowBias= isNdx ? (nd.flow_bias ?? data?.ndx_flow_bias ?? 'BALANCED') : (data?.flow_bias ?? 'BALANCED')
  const ndDelta = data?.net_delta_dir ?? 'NEUTRAL'
  const pcr     = data?.put_call_ratio
  const dhPressure = data?.delta_hedging_pressure ?? '--'
  const charmFlow  = data?.charm_flow ?? '--'
  const vannaFlow  = data?.vanna_flow ?? '--'

  const spxPrice = data?.daily_open ?? 0
  const ndxNum   = typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0
  const priceNum = isNdx ? ndxNum : spxPrice
  const flipNum  = parseFloat(String(flipRaw).replace(/,/g, '')) || 0
  const cwNum    = parseFloat(String(cWall).replace(/,/g, ''))   || 0
  const pwNum    = parseFloat(String(pWall).replace(/,/g, ''))   || 0

  const bucketData = isNdx
    ? (ladders?.ndx?.gex_ladder_buckets?.[bucket] ?? ladders?.ndx?.gex_ladder_rows ?? [])
    : (ladders?.gex_ladder_buckets?.[bucket]       ?? ladders?.gex_ladder_rows      ?? [])

  const rClass = regimeClass(regime)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Regime header ── */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              Gamma Regime — {isNdx ? 'NDX' : 'SPX'}
            </div>
            <div className={`glow-green`} style={{
              fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800,
              color: rClass === 'regime-pos' ? 'var(--green)' : rClass === 'regime-neg' ? 'var(--red)' : 'var(--muted)',
            }}>
              {regime ?? '--'}
            </div>
          </div>
          <div className={`regime-badge ${rClass}`}>{netState ?? '--'}</div>
        </div>

        <StatGrid items={[
          { label: 'GEX Flip',   value: fmtNum(flipRaw), color: 'var(--yellow)', tip: 'Zero-gamma strike — acceleration zone' },
          { label: 'Call Wall',  value: fmtNum(cWall),   color: 'var(--green)',  tip: 'Nearest heavy call GEX — ceiling' },
          { label: 'Put Wall',   value: fmtNum(pWall),   color: 'var(--red)',    tip: 'Nearest heavy put GEX — floor' },
          ...(!isNdx ? [{ label: 'Dealer γ/1%', value: (dgM >= 0 ? '+' : '') + dgM.toFixed(1) + 'M', color: dgM > 0 ? 'var(--green)' : dgM < 0 ? 'var(--red)' : undefined }] : []),
          ...(!isNdx && pcr ? [{ label: 'P/C Ratio', value: parseFloat(pcr).toFixed(2), color: parseFloat(pcr) > 1.2 ? 'var(--red)' : parseFloat(pcr) < 0.7 ? 'var(--green)' : undefined }] : []),
        ]} />
      </div>

      {/* ── Flow bias ── */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div className="card-title">Flow Bias — {isNdx ? 'NDX' : 'SPX'}</div>
        <FlowBar callPct={callPct} putPct={putPct} bias={flowBias} />
      </div>

      {/* ── Delta hedging (SPX only) ── */}
      {!isNdx && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="card-title">Delta Hedging</div>
          <StatGrid items={[
            { label: 'DH Pressure', value: dhPressure, color: dhPressure === 'BUYING' || dhPressure === 'BULLISH' ? 'var(--green)' : dhPressure === 'SELLING' || dhPressure === 'BEARISH' ? 'var(--red)' : undefined },
            { label: 'Net Delta',   value: ndDelta,    color: ndDelta === 'LONG' ? 'var(--green)' : ndDelta === 'SHORT' ? 'var(--red)' : undefined },
            { label: 'Charm',       value: charmFlow,  color: charmFlow === 'BUYING' ? 'var(--green)' : charmFlow === 'SELLING' ? 'var(--red)' : undefined },
            { label: 'Vanna',       value: vannaFlow,  color: vannaFlow === 'AMPLIFIED' ? 'var(--red)' : vannaFlow === 'ELEVATED' ? 'var(--yellow)' : undefined },
          ]} />
          {data?.delta_hedging_note && (
            <p style={{ color: 'var(--text2)', fontSize: 11, lineHeight: 1.6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              {data.delta_hedging_note}
            </p>
          )}
        </div>
      )}

      {/* ── GEX Ladder ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title" style={{ margin: 0 }}>GEX Ladder — {isNdx ? 'NDX' : 'SPX'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <button key={b} onClick={() => setBucket(b)} className={`bucket-btn${bucket === b ? ' active' : ''}`}>{b}</button>
            ))}
          </div>
        </div>
        <GEXHBars rows={bucketData} priceStrike={priceNum} callWall={cwNum} putWall={pwNum} flipZone={flipNum} />
        {!ladders && <div style={{ padding: '14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

    </div>
  )
}
