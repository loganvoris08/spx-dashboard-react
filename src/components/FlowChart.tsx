import { useEffect, useRef, useCallback } from 'react'
import { createChart, LineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, LineSeriesOptions } from 'lightweight-charts'
import { useSide } from '../lib/SideContext'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }

function fmtFlow(v: number) {
  const a = Math.abs(v)
  return (v >= 0 ? '' : '-') + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(0) + 'K' : a.toFixed(0))
}

const CHART_OPTS = {
  layout:     { background: { color: 'transparent' }, textColor: '#777' },
  grid:       { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.08, bottom: 0.08 } },
  timeScale:  { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
  crosshair:  { vertLine: { color: 'rgba(255,255,255,0.3)', style: 0 as const }, horzLine: { color: 'rgba(255,255,255,0.2)' } },
  localization: { priceFormatter: fmtFlow },
  handleScroll: false,
  handleScale:  false,
}

export default function FlowChart() {
  const { side } = useSide()
  const isNdx = side === 'ndx'

  const chartRef = useRef<HTMLDivElement>(null)
  const netRef   = useRef<HTMLDivElement>(null)
  const chartInst    = useRef<IChartApi | null>(null)
  const callSeries   = useRef<ISeriesApi<'Line'> | null>(null)
  const putSeries    = useRef<ISeriesApi<'Line'> | null>(null)
  const netChartInst = useRef<IChartApi | null>(null)
  const netSeries    = useRef<ISeriesApi<'Line'> | null>(null)

  const callEl = useRef<HTMLDivElement>(null)
  const putEl  = useRef<HTMLDivElement>(null)
  const netEl2 = useRef<HTMLDivElement>(null)
  const biasEl = useRef<HTMLDivElement>(null)

  const initCharts = useCallback(() => {
    if (!chartRef.current || chartInst.current) return

    chartInst.current = createChart(chartRef.current, { ...CHART_OPTS, height: 200, width: chartRef.current.clientWidth })
    callSeries.current = chartInst.current.addSeries(LineSeries, { color: 'rgba(0,255,136,0.9)', lineWidth: 2 } as Partial<LineSeriesOptions>)
    putSeries.current  = chartInst.current.addSeries(LineSeries, { color: 'rgba(255,51,68,0.9)',  lineWidth: 2 } as Partial<LineSeriesOptions>)

    if (netRef.current && !netChartInst.current) {
      netChartInst.current = createChart(netRef.current, { ...CHART_OPTS, height: 70, width: netRef.current.clientWidth })
      netSeries.current = netChartInst.current.addSeries(LineSeries, { color: 'rgba(255,204,0,0.9)', lineWidth: 2 } as Partial<LineSeriesOptions>)
    }

    const onResize = () => {
      if (chartInst.current && chartRef.current)
        chartInst.current.applyOptions({ width: chartRef.current.clientWidth })
      if (netChartInst.current && netRef.current)
        netChartInst.current.applyOptions({ width: netRef.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const loadData = useCallback(async () => {
    initCharts()
    if (!chartInst.current) return
    const ep = isNdx ? '/api/ndx-uw-flow' : '/api/spx-uw-flow'
    try {
      const res = await fetch(`${BASE}${ep}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) return
      const d = await res.json()
      const hist: any[] = d.history || []
      if (!hist.length) return

      callSeries.current!.setData(hist.map((h: any) => ({ time: h.ts, value: h.call_prem })))
      putSeries.current!.setData( hist.map((h: any) => ({ time: h.ts, value: h.put_prem  })))
      chartInst.current!.timeScale().fitContent()

      if (netSeries.current) {
        netSeries.current.setData(hist.map((h: any) => ({
          time:  h.ts,
          value: h.net_prem !== undefined ? h.net_prem : h.call_prem - h.put_prem,
        })))
        netChartInst.current!.timeScale().fitContent()
      }

      const last = hist[hist.length - 1] || {}
      const net = last.net_prem !== undefined ? last.net_prem : (last.call_prem - last.put_prem)
      const callPct = last.call_prem / Math.max(last.call_prem + last.put_prem, 1) * 100
      const bias = callPct >= 60 ? 'CALL' : callPct <= 40 ? 'PUT' : 'MXD'
      const biasColor = callPct >= 60 ? 'var(--green)' : callPct <= 40 ? 'var(--red)' : 'var(--yellow)'
      const netColor  = net >= 0 ? 'var(--green)' : 'var(--red)'

      if (callEl.current) { callEl.current.textContent = fmtFlow(last.call_prem || 0); callEl.current.style.color = 'var(--green)' }
      if (putEl.current)  { putEl.current.textContent  = fmtFlow(last.put_prem  || 0); putEl.current.style.color  = 'var(--red)' }
      if (netEl2.current) { netEl2.current.textContent  = fmtFlow(net);                 netEl2.current.style.color  = netColor }
      if (biasEl.current) { biasEl.current.textContent  = bias;                          biasEl.current.style.color  = biasColor }
    } catch {}
  }, [isNdx, initCharts])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 60_000)
    return () => clearInterval(t)
  }, [loadData])

  // Re-init charts when side changes
  useEffect(() => {
    if (chartInst.current)    { chartInst.current.remove();    chartInst.current    = null }
    if (netChartInst.current) { netChartInst.current.remove(); netChartInst.current = null }
    callSeries.current = null; putSeries.current = null; netSeries.current = null
    setTimeout(loadData, 0)
  }, [isNdx]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Intraday Net Flow</span>
          <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW LIVE</span>
        </div>
        <span style={{ fontSize: 8, color: 'var(--muted2)' }}>60s refresh</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {([
          { label: 'Call Prem', ref: callEl },
          { label: 'Put Prem',  ref: putEl  },
          { label: 'Net',       ref: netEl2  },
          { label: 'Bias',      ref: biasEl  },
        ] as const).map(({ label, ref }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--muted2)' }}>{label}</div>
            <div ref={ref} style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)' }}>--</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', marginBottom: 3, fontWeight: 700 }}>Call vs Put Premium</div>
      <div ref={chartRef} />
      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted2)', margin: '8px 0 3px', fontWeight: 700 }}>Net Flow (Call − Put)</div>
      <div ref={netRef} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6 }}>
        <span style={{ fontSize: 8, color: 'var(--green)', fontFamily: 'var(--mono)' }}>▬ Call Premium</span>
        <span style={{ fontSize: 8, color: 'var(--red)',   fontFamily: 'var(--mono)' }}>▬ Put Premium</span>
        <span style={{ fontSize: 8, color: 'var(--yellow)',fontFamily: 'var(--mono)' }}>█ Net Flow</span>
      </div>
    </div>
  )
}
