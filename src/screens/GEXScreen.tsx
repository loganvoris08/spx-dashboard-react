import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'
const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']

function fmtNum(v: any, d = 0) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (Math.abs(n) >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function GEXHBars({ rows, priceStrike, flipStrike }: { rows: any[]; priceStrike: number; flipStrike: number }) {
  if (!rows?.length) return (
    <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No ladder data</div>
  )
  const maxVal = Math.max(...rows.map((r: any) => Math.max(Math.abs(r.call_gex || 0), Math.abs(r.put_gex || 0), Math.abs(r.net_gex || 0))), 1)

  return (
    <div>
      {rows.map((row: any, i: number) => {
        const strike   = parseFloat(String(row.strike).replace(/,/g, ''))
        const isPrice  = priceStrike && Math.abs(strike - priceStrike) < 3
        const isFlip   = flipStrike  && Math.abs(strike - flipStrike)  < 3
        const cGex = row.call_gex ?? (row.net_gex && row.net_gex > 0 ? row.net_gex : 0)
        const pGex = row.put_gex  ?? (row.net_gex && row.net_gex < 0 ? Math.abs(row.net_gex) : 0)
        const cFill = Math.min(1, Math.abs(cGex) / maxVal)
        const pFill = Math.min(1, Math.abs(pGex) / maxVal)
        const bg = isPrice ? 'rgba(255,204,0,0.07)' : isFlip ? 'rgba(240,0,255,0.05)' : 'transparent'

        return (
          <div key={i} className="gex-hrow" style={{ background: bg }}>
            <div className="hbar-strike" style={{ color: isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : 'var(--muted2)' }}>
              {row.strike}
            </div>
            <div className="hbar-left">
              <div className="hbar-fill-put" style={{ width: `${pFill * 100}%`, background: 'rgba(255,51,68,0.75)' }} />
            </div>
            <div className="hbar-divider" style={{ width: 16, background: isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : 'var(--border2)', height: '100%' }} />
            <div className="hbar-right">
              <div className="hbar-fill-call" style={{ width: `${cFill * 100}%`, background: cGex >= 0 ? 'rgba(0,255,136,0.75)' : 'rgba(255,51,68,0.75)', position: 'absolute', left: 0, right: 'auto', borderRadius: '0 2px 2px 0' }} />
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
  const [dealerText, setDealerText] = useState('')
  const [loadingDealer, setLoadingDealer] = useState(false)
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}
  const regime   = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
  const netGex   = isNdx ? (nd.net_gex_state ?? data?.ndx_net_gex_state) : data?.net_gex_state
  const flip     = isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const maxPain  = !isNdx ? data?.max_pain_strike : null
  const cWall    = isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall    = isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const netDelta = !isNdx ? data?.net_delta_dir : null
  const flowBias = isNdx ? (nd.flow_bias ?? data?.ndx_flow_bias) : data?.flow_bias
  const pcRatio  = !isNdx ? data?.put_call_ratio : null

  const callPct  = isNdx ? (nd.flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct   = isNdx ? (nd.flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const gammaPerPct = !isNdx ? data?.dealer_gamma_dollar_per_pct : null
  const dhPressure  = isNdx ? nd.delta_hedging_pressure : data?.delta_hedging_pressure
  const charm    = isNdx ? nd.charm_flow  : data?.charm_flow
  const vanna    = isNdx ? nd.vanna_flow  : data?.vanna_flow

  const priceNum = data?.daily_open ?? 0
  const flipNum  = parseFloat(String(flip).replace(/,/g, '')) || 0
  const bucketData = isNdx
    ? (ladders?.ndx?.gex_ladder_buckets?.[bucket] ?? ladders?.ndx?.gex_rows ?? [])
    : (ladders?.gex_ladder_buckets?.[bucket] ?? ladders?.gex_rows ?? [])

  async function loadDealer() {
    setLoadingDealer(true)
    try { setDealerText(await postAiRead('/api/gex-read')) }
    catch (e: any) { setDealerText('Error: ' + e.message) }
    finally { setLoadingDealer(false) }
  }

  const keyStats = [
    { label: 'Regime',    value: regime },
    { label: 'Net GEX',   value: netGex },
    { label: 'Flip',      value: fmtNum(flip),  col: 'var(--yellow)' },
    { label: 'Call Wall', value: fmtNum(cWall), col: 'var(--green)'  },
    { label: 'Put Wall',  value: fmtNum(pWall), col: 'var(--red)'    },
    { label: 'Net Delta', value: netDelta,  col: netDelta === 'LONG' ? 'var(--green)' : netDelta === 'SHORT' ? 'var(--red)' : undefined },
    { label: 'Flow',      value: flowBias  },
    { label: 'P/C',       value: pcRatio ? parseFloat(pcRatio).toFixed(2) : null },
  ].filter(x => x.value)

  return (
    <>
      {/* ── Key levels strip ── */}
      <div className="panel">
        <div className="panel-title">GEX Key Levels — {isNdx ? 'NDX' : 'SPX'}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {keyStats.map((x, i) => (
            <div key={i} className="stat" style={{ minWidth: 72, flex: 1 }}>
              <div className="stat-label">{x.label}</div>
              <div className="stat-val" style={{ color: x.col ?? 'var(--text)', fontSize: 10 }}>{x.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dealer Read ── */}
      <div className="panel">
        <div className="panel-title">Dealer Read</div>
        <button className="ai-read-btn" onClick={loadDealer} disabled={loadingDealer}>
          {loadingDealer ? '⚡ LOADING...' : dealerText ? '↻ REFRESH DEALER READ' : '⚡ GET DEALER READ FROM CLAUDE'}
        </button>
        {dealerText && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>{dealerText}</div>
        )}
      </div>

      {/* ── GEX Ladder ── */}
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="panel-title" style={{ margin: 0 }}>Gamma Exposure by Strike</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <span key={b} className={`expiry-btn${bucket === b ? ' active' : ''}`} onClick={() => setBucket(b)}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--red)' }}>◀ PUT GEX</span>
          <span style={{ color: 'var(--muted2)' }}>|</span>
          <span style={{ color: 'var(--green)' }}>CALL GEX ▶</span>
        </div>
        <GEXHBars rows={bucketData} priceStrike={priceNum} flipStrike={flipNum} />
        {!ladders && <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

      {/* ── Flow Pressure ── */}
      <div className="panel">
        <div className="panel-title">Flow Pressure</div>
        <div className="flow-bar-wrap">
          <div className="flow-labels">
            <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>CALLS {callPct.toFixed(0)}%</span>
            <span style={{ color: 'var(--muted2)', fontSize: 8 }}>{flowBias ?? '--'}</span>
            <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>{putPct.toFixed(0)}% PUTS</span>
          </div>
          <div className="flow-bar">
            <div className="flow-bar-call" style={{ width: `${callPct}%` }} />
            <div className="flow-bar-put"  style={{ width: `${putPct}%`  }} />
          </div>
        </div>
        {gammaPerPct != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>Dealer Gamma / 1% Move</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmtNum(gammaPerPct)}</span>
          </div>
        )}
      </div>

      {/* ── Delta Hedging ── */}
      <div className="panel">
        <div className="panel-title">Delta Hedging Flow</div>
        <div className="stat-grid">
          {dhPressure && <div className="stat"><div className="stat-label">DH Pressure</div><div className="stat-val" style={{ fontSize: 10 }}>{dhPressure}</div></div>}
          {charm      && <div className="stat"><div className="stat-label">Charm Flow</div><div className="stat-val" style={{ fontSize: 10 }}>{charm}</div></div>}
          {vanna      && <div className="stat"><div className="stat-label">Vanna</div><div className="stat-val" style={{ fontSize: 10 }}>{vanna}</div></div>}
          {maxPain != null && <div className="stat"><div className="stat-label">Max Pain</div><div className="stat-val" style={{ fontSize: 10 }}>{fmtNum(maxPain)}</div></div>}
        </div>
      </div>
    </>
  )
}
