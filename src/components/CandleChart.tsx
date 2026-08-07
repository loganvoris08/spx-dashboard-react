import { useEffect, useRef, useCallback } from 'react'
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

interface Props {
  title: string
  candleEndpoint: string
  zonesEndpoint?: string
  timeVisible?: boolean
  livePrice?: number | null
  height?: number
}

export default function CandleChart({ title, candleEndpoint, zonesEndpoint, timeVisible = false, livePrice, height = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const seriesRef    = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const liveCandleRef = useRef<any>(null)
  const statusRef    = useRef<HTMLSpanElement>(null)
  const priceLines   = useRef<any[]>([])

  const chartH = () => height > 0 ? height : Math.max(280, window.innerHeight - 160)

  const drawZones = useCallback(async () => {
    if (!seriesRef.current || !zonesEndpoint) return
    priceLines.current.forEach(l => { try { seriesRef.current!.removePriceLine(l) } catch {} })
    priceLines.current = []
    try {
      const z = await apiFetch(zonesEndpoint)
      const zones: any[] = z.zones || []
      zones.forEach((zone: any) => {
        const isCurrent = zone.current
        const isMain    = zone.type === 'main'
        const bord = isMain
          ? (isCurrent ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)')
          : (isCurrent ? 'rgba(168,85,247,0.8)'  : 'rgba(168,85,247,0.55)')
        const mid  = isMain
          ? (isCurrent ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)')
          : (isCurrent ? 'rgba(168,85,247,0.4)'   : 'rgba(168,85,247,0.25)')
        const w = isCurrent ? 2 : 1
        const add = (price: number, color: string, lbl: string, dashed: boolean) => {
          if (!price || isNaN(price)) return
          try {
            const ln = seriesRef.current!.createPriceLine({
              price, color, lineWidth: w,
              lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
              axisLabelVisible: !!lbl, title: lbl,
            })
            priceLines.current.push(ln)
          } catch {}
        }
        if (zone.top) add(zone.top, bord, isCurrent && isMain ? 'Zone Top' : '', false)
        if (zone.bot) add(zone.bot, bord, isCurrent && isMain ? 'Zone Bot' : '', false)
        if (zone.mid) add(zone.mid, mid, '', true)
      })
    } catch {}
  }, [zonesEndpoint])

  const load = useCallback(async () => {
    if (!containerRef.current) return

    if (!chartRef.current) {
      chartRef.current = createChart(containerRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#888' },
        grid:   { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.06, bottom: 0.06 } },
        timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible, secondsVisible: false },
        width: containerRef.current.clientWidth,
        height: chartH(),
      })
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      })
      const onResize = () => {
        if (chartRef.current && containerRef.current)
          chartRef.current.applyOptions({ width: containerRef.current!.clientWidth, height: chartH() })
      }
      window.addEventListener('resize', onResize)
    }

    if (statusRef.current) statusRef.current.textContent = 'Loading...'
    try {
      const d = await apiFetch(candleEndpoint)
      const candles: any[] = d.candles || []
      if (!candles.length) { if (statusRef.current) statusRef.current.textContent = 'No data'; return }
      seriesRef.current!.setData(candles)
      liveCandleRef.current = candles[candles.length - 1]
      chartRef.current!.timeScale().fitContent()
      setTimeout(() => chartRef.current?.timeScale().scrollToRealTime(), 50)
      if (statusRef.current) {
        const close = liveCandleRef.current.close
        statusRef.current.textContent = `${title} ${close.toFixed(2)}`
      }
      drawZones()
    } catch (e: any) {
      if (statusRef.current) statusRef.current.textContent = 'Error loading'
    }
  }, [candleEndpoint, timeVisible, title, drawZones])

  // Update live candle when livePrice prop changes
  useEffect(() => {
    if (!seriesRef.current || !liveCandleRef.current || livePrice == null) return
    const updated = {
      time:  liveCandleRef.current.time,
      open:  liveCandleRef.current.open,
      high:  Math.max(liveCandleRef.current.high, livePrice),
      low:   Math.min(liveCandleRef.current.low, livePrice),
      close: livePrice,
    }
    liveCandleRef.current = updated
    seriesRef.current.update(updated)
    if (statusRef.current) statusRef.current.textContent = `${title} ${livePrice.toFixed(2)}`
  }, [livePrice, title])

  useEffect(() => {
    load()
    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
      seriesRef.current = null; liveCandleRef.current = null; priceLines.current = []
    }
  }, [load])

  return (
    <div style={{ margin: 0, borderRadius: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted2)' }}>{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span ref={statusRef} style={{ fontSize: 9, color: 'var(--muted2)' }}>Loading...</span>
          <button onClick={load} style={{ fontSize: 9, padding: '3px 8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  )
}
