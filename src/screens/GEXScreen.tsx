import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'
import { useLivePrice } from '../lib/LivePriceContext'
import { useSSE } from '../lib/SSEContext'
import LadderPriceLine from '../components/LadderPriceLine'
import { computeHotScores } from '../lib/hotScores'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

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

function GEXHBars({ rows, priceStrike, flipStrike, hotScores }: { rows: any[]; priceStrike: number; flipStrike: number; hotScores: Map<number, number> }) {
  if (!rows?.length) return (
    <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No ladder data</div>
  )
  const maxCall = Math.max(...rows.map((r: any) => Math.abs(r.call_gex ?? (r.net_gex > 0 ? r.net_gex : 0))), 1)
  const maxPut  = Math.max(...rows.map((r: any) => Math.abs(r.put_gex  ?? (r.net_gex < 0 ? r.net_gex : 0))), 1)

  return (
    <div>
      {rows.map((row: any, i: number) => {
        const strike   = parseFloat(String(row.strike).replace(/,/g, ''))
        const skey     = Math.round(strike)
        const isPrice  = priceStrike && Math.abs(strike - priceStrike) < 3
        const isFlip   = flipStrike  && Math.abs(strike - flipStrike)  < 3
        const hotScore = hotScores.get(skey)
        const isHot    = hotScore != null && hotScore >= 70
        const isWarm   = hotScore != null && hotScore >= 50 && hotScore < 70
        const cGex = Math.abs(row.call_gex ?? (row.net_gex && row.net_gex > 0 ? row.net_gex : 0))
        const pGex = Math.abs(row.put_gex  ?? (row.net_gex && row.net_gex < 0 ? row.net_gex : 0))
        const pFill = Math.min(1, pGex / maxPut)
        const cFill = Math.min(1, cGex / maxCall)
        const sc100 = hotScore != null ? hotScore / 100 : 0
        const pInt  = Math.max(pFill * 0.80, sc100)
        const cInt  = Math.max(cFill * 0.80, sc100)
        const pH    = Math.max(4, pInt * 10)
        const cH    = Math.max(4, cInt * 10)
        const pA    = Math.max(0.45, pInt * 0.82)
        const cA    = Math.max(0.45, cInt * 0.82)
        const pGlow = isHot && pFill >= cFill ? `0 0 ${Math.round(pInt * 14)}px rgba(255,51,68,0.75)` : undefined
        const cGlow = isHot && cFill > pFill  ? `0 0 ${Math.round(cInt * 14)}px rgba(0,255,136,0.75)` : undefined
        const bg = isPrice ? 'rgba(255,204,0,0.07)' : isFlip ? 'rgba(240,0,255,0.05)'
          : isWarm ? 'rgba(234,179,8,0.05)' : 'transparent'
        const strikeColor = isPrice ? 'var(--yellow)' : isFlip ? '#f0f' : isHot ? 'var(--red)' : isWarm ? '#eab308' : 'var(--muted2)'
        const tagLabel = isFlip ? 'FLIP' : (isHot || isWarm) ? String(hotScore) : ''
        const tagColor = isFlip ? '#f0f' : isHot ? 'var(--red)' : isWarm ? 'rgba(234,179,8,0.6)' : 'var(--muted2)'

        return (
          <div key={i} className="hbar-row" style={{ background: isHot && !isPrice && !isFlip ? undefined : bg, animation: isHot && !isPrice && !isFlip ? 'pulseHot 1.4s ease-in-out infinite' : undefined }}>
            <div className="hbar-strike" style={{ color: strikeColor }}>
              {isHot  && <span style={{ fontSize: 7, marginRight: 2, color: 'var(--red)' }}>●</span>}
              {isWarm && <span style={{ fontSize: 7, marginRight: 2, color: 'rgba(234,179,8,0.5)' }}>●</span>}
              {skey}
            </div>
            <div style={{ gridColumn: '2 / 5', display: 'flex', alignSelf: 'center', height: 13, overflow: 'visible' }}>
              {pFill > 0 && <div style={{ width: `${pFill * 50}%`, height: pH, background: `rgba(255,51,68,${pA.toFixed(2)})`, borderRadius: cFill > 0 ? '2px 0 0 2px' : '2px', flexShrink: 0, boxShadow: pGlow }} />}
              {cFill > 0 && <div style={{ width: `${cFill * 50}%`, height: cH, background: `rgba(0,255,136,${cA.toFixed(2)})`, borderRadius: pFill > 0 ? '0 2px 2px 0' : '2px', flexShrink: 0, boxShadow: cGlow }} />}
            </div>
            <div className="hbar-strike" style={{ textAlign: 'left', paddingLeft: 4, color: tagColor, fontSize: 7, fontWeight: 700 }}>
              {tagLabel}
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
  const live = useLivePrice()
  const { on } = useSSE()
  const isNdx = side === 'ndx'
  const [bucket, setBucket]       = useState<Bucket>('all')
  const [range, setRange]         = useState(150)
  const [dealerText, setDealerText] = useState('')
  const [loadingDealer, setLoadingDealer] = useState(false)
  const [gexStrikes, setGexStrikes] = useState<any[]>([])
  const ladders = useLadders(true)

  const loadGexStrikes = useCallback(() => {
    apiFetch(isNdx ? '/api/ndx-gex-strikes' : '/api/gex-strikes')
      .then(d => setGexStrikes(d.strikes ?? []))
      .catch(() => {})
  }, [isNdx])

  useEffect(() => {
    setGexStrikes([])
    loadGexStrikes()
    const off = on('update', () => loadGexStrikes())
    return off
  }, [isNdx, loadGexStrikes, on])

  const nd = data?.ndx ?? {}

  const oiRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.all ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.all ?? ladders?.ladder_rows ?? [])

  const priceNum = isNdx
    ? (live.ndx ?? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0))
    : (live.spx ?? (typeof data?.spx === 'string' ? parseFloat(String(data?.spx).replace(/,/g, '')) : data?.spx ?? 0))
  const regime   = isNdx ? (nd.uw_gamma_regime ?? data?.ndx_uw_gamma_regime) : (data?.uw_gamma_regime ?? data?.gamma_state)
  const flip     = isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const maxPain  = !isNdx ? data?.max_pain_strike : null
  const maxPainDte = !isNdx ? (data?.max_pain_dte ?? data?.max_pain_days ?? null) : null
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

  // Compute dealer score client-side (mirrors _updateScorecard in old dashboard)
  type ScFactor = { label: string; val: string; cls: string }
  const dealerScore = (() => {
    const src = isNdx ? nd : (data ?? {})
    if (!data) return null
    let sc = 50
    const factors: ScFactor[] = []
    const fmtD = (v: number) => { const a = Math.abs(v); if (a >= 1e9) return (a/1e9).toFixed(2)+'B'; if (a >= 1e6) return (a/1e6).toFixed(1)+'M'; if (a >= 1e3) return (a/1e3).toFixed(0)+'K'; return a.toFixed(1) }
    const gamma = isNdx ? String(src.net_gex_state ?? '') : String(src.uw_gamma_regime ?? '')
    if (gamma.includes('Positive')) { sc -= 15; factors.push({ label: 'Gamma', val: 'POSITIVE GAMMA', cls: 'bull' }) }
    else if (gamma.includes('Negative')) { sc += 15; factors.push({ label: 'Gamma', val: 'NEGATIVE GAMMA', cls: 'bear' }) }
    else { factors.push({ label: 'Gamma', val: 'NEUTRAL GAMMA', cls: 'warn' }) }
    const dh = src.delta_hedging_pressure ?? 'NEUTRAL'
    const ndVal = parseFloat(src.net_delta_val ?? 0) || 0
    if (dh === 'BULLISH') { sc += 15; factors.push({ label: 'Delta', val: `BUYING +$${fmtD(ndVal)}`, cls: 'bull' }) }
    else if (dh === 'BEARISH') { sc -= 15; factors.push({ label: 'Delta', val: `SELLING -$${fmtD(ndVal)}`, cls: 'bear' }) }
    else { factors.push({ label: 'Delta', val: 'NEUTRAL', cls: 'warn' }) }
    const prN = isNdx
      ? (typeof src.price === 'string' ? parseFloat(String(src.price).replace(/,/g, '')) : src.price ?? 0)
      : (typeof data?.spx === 'string' ? parseFloat(String(data.spx).replace(/,/g, '')) : data?.spx ?? 0)
    const flipR = parseFloat(src.gex_flip_zone_raw ?? 0) || 0
    if (flipR > 0 && prN > 0) {
      const dist = prN - flipR
      if (dist > 5) { sc += 12; factors.push({ label: 'Flip', val: `ABOVE +${dist.toFixed(0)}pts`, cls: 'bull' }) }
      else if (dist < -5) { sc -= 12; factors.push({ label: 'Flip', val: `BELOW ${dist.toFixed(0)}pts`, cls: 'bear' }) }
      else { factors.push({ label: 'Flip', val: 'AT FLIP', cls: 'warn' }) }
    } else { factors.push({ label: 'Flip', val: '--', cls: 'neut' }) }
    const flow = src.flow_bias ?? 'BALANCED'
    if (flow === 'CALL HEAVY') { sc += 10; factors.push({ label: 'Flow', val: 'CALL HEAVY', cls: 'bull' }) }
    else if (flow === 'PUT HEAVY') { sc -= 10; factors.push({ label: 'Flow', val: 'PUT HEAVY', cls: 'bear' }) }
    else { factors.push({ label: 'Flow', val: 'BALANCED', cls: 'warn' }) }
    const charm = src.charm_flow ?? 'NEUTRAL'
    if (charm === 'BUYING') { sc += 5; factors.push({ label: 'Charm', val: 'BUYING', cls: 'bull' }) }
    else if (charm === 'SELLING') { sc -= 5; factors.push({ label: 'Charm', val: 'SELLING', cls: 'bear' }) }
    else { factors.push({ label: 'Charm', val: 'NEUTRAL', cls: 'warn' }) }
    const vanna = src.vanna_flow ?? 'NEUTRAL'
    if (vanna === 'AMPLIFIED') { sc -= 3; factors.push({ label: 'Vanna', val: 'AMPLIFIED⚠', cls: 'bear' }) }
    else if (vanna === 'ELEVATED') { factors.push({ label: 'Vanna', val: 'ELEVATED', cls: 'warn' }) }
    else { factors.push({ label: 'Vanna', val: 'MUTED', cls: 'bull' }) }
    sc = Math.max(0, Math.min(100, sc))
    let label = 'DEALER NEUTRAL'
    if (sc >= 65) label = 'BULLISH TAILWIND'
    else if (sc <= 35) label = 'BEARISH HEADWIND'
    return { score: sc, label, factors }
  })()
  const score      = dealerScore?.score ?? null
  const scoreLabel = dealerScore?.label ?? null
  const scFactors  = dealerScore?.factors ?? []

  const flipNum  = parseFloat(String(flip ?? '').replace(/,/g, '')) || 0

  const sortDesc = (rows: any[]) => [...rows].sort((a: any, b: any) =>
    (parseFloat(String(b.strike).replace(/,/g,''))||0) - (parseFloat(String(a.strike).replace(/,/g,''))||0)
  )
  const rangeFiltered = gexStrikes.filter((r: any) => {
    const s = parseFloat(String(r.strike).replace(/,/g, ''))
    return Math.abs(s - priceNum) <= range
  })
  const bucketData = sortDesc(rangeFiltered.length > 0 ? rangeFiltered : gexStrikes)

  const hotScores = new Map<number, number>(
    [...computeHotScores(oiRows, bucketData, priceNum).entries()].filter(([, s]) => s >= 50)
  )

  // Top gamma strikes: sort by absolute net_gex
  const topGamma = [...gexStrikes]
    .sort((a: any, b: any) => Math.abs(b.net_gex ?? 0) - Math.abs(a.net_gex ?? 0))
    .slice(0, 8)

  async function loadDealer() {
    setLoadingDealer(true)
    try { setDealerText(await postAiRead('/api/gex-read')) }
    catch (e: any) { setDealerText('Error: ' + e.message) }
    finally { setLoadingDealer(false) }
  }

  const scoreBarW = score != null ? `${score}%` : '50%'
  const scoreBarColor = score != null && score >= 65 ? 'var(--green)' : score != null && score <= 35 ? 'var(--red)' : 'var(--yellow)'

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
            <div className="kl-val" style={{ color: 'var(--yellow)' }}>{fmtNum(maxPain)}{maxPainDte != null ? ` (${String(maxPainDte).toUpperCase()})` : ''}</div>
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
            <div className="kl-val" style={{ fontSize: 11, color: parseFloat(pcRatio) > 1.1 ? 'var(--red)' : parseFloat(pcRatio) < 0.8 ? 'var(--green)' : 'var(--yellow)' }}>{parseFloat(pcRatio).toFixed(2)}</div>
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
          <span className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            Gamma Exposure by Strike
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>LIVE</span>
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUCKETS.map(b => (
              <span key={b} className={`expiry-btn${bucket === b ? ' active' : ''}`} onClick={() => setBucket(b)}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--red)' }}>PUT GEX ▶</span>
          <span style={{ color: 'var(--muted2)' }}>then</span>
          <span style={{ color: 'var(--green)' }}>CALL GEX ▶</span>
        </div>
        <div style={{ position: 'relative' }}>
          <GEXHBars rows={bucketData} priceStrike={priceNum} flipStrike={flipNum} hotScores={hotScores} />
          <LadderPriceLine rows={bucketData} price={priceNum} />
        </div>
        {gexStrikes.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
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
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: Number(netDeltaDisplay) > 0 ? 'var(--green)' : Number(netDeltaDisplay) < 0 ? 'var(--red)' : 'var(--muted2)' }}>{fmtNum(netDeltaDisplay)}</span>
          </div>
        )}
        {gammaPerPct != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}>Dealer Gamma / 1% Move</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: Number(gammaPerPct) > 0 ? 'var(--green)' : Number(gammaPerPct) < 0 ? 'var(--red)' : 'var(--muted2)' }}>{fmtNum(gammaPerPct)}</span>
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
          {charm       && <div className="stat"><div className="stat-label">Charm Flow</div><div className="stat-val" style={{ fontSize: 10, color: String(charm).toUpperCase() === 'BUYING' ? 'var(--green)' : String(charm).toUpperCase() === 'SELLING' ? 'var(--red)' : 'var(--muted2)' }}>{charm}</div></div>}
          {vanna       && <div className="stat"><div className="stat-label">Vanna</div><div className="stat-val" style={{ fontSize: 10, color: String(vanna).toUpperCase() === 'AMPLIFIED' ? 'var(--red)' : String(vanna).toUpperCase() === 'ELEVATED' ? 'var(--yellow)' : 'var(--muted2)' }}>{vanna}</div></div>}
          {maxPain != null && <div className="stat"><div className="stat-label">Max Pain</div><div className="stat-val" style={{ fontSize: 10, color: 'var(--yellow)' }}>{fmtNum(maxPain)}</div></div>}
        </div>
      </div>

      {/* ── 0DTE Pin Risk Meter ── */}
      {(() => {
        // Prefer 0DTE bucket (live market hours); fall back to all gexStrikes (persisted, always available)
        const dte0Bucket: any[] = isNdx
          ? (ladders?.ndx?.gex_ladder_buckets?.['0dte'] ?? [])
          : (ladders?.gex_ladder_buckets?.['0dte'] ?? [])
        const dte0Rows: any[] = dte0Bucket.length > 0 ? dte0Bucket : gexStrikes
        if (!dte0Rows.length) return null

        // Score each strike: GEX magnitude × proximity to current price
        const DECAY = 30 // pts half-life for proximity weighting
        const scored = dte0Rows.map((r: any) => {
          const s   = parseFloat(String(r.strike).replace(/,/g, ''))
          const gex = Math.abs((r.call_gex ?? 0) - (r.put_gex ?? 0))
          const prox = Math.exp(-Math.abs(s - priceNum) / DECAY)
          return { strike: s, gex, score: gex * prox, netGex: (r.call_gex ?? 0) - (r.put_gex ?? 0) }
        })
        const maxScore = Math.max(...scored.map(r => r.score), 1)
        const pinCandidates = [...scored].sort((a, b) => b.score - a.score).slice(0, 5)
        const topPin = pinCandidates[0]
        const pinPct = Math.round((topPin?.score / maxScore) * 100)
        const dist   = topPin ? Math.abs(topPin.strike - priceNum) : 0
        const pinLabel = dist < 5 ? 'HIGH' : dist < 15 ? 'MODERATE' : 'LOW'
        const pinColor = dist < 5 ? 'var(--red)' : dist < 15 ? 'var(--yellow)' : 'var(--green)'

        return (
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              0DTE Pin Risk
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: pinColor, background: `rgba(${dist < 5 ? '255,51,68' : dist < 15 ? '234,179,8' : '0,255,136'},0.08)`, border: `1px solid rgba(${dist < 5 ? '255,51,68' : dist < 15 ? '234,179,8' : '0,255,136'},0.25)`, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>{pinLabel}</span>
            </div>
            {topPin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 9, fontFamily: 'var(--mono)' }}>
                    <span style={{ color: pinColor, fontWeight: 700 }}>PIN: {Math.round(topPin.strike)}</span>
                    <span style={{ color: 'var(--muted2)' }}>{dist < 1 ? 'AT PRICE' : `${dist.toFixed(0)}pts away`}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pinPct}%`, background: pinColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: pinColor, minWidth: 36, textAlign: 'right' }}>{pinPct}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {pinCandidates.map((r, i) => {
                const pct   = Math.round((r.score / maxScore) * 100)
                const d     = Math.abs(r.strike - priceNum)
                const c     = d < 5 ? 'var(--red)' : d < 15 ? 'var(--yellow)' : 'var(--muted2)'
                const isTop = i === 0
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '6px 4px', background: isTop ? `rgba(${d < 5 ? '255,51,68' : d < 15 ? '234,179,8' : '0,255,136'},0.06)` : 'var(--surface)', borderRadius: 4, border: `1px solid ${isTop ? c : 'var(--border)'}` }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: c }}>{Math.round(r.strike)}</div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, margin: '3px 0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 8 }}>Score = 0DTE gamma magnitude × price proximity. High = likely expiry pin target.</div>
          </div>
        )
      })()}

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
      {score != null && (
        <div className="panel">
          <div className="panel-title">Dealer Positioning Score</div>
          <div className="scorecard">
            <div className="scorecard-header">
              <span className="scorecard-title">Positioning</span>
              <div style={{ textAlign: 'right' }}>
                <div className={`scorecard-score ${score >= 65 ? 'bull' : score <= 35 ? 'bear' : 'neut'}`}>{score}</div>
                {scoreLabel && <div className={`scorecard-label ${score >= 65 ? 'bull' : score <= 35 ? 'bear' : 'neut'}`}>{scoreLabel}</div>}
              </div>
            </div>
            <div className="scorecard-bar">
              <div className="scorecard-bar-fill" style={{ width: scoreBarW, background: scoreBarColor }} />
            </div>
            <div className="scorecard-factors">
              {scFactors.map((f, i) => (
                <div key={i} className="sc-factor">
                  <div className="sc-factor-label">{f.label}</div>
                  <div className={`sc-factor-val ${f.cls}`}>{f.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
