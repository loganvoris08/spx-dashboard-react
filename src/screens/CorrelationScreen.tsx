import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSSE } from '../lib/SSEContext'
import CanvasChart from '../components/CanvasChart'
import type { CCSeries } from '../components/CanvasChart'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmt(v: any, d = 2) {
  if (v == null || v === '' || isNaN(parseFloat(v))) return '--'
  return parseFloat(v).toFixed(d)
}

function MetricTile({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color?: string; tip?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 8, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }} title={tip}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function CorrelationScreen() {
  const { data } = useDashboard()
  const { on } = useSSE()
  const [hist, setHist] = useState<any[]>([])
  const [current, setCurrent] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/correlation-history')
      setHist(d.history ?? [])
      setCurrent(d.current ?? null)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const off = on('update', load)
    const t = setInterval(load, 30_000)
    return () => { off(); clearInterval(t) }
  }, [load, on])

  // Build chart series from history
  const makeSeries = (key: string, color: string, rgb: string): CCSeries => ({
    data: hist.map(r => ({ time: r.ts, value: r[key] ?? 0 })),
    color, rgb, fill: true,
  })

  const tickSeries   = makeSeries('tick',     '#60a5fa', '96,165,250')
  const addSeries    = makeSeries('add',      '#34d399', '52,211,153')
  const pcrSeries    = makeSeries('pcr',      '#f87171', '248,113,113')
  const termSeries   = makeSeries('vix_term', '#a78bfa', '167,139,250')
  const vvixSeries   = makeSeries('vix_vvix', '#fbbf24', '251,191,36')

  const tick = current?.tick ?? data?.nyse_tick ?? 0
  const add  = current?.add  ?? data?.nyse_add  ?? 0
  const pcr  = current?.pcr  ?? data?.put_call_ratio ?? 0
  const vixTerm = current?.vix_term ?? 0
  const vixVvix = current?.vix_vvix ?? 0
  const vix9d = current?.vix9d ?? data?.vix9d ?? 0
  const vix3m = current?.vix3m ?? data?.vix3m ?? 0
  const vvix  = current?.vvix  ?? data?.vvix  ?? 0
  const vix   = current?.vix   ?? data?.vix   ?? 0

  const tickColor  = Number(tick) > 600 ? 'var(--green)' : Number(tick) < -600 ? 'var(--red)' : Number(tick) > 200 ? '#86efac' : Number(tick) < -200 ? '#fca5a5' : 'var(--muted2)'
  const addColor   = Number(add)  > 1000 ? 'var(--green)' : Number(add)  < -1000 ? 'var(--red)' : 'var(--muted2)'
  const pcrColor   = Number(pcr)  > 1.2 ? 'var(--red)' : Number(pcr) < 0.7 ? 'var(--green)' : 'var(--muted2)'
  const termColor  = Number(vixTerm) > 2 ? 'var(--red)' : Number(vixTerm) < -2 ? 'var(--green)' : 'var(--muted2)'

  const tickLabel  = Number(tick) > 800 ? 'Extreme buying' : Number(tick) > 400 ? 'Broad buying' : Number(tick) < -800 ? 'Extreme selling' : Number(tick) < -400 ? 'Broad selling' : 'Neutral breadth'
  const addLabel   = Number(add)  > 1500 ? 'Strong advance' : Number(add) > 500 ? 'Advancing' : Number(add) < -1500 ? 'Strong decline' : Number(add) < -500 ? 'Declining' : 'Mixed breadth'
  const pcrLabel   = Number(pcr)  > 1.5 ? 'Extreme fear / put heavy' : Number(pcr) > 1.0 ? 'Put dominant' : Number(pcr) < 0.5 ? 'Call dominant' : 'Balanced'
  const termLabel  = Number(vixTerm) > 2 ? 'Near-term spike (backwardation)' : Number(vixTerm) < -2 ? 'Contango (calm)' : 'Flat term structure'
  const vvixLabel  = Number(vvix) >= 120 ? 'VIX moves unpredictable' : Number(vvix) >= 100 ? 'Elevated vol of vol' : 'Normal'

  return (
    <>
      {/* ── Current snapshot tiles ── */}
      <div className="panel">
        <div className="panel-title">Market Breadth &amp; Correlation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 2 }}>
          <MetricTile label="NYSE TICK" value={Number(tick) > 0 ? '+' + fmt(tick, 0) : fmt(tick, 0)} sub={tickLabel} color={tickColor} tip="Count of NYSE stocks on uptick minus downtick. +400 = broad buying, -400 = broad selling, ±800 = exhaustion signal." />
          <MetricTile label="NYSE A/D" value={Number(add) > 0 ? '+' + fmt(add, 0) : fmt(add, 0)} sub={addLabel} color={addColor} tip="Advancing minus declining NYSE stocks today. Divergence from SPX price = warning sign." />
          <MetricTile label="SPX P/C Ratio" value={fmt(pcr)} sub={pcrLabel} color={pcrColor} tip="SPX put OI divided by call OI. >1 = more puts than calls (hedging active). Extreme readings signal turning points." />
          <MetricTile label="VIX Term Spread" value={`${Number(vixTerm) >= 0 ? '+' : ''}${fmt(vixTerm)}`} sub={termLabel} color={termColor} tip="VIX9D minus VIX3M. Positive = backwardation (near-term fear spike). Negative = contango (calm, normal)." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          <MetricTile label="VIX 9D" value={fmt(vix9d)} color={Number(vix9d) > 20 ? 'var(--red)' : 'var(--green)'} />
          <MetricTile label="VIX 3M" value={fmt(vix3m)} color={Number(vix3m) > 22 ? 'var(--red)' : 'var(--muted2)'} />
          <MetricTile label="VVIX" value={fmt(vvix, 1)} sub={vvixLabel} color={Number(vvix) >= 120 ? 'var(--red)' : Number(vvix) >= 100 ? 'var(--yellow)' : 'var(--muted2)'} tip="Vol of VIX. High VVIX = VIX itself is unstable — moves may reverse quickly. VIX/VVIX ratio shows if VIX move has legs." />
        </div>
      </div>

      {/* ── VIX / VVIX ratio ── */}
      {vix > 0 && vvix > 0 && (
        <div className="panel">
          <div className="panel-title">VIX / VVIX Ratio</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: Number(vixVvix) < 0.12 ? 'var(--green)' : Number(vixVvix) > 0.22 ? 'var(--red)' : 'var(--yellow)' }}>{fmt(vixVvix, 3)}</span>
            <span style={{ fontSize: 10, color: 'var(--muted2)' }}>
              {Number(vixVvix) < 0.12 ? 'Low — VIX calm relative to VVIX (move may accelerate)' : Number(vixVvix) > 0.22 ? 'High — VIX elevated vs VVIX (vol move may be sustainable)' : 'Normal range'}
            </span>
          </div>
          {vvixSeries.data.length > 1 && <CanvasChart series={[vvixSeries]} height={100} yFmt={v => v.toFixed(3)} />}
        </div>
      )}

      {/* ── NYSE TICK intraday ── */}
      {tickSeries.data.length > 1 && (
        <div className="panel">
          <div className="panel-title">NYSE TICK — Intraday</div>
          <CanvasChart series={[tickSeries]} height={110} split yFmt={v => (v >= 0 ? '+' : '') + v.toFixed(0)} />
        </div>
      )}

      {/* ── NYSE A/D intraday ── */}
      {addSeries.data.length > 1 && (
        <div className="panel">
          <div className="panel-title">NYSE Advance / Decline — Intraday</div>
          <CanvasChart series={[addSeries]} height={110} split yFmt={v => (v >= 0 ? '+' : '') + v.toFixed(0)} />
        </div>
      )}

      {/* ── Put/Call ratio intraday ── */}
      {pcrSeries.data.length > 1 && (
        <div className="panel">
          <div className="panel-title">SPX Put / Call Ratio — Intraday</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>
            <span>{'>'} 1.2 = <span style={{ color: 'var(--red)' }}>PUT HEAVY</span></span>
            <span>0.7–1.2 = BALANCED</span>
            <span>{'<'} 0.7 = <span style={{ color: 'var(--green)' }}>CALL HEAVY</span></span>
          </div>
          <CanvasChart series={[pcrSeries]} height={100} yFmt={v => v.toFixed(2)} />
        </div>
      )}

      {/* ── VIX term spread intraday ── */}
      {termSeries.data.length > 1 && (
        <div className="panel">
          <div className="panel-title">VIX Term Spread (9D − 3M) — Intraday</div>
          <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6 }}>Positive = backwardation (near-term fear). Negative = contango (normal).</div>
          <CanvasChart series={[termSeries]} height={100} split yFmt={v => (v >= 0 ? '+' : '') + v.toFixed(2)} />
        </div>
      )}

      {hist.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 11, padding: 24 }}>
          Intraday history builds during market hours. Current snapshot shown above.
        </div>
      )}
    </>
  )
}
