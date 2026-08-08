import { useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'

type Bucket = '0dte' | 'weekly' | 'monthly' | 'all'
const BUCKETS: Bucket[] = ['0dte', 'weekly', 'monthly', 'all']

function GexSparkline({ rows }: { rows: any[] }) {
  if (!rows?.length) return null
  const W = 300, H = 80, pad = 4
  const vals = rows.map((r: any) => parseFloat(r.gex) || 0)
  const mn = Math.min(...vals), mx = Math.max(...vals)
  const rng = Math.max(mx - mn, 0.01)
  const yOf = (v: number) => pad + (H - 2 * pad) * (1 - (v - mn) / rng)
  const pts = vals.map((v, i) => `${(i / (vals.length - 1 || 1) * (W - 2 * pad) + pad).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const hasZero = mn < 0 && mx > 0
  const zy = yOf(0).toFixed(1)
  const last = rows[rows.length - 1]
  const lastGex = parseFloat(last?.gex) || 0
  const isPinning = lastGex >= 0

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Intraday GEX — 1-Min
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 4 }}>Net dealer gamma / 1% move per minute. Positive = pinning. Negative = amplifying.</div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
        {hasZero && <line x1="0" y1={zy} x2={W} y2={zy} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />}
        <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
        <span>{rows[0]?.time ?? ''}</span>
        <span style={{ color: isPinning ? 'var(--green)' : 'var(--red)' }}>{last?.time ?? ''} {isPinning ? 'Pinning' : 'Amplifying'}</span>
      </div>
    </div>
  )
}

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
  const [bucket, setBucket]       = useState<Bucket>('all')
  const [range, setRange]         = useState(150)
  const [dealerText, setDealerText] = useState('')
  const [loadingDealer, setLoadingDealer] = useState(false)
  const ladders = useLadders(true)

  const nd = data?.ndx ?? {}
  const regime   = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
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
  const netDeltaDisplay = !isNdx ? data?.net_dealer_delta : null

  // Dealer scorecard
  const score      = data?.dealer_score ?? data?.scorecard_score
  const scoreLabel = data?.dealer_label ?? data?.scorecard_label
  const scGamma    = data?.scf_gamma
  const scDelta    = data?.scf_delta
  const scFlip     = data?.scf_flip
  const scFlow     = data?.scf_flow
  const scCharm    = data?.scf_charm
  const scVanna    = data?.scf_vanna

  const priceNum = isNdx
    ? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0)
    : (data?.daily_open ?? 0)
  const flipNum  = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0

  const allRows = isNdx
    ? (ladders?.ndx?.gex_ladder_buckets?.[bucket] ?? ladders?.ndx?.gex_ladder_rows ?? [])
    : (ladders?.gex_ladder_buckets?.[bucket] ?? ladders?.gex_ladder_rows ?? [])
  const rangeFiltered = allRows.filter((r: any) => {
    const s = parseFloat(String(r.strike).replace(/,/g, ''))
    return Math.abs(s - priceNum) <= range
  })
  const bucketData = rangeFiltered.length > 0 ? rangeFiltered : allRows

  // Top gamma strikes: sort by absolute net_gex
  const topGamma = [...allRows]
    .sort((a: any, b: any) => Math.abs(b.net_gex ?? 0) - Math.abs(a.net_gex ?? 0))
    .slice(0, 8)

  async function loadDealer() {
    setLoadingDealer(true)
    try { setDealerText(await postAiRead('/api/gex-read')) }
    catch (e: any) { setDealerText('Error: ' + e.message) }
    finally { setLoadingDealer(false) }
  }

  const scoreBarW = score != null ? `${Math.min(100, Math.max(0, (score + 30) / 60 * 100))}%` : '50%'
  const scoreBarColor = score != null && score > 0 ? 'var(--green)' : score != null && score < 0 ? 'var(--red)' : 'var(--yellow)'

  return (
    <>
      {/* ── Range slider ── */}
      <div className="ladder-slider-wrap">
        <span className="ladder-slider-label">View Range</span>
        <input type="range" className="ladder-slider" min={25} max={300} step={25} value={range} onChange={e => setRange(Number(e.target.value))} />
        <span className="ladder-slider-val">±{range} pts</span>
      </div>

      {/* ── Key levels bar ── */}
      <div className="key-levels-bar">
        {regime && (
          <div className="kl-item">
            <div className="kl-label">Regime</div>
            <div className="kl-val" style={{ fontSize: 9, color: regime.toUpperCase().includes('NEG') ? 'var(--red)' : regime.toUpperCase().includes('POS') ? 'var(--green)' : 'var(--muted2)' }}>{regime}</div>
          </div>
        )}
        {flip && (
          <div className="kl-item">
            <div className="kl-label">Gamma Flip</div>
            <div className="kl-val flip">{fmtNum(flip)}</div>
          </div>
        )}
        {maxPain != null && (
          <div className="kl-item">
            <div className="kl-label">Max Pain</div>
            <div className="kl-val">{fmtNum(maxPain)}</div>
          </div>
        )}
        {cWall && (
          <div className="kl-item">
            <div className="kl-label">Call Wall</div>
            <div className="kl-val call">{fmtNum(cWall)}</div>
          </div>
        )}
        {pWall && (
          <div className="kl-item">
            <div className="kl-label">Put Wall</div>
            <div className="kl-val put">{fmtNum(pWall)}</div>
          </div>
        )}
        {netDelta && (
          <div className="kl-item">
            <div className="kl-label">Net Delta</div>
            <div className="kl-val" style={{ fontSize: 9, color: netDelta === 'LONG' ? 'var(--green)' : netDelta === 'SHORT' ? 'var(--red)' : 'var(--muted2)' }}>{netDelta}</div>
          </div>
        )}
        {flowBias && (
          <div className="kl-item">
            <div className="kl-label">Flow</div>
            <div className="kl-val" style={{ fontSize: 9, color: String(flowBias).includes('CALL') ? 'var(--green)' : String(flowBias).includes('PUT') ? 'var(--red)' : 'var(--muted2)' }}>{flowBias}</div>
          </div>
        )}
        {pcRatio && (
          <div className="kl-item">
            <div className="kl-label">P/C Ratio</div>
            <div className="kl-val" style={{ fontSize: 11 }}>{parseFloat(pcRatio).toFixed(2)}</div>
          </div>
        )}
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
        <div className="panel-title">
          Flow Pressure
          <span style={{ fontSize: 9, color: 'var(--muted2)', fontWeight: 400 }}>Call GEX above vs Put GEX below</span>
        </div>
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
        {netDeltaDisplay != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>Net Dealer Delta</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmtNum(netDeltaDisplay)}</span>
          </div>
        )}
        {gammaPerPct != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>Dealer Gamma / 1% Move</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>{fmtNum(gammaPerPct)}</span>
          </div>
        )}
      </div>

      {/* ── Delta Hedging ── */}
      <div className="panel">
        <div className="panel-title">
          Delta Hedging Flow
          {dhPressure && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: String(dhPressure).toUpperCase().includes('BULL') ? 'var(--green)' : String(dhPressure).toUpperCase().includes('BEAR') ? 'var(--red)' : 'var(--muted2)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border2)' }}>
              {dhPressure}
            </span>
          )}
        </div>
        <div className="stat-grid">
          {netDelta    && <div className="stat"><div className="stat-label">Net Delta</div><div className="stat-val" style={{ fontSize: 10, color: netDelta === 'LONG' ? 'var(--green)' : 'var(--red)' }}>{netDelta}</div></div>}
          {charm       && <div className="stat"><div className="stat-label">Charm Flow</div><div className="stat-val" style={{ fontSize: 10 }}>{charm}</div></div>}
          {vanna       && <div className="stat"><div className="stat-label">Vanna</div><div className="stat-val" style={{ fontSize: 10 }}>{vanna}</div></div>}
          {maxPain != null && <div className="stat"><div className="stat-label">Max Pain</div><div className="stat-val" style={{ fontSize: 10 }}>{fmtNum(maxPain)}</div></div>}
        </div>
      </div>

      {/* ── Top Gamma Strikes ── */}
      {topGamma.length > 0 && (
        <div className="panel">
          <div className="panel-title">Top Gamma Strikes</div>
          {topGamma.map((r: any, i: number) => {
            const netG = r.net_gex ?? ((r.call_gex ?? 0) - (r.put_gex ?? 0))
            const isPos = netG >= 0
            return (
              <div key={i} className="td-row">
                <div className="td-label" style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontSize: 10 }}>{r.strike}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.abs(netG) / (topGamma[0]?.net_gex ? Math.abs(topGamma[0].net_gex) : 1) * 100)}%`, background: isPos ? 'var(--green)' : 'var(--red)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)', minWidth: 50, textAlign: 'right' }}>{fmtNum(netG)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Intraday GEX 1-Min ── */}
      {(data?.spot_exposures?.length > 0) && (
        <GexSparkline rows={data.spot_exposures} />
      )}

      {/* ── Dealer Positioning Score ── */}
      {(score != null || scGamma || scDelta || dhPressure) && (
        <div className="panel">
          <div className="panel-title">Dealer Positioning Score</div>
          <div className="scorecard">
            <div className="scorecard-header">
              <span className="scorecard-title">Positioning</span>
              <div style={{ textAlign: 'right' }}>
                {score != null && (
                  <div className={`scorecard-score ${score > 0 ? 'bull' : score < 0 ? 'bear' : 'neut'}`}>{score}</div>
                )}
                {scoreLabel && (
                  <div className={`scorecard-label ${score != null && score > 0 ? 'bull' : score != null && score < 0 ? 'bear' : 'neut'}`}>{scoreLabel}</div>
                )}
              </div>
            </div>
            {score != null && (
              <div className="scorecard-bar">
                <div className="scorecard-bar-fill" style={{ width: scoreBarW, background: scoreBarColor }} />
              </div>
            )}
            <div className="scorecard-factors">
              {[
                { label: 'Gamma',        val: scGamma ?? data?.gamma_state },
                { label: 'Delta',        val: scDelta ?? data?.net_delta_dir },
                { label: 'Flip Zone',    val: scFlip },
                { label: 'Flow',         val: scFlow ?? flowBias },
                { label: 'Charm',        val: scCharm ?? charm },
                { label: 'Vanna',        val: scVanna ?? vanna },
              ].map((f, i) => (
                <div key={i} className="sc-factor">
                  <div className="sc-factor-label">{f.label}</div>
                  <div className={`sc-factor-val ${f.val && String(f.val).toUpperCase().includes('BULL') || f.val && String(f.val).toUpperCase().includes('BUY') ? 'bull' : f.val && String(f.val).toUpperCase().includes('BEAR') || f.val && String(f.val).toUpperCase().includes('SELL') ? 'bear' : 'neut'}`}>
                    {f.val ?? '--'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
