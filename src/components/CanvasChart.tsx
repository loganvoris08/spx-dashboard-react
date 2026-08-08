import { useEffect, useRef, useCallback } from 'react'

export interface CCSeries {
  data: Array<{ time: number; value: number }>
  color: string   // e.g. '#00ff88'
  rgb: string     // e.g. '0,255,136'
  fill?: boolean
  dash?: [number, number]
  lw?: number
  label?: string
}

interface Props {
  series: CCSeries[]
  height?: number
  /** Split at zero: positive = green, negative = red. Only reads series[0]. */
  split?: boolean
  /** Show neon glow multi-pass on the line */
  glow?: boolean
  /** Pulse the leading-edge dot */
  pulse?: boolean
  yFmt?: (v: number) => string
  className?: string
  style?: React.CSSProperties
}

const PAD = { t: 22, b: 28, l: 46, r: 12 }

function fmtDefault(v: number) {
  const a = Math.abs(v)
  return (v >= 0 ? '' : '-') + (a >= 1e9 ? (a/1e9).toFixed(1)+'B' : a >= 1e6 ? (a/1e6).toFixed(1)+'M' : a >= 1e3 ? (a/1e3).toFixed(0)+'K' : a.toFixed(0))
}
function tFmt(ts: number) {
  const d = new Date(ts * 1000)
  let h = d.getHours(), m = d.getMinutes()
  const suf = h >= 12 ? 'p' : 'a'
  h = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h}:${m.toString().padStart(2,'0')}${suf}`
}

export default function CanvasChart({ series, height = 160, split = false, glow = false, pulse = true, yFmt = fmtDefault, className, style }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const phaseRef   = useRef(0)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const dprRef     = useRef(1)
  const lwRef      = useRef(0)

  const render = useCallback((phase: number) => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = dprRef.current
    const W = lwRef.current
    const H = height
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // — collect all points for global min/max —
    const allSeries = series.filter(s => s.data.length > 0)
    if (!allSeries.length) { ctx.clearRect(0, 0, W, H); return }

    let minV = Infinity, maxV = -Infinity
    allSeries.forEach(s => s.data.forEach(p => { if (p.value < minV) minV = p.value; if (p.value > maxV) maxV = p.value }))
    if (split) { const m = Math.max(Math.abs(minV), Math.abs(maxV), 1); minV = -m; maxV = m }
    if (minV === maxV) { minV -= 1; maxV += 1 }
    const range = maxV - minV

    const iW = W - PAD.l - PAD.r
    const iH = H - PAD.t - PAD.b

    const mapX = (i: number, n: number) => PAD.l + (i / Math.max(n - 1, 1)) * iW
    const mapY = (v: number) => PAD.t + iH * (1 - (v - minV) / range)
    const zy   = mapY(0)

    // — clear —
    ctx.clearRect(0, 0, W, H)

    // — grid —
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + iH * (i / 4)
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke()
    }
    for (let i = 0; i <= 5; i++) {
      const x = PAD.l + iW * (i / 5)
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + iH); ctx.stroke()
    }

    // — zero line (split charts) —
    if (split) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 6])
      ctx.beginPath(); ctx.moveTo(PAD.l, zy); ctx.lineTo(W - PAD.r, zy); ctx.stroke()
      ctx.setLineDash([])
    }

    // — draw each series —
    allSeries.forEach(s => {
      const pts = s.data
      if (!pts.length) return
      const lw = s.lw ?? 1.5

      if (split && allSeries.length === 1) {
        // SPLIT MODE: green above zero, red below, line color matches region
        // Call fill (above zero)
        const callGrad = ctx.createLinearGradient(PAD.l, 0, W - PAD.r, 0)
        callGrad.addColorStop(0, 'rgba(0,255,136,0.00)')
        callGrad.addColorStop(0.35, 'rgba(0,255,136,0.05)')
        callGrad.addColorStop(1,   'rgba(0,255,136,0.20)')
        ctx.beginPath(); ctx.moveTo(mapX(0, pts.length), zy)
        pts.forEach((p, i) => ctx.lineTo(mapX(i, pts.length), p.value > 0 ? mapY(p.value) : zy))
        ctx.lineTo(mapX(pts.length - 1, pts.length), zy); ctx.closePath()
        ctx.fillStyle = callGrad; ctx.fill()

        // Put fill (below zero)
        const putGrad = ctx.createLinearGradient(PAD.l, 0, W - PAD.r, 0)
        putGrad.addColorStop(0, 'rgba(255,51,68,0.00)')
        putGrad.addColorStop(0.35, 'rgba(255,51,68,0.05)')
        putGrad.addColorStop(1,   'rgba(255,51,68,0.20)')
        ctx.beginPath(); ctx.moveTo(mapX(0, pts.length), zy)
        pts.forEach((p, i) => ctx.lineTo(mapX(i, pts.length), p.value < 0 ? mapY(p.value) : zy))
        ctx.lineTo(mapX(pts.length - 1, pts.length), zy); ctx.closePath()
        ctx.fillStyle = putGrad; ctx.fill()

        // Animated line: color-coded by sign, brightness fades left→right
        for (let i = 1; i < pts.length; i++) {
          const frac = i / pts.length
          const alpha = 0.1 + frac * 0.9
          const rgb = pts[i].value >= 0 ? '0,255,136' : '255,51,68'
          const glowC = pts[i].value >= 0 ? '#00ff88' : '#ff3344'
          const x1 = mapX(i - 1, pts.length), y1 = mapY(pts[i - 1].value)
          const x2 = mapX(i, pts.length),     y2 = mapY(pts[i].value)
          if (glow) { ctx.shadowColor = glowC; ctx.shadowBlur = frac * 8 }
          ctx.strokeStyle = `rgba(${rgb},${alpha})`
          ctx.lineWidth = 0.5 + frac * lw
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        }
        ctx.shadowBlur = 0

        // Zero-crossing markers
        for (let i = 1; i < pts.length; i++) {
          if ((pts[i-1].value >= 0) !== (pts[i].value >= 0)) {
            const t0 = -pts[i-1].value / (pts[i].value - pts[i-1].value)
            const xc = mapX(i - 1, pts.length) + t0 * (mapX(i, pts.length) - mapX(i - 1, pts.length))
            const frac = (i - 1 + t0) / pts.length
            if (frac > 0.15) {
              ctx.beginPath(); ctx.arc(xc, zy, 2, 0, Math.PI * 2)
              ctx.fillStyle = `rgba(255,255,255,${0.15 + frac * 0.45})`; ctx.fill()
            }
          }
        }
      } else {
        // MULTI MODE: each series gets its own color gradient area
        const rgb = s.rgb
        if (s.fill !== false) {
          // Determine fill baseline: zero if it's in range, else minV
          const fillBase = minV <= 0 && maxV >= 0 ? 0 : minV
          const fillY = mapY(fillBase)
          const aGrad = ctx.createLinearGradient(PAD.l, 0, W - PAD.r, 0)
          aGrad.addColorStop(0,    `rgba(${rgb},0.00)`)
          aGrad.addColorStop(0.3,  `rgba(${rgb},0.04)`)
          aGrad.addColorStop(1,    `rgba(${rgb},0.18)`)
          ctx.beginPath()
          pts.forEach((p, i) => {
            const x = mapX(i, pts.length), y = mapY(p.value)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.lineTo(mapX(pts.length - 1, pts.length), fillY)
          ctx.lineTo(PAD.l, fillY); ctx.closePath()
          ctx.fillStyle = aGrad; ctx.fill()
        }

        if (s.dash) ctx.setLineDash(s.dash)
        if (glow) {
          // Multi-pass glow
          [[10, `rgba(${s.rgb},0.1)`, lw * 4], [5, `rgba(${s.rgb},0.25)`, lw * 2], [2, s.color, lw]] .forEach(([blur, color, width]) => {
            ctx.shadowColor = s.color; ctx.shadowBlur = blur as number
            ctx.strokeStyle = color as string; ctx.lineWidth = width as number
            ctx.beginPath()
            pts.forEach((p, i) => {
              const x = mapX(i, pts.length), y = mapY(p.value)
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
            })
            ctx.stroke()
          })
        } else {
          // Fading brightness left→right for live feel
          for (let i = 1; i < pts.length; i++) {
            const frac = i / pts.length
            const alpha = 0.12 + frac * 0.88
            ctx.strokeStyle = `rgba(${s.rgb},${alpha})`
            ctx.lineWidth = 0.5 + frac * lw
            ctx.shadowColor = s.color; ctx.shadowBlur = frac * 5
            ctx.beginPath()
            ctx.moveTo(mapX(i - 1, pts.length), mapY(pts[i-1].value))
            ctx.lineTo(mapX(i, pts.length),     mapY(pts[i].value))
            ctx.stroke()
          }
        }
        ctx.shadowBlur = 0; ctx.setLineDash([])
      }

      // — Pulse on leading edge —
      if (pulse && pts.length > 0) {
        const last = pts[pts.length - 1]
        const tx = mapX(pts.length - 1, pts.length)
        const ty = mapY(last.value)
        const tipRgb = split ? (last.value >= 0 ? '0,255,136' : '255,51,68') : s.rgb
        const tipColor = split ? (last.value >= 0 ? '#00ff88' : '#ff3344') : s.color
        const p = (Math.sin(phase * 0.12) + 1) * 0.5
        ctx.beginPath(); ctx.arc(tx, ty, 4 + p * 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${tipRgb},${0.55 - p * 0.45})`; ctx.lineWidth = 1
        ctx.shadowColor = tipColor; ctx.shadowBlur = 10 + p * 8; ctx.stroke(); ctx.shadowBlur = 0
        ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = tipColor; ctx.shadowColor = tipColor; ctx.shadowBlur = 12; ctx.fill()
        ctx.beginPath(); ctx.arc(tx, ty, 1, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; ctx.fill()
      }
    })

    // — Axes —
    const firstSeries = allSeries[0]
    ctx.fillStyle = '#4b5563'; ctx.font = '8px Consolas,monospace'
    ctx.textAlign = 'center'
    const timeTickN = 5
    for (let i = 0; i <= timeTickN; i++) {
      const idx = Math.round(i / timeTickN * (firstSeries.data.length - 1))
      if (firstSeries.data[idx]) {
        const x = PAD.l + (i / timeTickN) * iW
        ctx.fillText(tFmt(firstSeries.data[idx].time), x, H - PAD.b + 12)
      }
    }
    ctx.textAlign = 'right'
    const yTicks = [minV, minV + range / 2, maxV]
    yTicks.forEach(v => {
      const y = mapY(v)
      ctx.fillText(yFmt(v), PAD.l - 3, y + 3)
    })

    // — Corner labels —
    if (split) {
      ctx.font = '7px Consolas,monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0,255,136,0.4)'; ctx.fillText('CALLS ▲', PAD.l + 4, PAD.t + 10)
      ctx.fillStyle = 'rgba(255,51,68,0.4)';  ctx.fillText('PUTS ▼', PAD.l + 4, H - PAD.b - 4)
    }
  }, [series, height, split, glow, pulse, yFmt])

  // Animate
  useEffect(() => {
    let running = true
    function tick() {
      if (!running) return
      phaseRef.current += 1
      render(phaseRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [render])

  // Resize
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w < 10) return
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr; lwRef.current = w
      const cv = canvasRef.current!
      cv.width = w * dpr; cv.height = height * dpr
    })
    obs.observe(wrap)
    return () => obs.disconnect()
  }, [height])

  return (
    <div ref={wrapRef} className={className} style={{ width: '100%', ...style }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} />
    </div>
  )
}
