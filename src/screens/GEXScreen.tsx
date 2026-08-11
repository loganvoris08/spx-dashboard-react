import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useLadders, postAiRead } from '../hooks/useLadders'
import { useSide } from '../lib/SideContext'
import { useLivePrice } from '../lib/LivePriceContext'
import { useSSE } from '../lib/SSEContext'
import LadderPriceLine from '../components/LadderPriceLine'
import { computeHotScores } from '../lib/hotScores'
import { Tooltip } from '../components/Tooltip'

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
        <Tooltip tip="Net dealer gamma per 1-minute bar throughout the session. Positive = dealers long gamma (stabilizing, buy dips/sell rips). Negative = dealers short gamma (forced to chase moves, amplifying). Sustained negative readings often precede sharp directional breaks.">Intraday GEX — 1-Min</Tooltip>
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

function regimeColor(r: string | null | undefined): string {
  const s = (r ?? '').toUpperCase()
  if (s === 'EXTREME POSITIVE') return '#00ffaa'
  if (s === 'POSITIVE')          return 'var(--green)'
  if (s === 'EXTREME NEGATIVE')  return '#ff2244'
  if (s === 'NEGATIVE')          return 'var(--red)'
  return 'var(--muted2)'  // TRANSITION or unknown
}

function GEXHBars({ rows, priceStrike, flipStrike, hotScores, priceRowRef }: { rows: any[]; priceStrike: number; flipStrike: number; hotScores: Map<number, number>; priceRowRef?: React.RefObject<HTMLDivElement | null> }) {
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
          <div key={i} ref={isPrice ? priceRowRef : undefined} className="hbar-row" style={{ background: isHot && !isPrice && !isFlip ? undefined : bg, animation: isHot && !isPrice && !isFlip ? 'pulseHot 1.4s ease-in-out infinite' : undefined }}>
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

function GammaGravityCanvas({ strikes, priceNum }: { strikes: any[]; priceNum: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !strikes.length || !priceNum) return

    const dpr  = window.devicePixelRatio || 1
    const W    = canvas.offsetWidth || 320
    const H    = 210
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx  = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const nearby = strikes
      .filter((s: any) => Math.abs((s.strike ?? s.level ?? 0) - priceNum) <= 175)
      .sort((a: any, b: any) => (a.strike ?? a.level) - (b.strike ?? b.level))
    if (!nearby.length) return

    const allGex = nearby.map((s: any) => Math.abs(s.net_gex ?? ((s.call_gex ?? 0) - (s.put_gex ?? 0))))
    const maxGex = Math.max(...allGex, 1)

    const strikes_ = nearby.map((s: any) => s.strike ?? s.level)
    const minS = Math.min(...strikes_)
    const maxS = Math.max(...strikes_)
    const sRange = maxS - minS || 1
    const pad  = { l: 10, r: 10, t: 32, b: 26 }
    const cW   = W - pad.l - pad.r
    const cH   = H - pad.t - pad.b
    const sxOf = (s: number) => pad.l + ((s - minS) / sRange) * cW
    const priceX = sxOf(priceNum)
    const midY   = pad.t + cH / 2

    let phase = 0

    function draw() {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#080a10'
      ctx.fillRect(0, 0, W, H)

      // ── gravity halos ──────────────────────────────────────────────
      nearby.forEach((s: any) => {
        const netGex = s.net_gex ?? ((s.call_gex ?? 0) - (s.put_gex ?? 0))
        const t = Math.abs(netGex) / maxGex
        if (t < 0.08) return
        const sx  = sxOf(s.strike ?? s.level)
        const r   = cW * 0.11 * t
        const osc = 0.9 + 0.1 * Math.sin(phase + sx * 0.05)
        const col = netGex > 0 ? `rgba(0,255,136,${t * 0.13 * osc})` : `rgba(255,51,68,${t * 0.13 * osc})`
        const grad = ctx.createRadialGradient(sx, midY, 0, sx, midY, r)
        grad.addColorStop(0, col)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(sx, midY, r, 0, Math.PI * 2)
        ctx.fill()
      })

      // ── zero line ──────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath(); ctx.moveTo(pad.l, midY); ctx.lineTo(W - pad.r, midY); ctx.stroke()
      ctx.setLineDash([])

      // ── strike pillars ──────────────────────────────────────────────
      nearby.forEach((s: any) => {
        const netGex = s.net_gex ?? ((s.call_gex ?? 0) - (s.put_gex ?? 0))
        const t    = Math.abs(netGex) / maxGex
        if (t < 0.02) return
        const sx   = sxOf(s.strike ?? s.level)
        const pulse = 1 + 0.05 * Math.sin(phase * 1.4 + sx * 0.08)
        const barH = cH * 0.55 * t * pulse
        const isCall = netGex > 0
        const alpha  = 0.28 + t * 0.55

        ctx.save()
        ctx.shadowColor = isCall ? `rgba(0,255,136,${t * 0.85})` : `rgba(255,51,68,${t * 0.85})`
        ctx.shadowBlur  = 10 * t
        ctx.fillStyle   = isCall ? `rgba(0,255,136,${alpha})` : `rgba(255,51,68,${alpha})`
        // Symmetric bar centered on midY
        ctx.fillRect(sx - 2.5, midY - barH / 2, 5, barH)
        ctx.restore()
      })

      // ── compute net force at price ──────────────────────────────────
      let totalForce = 0
      nearby.forEach((s: any) => {
        const netGex = s.net_gex ?? ((s.call_gex ?? 0) - (s.put_gex ?? 0))
        const dist   = (s.strike ?? s.level) - priceNum
        if (Math.abs(dist) < 0.5) return
        totalForce  += netGex / (dist * dist) * Math.sign(dist)
      })

      // ── force arrow above price ─────────────────────────────────────
      if (Math.abs(totalForce) > 0.0005) {
        const dir     = totalForce > 0 ? 1 : -1
        const arrowLen = Math.min(44, 10 + Math.abs(totalForce) * 600)
        const arrowY   = midY - cH * 0.38
        const forceCol = totalForce > 0 ? 'rgba(0,255,136,0.95)' : 'rgba(255,51,68,0.95)'
        ctx.save()
        ctx.strokeStyle = forceCol
        ctx.shadowColor = forceCol
        ctx.shadowBlur  = 8
        ctx.lineWidth   = 2.5
        ctx.lineCap     = 'round'
        ctx.beginPath()
        ctx.moveTo(priceX - dir * arrowLen, arrowY)
        ctx.lineTo(priceX + dir * 4, arrowY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(priceX + dir * 4, arrowY - 5)
        ctx.lineTo(priceX + dir * 12, arrowY)
        ctx.lineTo(priceX + dir * 4, arrowY + 5)
        ctx.stroke()
        ctx.restore()
      }

      // ── price particle ─────────────────────────────────────────────
      const pulseSz = 7 + 2.5 * Math.sin(phase * 2.4)
      ctx.save()
      ctx.shadowColor = 'rgba(255,220,0,1)'
      ctx.shadowBlur  = 20
      ctx.beginPath()
      ctx.arc(priceX, midY, pulseSz, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,210,0,0.92)'
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.arc(priceX, midY, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()

      // ── strike labels ──────────────────────────────────────────────
      ctx.fillStyle = 'rgba(140,150,170,0.45)'
      ctx.font = '7.5px monospace'
      ctx.textAlign = 'center'
      nearby.forEach((s: any) => {
        const strike = s.strike ?? s.level
        if (strike % 25 !== 0) return
        const sx = sxOf(strike)
        if (Math.abs(sx - priceX) < 18) return
        ctx.fillText(String(strike), sx, H - 8)
      })

      // ── price label ────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255,210,0,0.9)'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(priceNum.toFixed(0), priceX, H - 8)

      // ── top labels ─────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(130,140,160,0.55)'
      ctx.font = '7px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('GAMMA GRAVITY FIELD', pad.l, 12)

      const forceLabel = Math.abs(totalForce) < 0.0005 ? 'BALANCED'
        : totalForce > 0 ? '→ CALL PULL' : '← PUT PULL'
      ctx.fillStyle = Math.abs(totalForce) < 0.0005
        ? 'rgba(200,200,80,0.7)'
        : totalForce > 0 ? 'rgba(0,255,136,0.85)' : 'rgba(255,51,68,0.85)'
      ctx.textAlign = 'right'
      ctx.fillText(forceLabel, W - pad.r, 12)

      // ── max GEX strike label ────────────────────────────────────────
      const topStrike = nearby.reduce((best: any, s: any) =>
        Math.abs(s.net_gex ?? 0) > Math.abs(best?.net_gex ?? 0) ? s : best, nearby[0])
      if (topStrike) {
        const tStrike = topStrike.strike ?? topStrike.level
        const tsx = sxOf(tStrike)
        ctx.fillStyle = 'rgba(150,160,200,0.55)'
        ctx.font = '7px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`MAX ${tStrike}`, tsx, pad.t - 6)
      }

      phase += 0.022
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [strikes, priceNum])

  if (!strikes.length || !priceNum) return (
    <div style={{ color: 'var(--muted2)', fontSize: 10, textAlign: 'center', padding: 20 }}>No GEX data</div>
  )
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: 4 }} height={210} />
}

function GEXTerrainMap({ strikes, priceNum, flipNum, callWall, putWall }: {
  strikes: any[]; priceNum: number; flipNum: number; callWall?: number; putWall?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !strikes.length) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const ROW_H = 12
    const rows = [...strikes].sort((a: any, b: any) =>
      parseFloat(String(b.strike)) - parseFloat(String(a.strike)))
    const H = rows.length * ROW_H
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const maxGex = Math.max(...rows.map((r: any) => Math.abs(r.net_gex ?? 0)), 1)
    const cx = W / 2
    rows.forEach((r: any, i: number) => {
      const s   = parseFloat(String(r.strike))
      const net = r.net_gex ?? 0
      const t   = Math.min(1, Math.abs(net) / maxGex)
      const y   = i * ROW_H
      // Background
      ctx.fillStyle = 'rgba(255,255,255,0.02)'
      ctx.fillRect(0, y, W, ROW_H - 1)
      // GEX bar — positive = right (green), negative = left (red)
      const barW = t * (W * 0.45)
      if (net >= 0) {
        const alpha = 0.35 + t * 0.5
        ctx.fillStyle = `rgba(0,255,136,${alpha.toFixed(2)})`
        ctx.fillRect(cx, y + 2, barW, ROW_H - 4)
      } else {
        const alpha = 0.35 + t * 0.5
        ctx.fillStyle = `rgba(255,51,68,${alpha.toFixed(2)})`
        ctx.fillRect(cx - barW, y + 2, barW, ROW_H - 4)
      }
      // Strike label
      ctx.fillStyle = `rgba(180,180,200,${0.5 + t * 0.4})`
      ctx.font = `${Math.max(8, 9 - (rows.length > 30 ? 1 : 0))}px monospace`
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(s)), cx - 4, y + ROW_H - 3)
    })
    // Center zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
    // ATM price line
    if (priceNum > 0) {
      const priceY = rows.findIndex((r: any) => parseFloat(String(r.strike)) <= priceNum) * ROW_H
      if (priceY >= 0) {
        ctx.strokeStyle = 'rgba(255,204,0,0.85)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.shadowColor = 'rgba(255,204,0,0.6)'
        ctx.shadowBlur = 4
        ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(W, priceY); ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
    // Flip zone line
    if (flipNum > 0) {
      const flipY = rows.findIndex((r: any) => parseFloat(String(r.strike)) <= flipNum) * ROW_H
      if (flipY >= 0) {
        ctx.strokeStyle = 'rgba(180,0,255,0.7)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(0, flipY); ctx.lineTo(W, flipY); ctx.stroke()
        ctx.setLineDash([])
      }
    }
    // Call wall
    if (callWall) {
      const cWY = rows.findIndex((r: any) => parseFloat(String(r.strike)) <= callWall) * ROW_H
      if (cWY >= 0) {
        ctx.strokeStyle = 'rgba(0,255,136,0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath(); ctx.moveTo(0, cWY); ctx.lineTo(W, cWY); ctx.stroke()
        ctx.setLineDash([])
      }
    }
    // Put wall
    if (putWall) {
      const pWY = rows.findIndex((r: any) => parseFloat(String(r.strike)) <= putWall) * ROW_H
      if (pWY >= 0) {
        ctx.strokeStyle = 'rgba(255,51,68,0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath(); ctx.moveTo(0, pWY); ctx.lineTo(W, pWY); ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [strikes, priceNum, flipNum, callWall, putWall])

  if (!strikes.length) return null
  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Tooltip tip="3D visualization of gamma exposure across strikes and time. Green peaks = large call GEX (dealer support). Red troughs = large put GEX (dealer resistance). The yellow line is current price; the purple dashed line is the GEX flip zone." label="GEX Terrain Map">GEX Terrain Map</Tooltip>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--yellow)', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 3, padding: '1px 5px' }}>SURFACE</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted2)', marginBottom: 6, display: 'flex', gap: 12 }}>
        <span><span style={{ color: 'var(--green)' }}>■</span> Call GEX</span>
        <span><span style={{ color: 'var(--red)' }}>■</span> Put GEX</span>
        <span><span style={{ color: 'var(--yellow)' }}>—</span> ATM</span>
        <span><span style={{ color: '#b400ff' }}>- -</span> Flip</span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 360 }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  )
}

export default function GEXScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const live = useLivePrice()
  const { on } = useSSE()
  const isNdx = side === 'ndx'
  type GexTicker = 'spx' | 'ndx' | 'qqq' | 'iwm'
  const [gexTicker, setGexTicker] = useState<GexTicker>(isNdx ? 'ndx' : 'spx')
  const [bucket, setBucket]       = useState<Bucket>('all')
  const [range, setRange]         = useState(150)
  const [dealerText, setDealerText] = useState('')
  const [loadingDealer, setLoadingDealer] = useState(false)
  const [gexStrikes,   setGexStrikes]   = useState<any[]>([])
  const [gexByExpiry,  setGexByExpiry]  = useState<any[]>([])
  const [gexBuckets,   setGexBuckets]   = useState<Record<string, any[]>>({'0dte': [], 'weekly': [], 'monthly': []})
  const [qiwmLevels,   setQiwmLevels]   = useState<any>(null)
  const ladders = useLadders(true)
  const gexPriceRowRef  = useRef<HTMLDivElement>(null)
  const gexScrollRef    = useRef<HTMLDivElement>(null)
  const gexAutoScrolled = useRef(false)

  // Sync gexTicker when global side changes
  useEffect(() => { setGexTicker(isNdx ? 'ndx' : 'spx') }, [isNdx])

  const loadGexStrikes = useCallback((ticker: GexTicker = gexTicker) => {
    const isQIWM = ticker === 'qqq' || ticker === 'iwm'
    const path = ticker === 'ndx' ? '/api/ndx-gex-strikes'
               : ticker === 'qqq' ? '/api/qqq-gex-strikes'
               : ticker === 'iwm' ? '/api/iwm-gex-strikes'
               : '/api/gex-strikes'
    apiFetch(path)
      .then(d => {
        setGexStrikes(d.strikes ?? [])
        if (isQIWM) setQiwmLevels(d.levels ?? null)
        else setQiwmLevels(null)
      })
      .catch(() => {})
  }, [gexTicker])

  const loadGexByExpiry = useCallback((ticker: GexTicker = gexTicker) => {
    if (ticker === 'qqq' || ticker === 'iwm') return
    apiFetch(ticker === 'ndx' ? '/api/ndx-gex-by-expiry' : '/api/gex-by-expiry')
      .then(d => setGexByExpiry(d.data ?? []))
      .catch(() => {})
  }, [gexTicker])

  const bucketRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadGexBuckets = useCallback((ticker: GexTicker = gexTicker) => {
    if (ticker === 'qqq' || ticker === 'iwm') return
    if (bucketRetryRef.current) clearTimeout(bucketRetryRef.current)
    apiFetch(ticker === 'ndx' ? '/api/ndx-gex-buckets' : '/api/gex-buckets')
      .then(d => {
        setGexBuckets(d)
        const allEmpty = Object.values(d as Record<string, any[]>).every(v => v.length === 0)
        if (allEmpty) bucketRetryRef.current = setTimeout(() => loadGexBuckets(ticker), 4000)
      })
      .catch(() => {})
  }, [gexTicker])

  useEffect(() => {
    setGexStrikes([])
    setGexByExpiry([])
    setGexBuckets({'0dte': [], 'weekly': [], 'monthly': []})
    setQiwmLevels(null)
    loadGexStrikes(gexTicker)
    loadGexByExpiry(gexTicker)
    loadGexBuckets(gexTicker)
    const off1 = on('update', () => loadGexStrikes(gexTicker))
    const off2 = on('update', () => loadGexByExpiry(gexTicker))
    const off3 = on('update', () => loadGexBuckets(gexTicker))
    return () => { off1(); off2(); off3() }
  }, [gexTicker, loadGexStrikes, loadGexByExpiry, loadGexBuckets, on])

  const nd = data?.ndx ?? {}
  const isQIWM = gexTicker === 'qqq' || gexTicker === 'iwm'

  const oiRows = isNdx
    ? (ladders?.ndx?.oi_ladder_buckets?.[bucket] ?? ladders?.ndx?.oi_ladder_buckets?.all ?? ladders?.ndx?.ladder_rows ?? [])
    : (ladders?.oi_ladder_buckets?.[bucket] ?? ladders?.oi_ladder_buckets?.all ?? ladders?.ladder_rows ?? [])

  const priceNum = isQIWM
    ? (qiwmLevels?.price ?? 0)
    : isNdx
      ? (live.ndx ?? (typeof nd.price === 'string' ? parseFloat(nd.price.replace(/,/g, '')) : nd.price ?? 0))
      : (live.spx ?? (typeof data?.spx === 'string' ? parseFloat(String(data?.spx).replace(/,/g, '')) : data?.spx ?? 0))
  const regime   = isQIWM ? null : isNdx ? (nd.gamma_regime ?? nd.uw_gamma_regime) : (data?.gamma_regime ?? data?.uw_gamma_regime ?? data?.gamma_state)
  const flip     = isQIWM ? qiwmLevels?.flip : isNdx ? (nd.gex_flip_zone_raw ?? nd.gex_flip_zone) : (data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const maxPain  = !isNdx && !isQIWM ? data?.max_pain_strike : null
  const maxPainDte = !isNdx && !isQIWM ? (data?.max_pain_dte ?? data?.max_pain_days ?? null) : null
  const cWall    = isQIWM ? qiwmLevels?.call_wall : isNdx ? (nd.nearest_call_wall ?? nd.gex_nearest_call_wall) : (data?.nearest_call_wall ?? data?.gex_nearest_call_wall)
  const pWall    = isQIWM ? qiwmLevels?.put_wall  : isNdx ? (nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)  : (data?.nearest_put_wall  ?? data?.gex_nearest_put_wall)
  const netDelta = !isNdx && !isQIWM ? data?.net_delta_dir : null
  const flowBias = isQIWM ? null : isNdx ? (nd.flow_bias ?? data?.ndx_flow_bias) : data?.flow_bias
  const pcRatio  = !isNdx && !isQIWM ? data?.put_call_ratio : null

  const callPct  = isNdx ? (nd.flow_call_pct ?? 50) : (data?.flow_call_pct ?? 50)
  const putPct   = isNdx ? (nd.flow_put_pct  ?? 50) : (data?.flow_put_pct  ?? 50)
  const gammaPerPct = !isNdx && !isQIWM ? data?.dealer_gamma_dollar_per_pct : null
  const dhPressure  = isQIWM ? null : isNdx ? nd.delta_hedging_pressure : data?.delta_hedging_pressure
  const charm    = isQIWM ? null : isNdx ? nd.charm_flow  : data?.charm_flow
  const vanna    = isQIWM ? null : isNdx ? nd.vanna_flow  : data?.vanna_flow
  const netDeltaDisplay = !isNdx && !isQIWM ? data?.net_dealer_delta : null

  // Compute dealer score client-side (mirrors _updateScorecard in old dashboard)
  type ScFactor = { label: string; val: string; cls: string }
  const dealerScore = (() => {
    if (isQIWM) return null  // no dealer score for ETFs
    const src = isNdx ? nd : (data ?? {})
    if (!data) return null
    let sc = 50
    const factors: ScFactor[] = []
    const fmtD = (v: number) => { const a = Math.abs(v); if (a >= 1e9) return (a/1e9).toFixed(2)+'B'; if (a >= 1e6) return (a/1e6).toFixed(1)+'M'; if (a >= 1e3) return (a/1e3).toFixed(0)+'K'; return a.toFixed(1) }
    const gamma = String(src.gamma_regime ?? src.uw_gamma_regime ?? src.gamma_state ?? '').toUpperCase()
    if (gamma === 'EXTREME POSITIVE') { sc -= 20; factors.push({ label: 'Gamma', val: 'EXTREME POSITIVE', cls: 'bull' }) }
    else if (gamma === 'POSITIVE')    { sc -= 15; factors.push({ label: 'Gamma', val: 'POSITIVE',         cls: 'bull' }) }
    else if (gamma === 'EXTREME NEGATIVE') { sc += 20; factors.push({ label: 'Gamma', val: 'EXTREME NEGATIVE', cls: 'bear' }) }
    else if (gamma === 'NEGATIVE')    { sc += 15; factors.push({ label: 'Gamma', val: 'NEGATIVE',         cls: 'bear' }) }
    else { factors.push({ label: 'Gamma', val: 'TRANSITION', cls: 'warn' }) }
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
      if (Math.abs(dist) <= 5) { factors.push({ label: 'Flip', val: 'AT FLIP', cls: 'warn' }) }
      else if (dist > 0) { factors.push({ label: 'Flip', val: `ABOVE +${dist.toFixed(0)}pts`, cls: 'neut' }) }
      else { factors.push({ label: 'Flip', val: `BELOW ${Math.abs(dist).toFixed(0)}pts`, cls: 'neut' }) }
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
  const activeGexRows = bucket === 'all' ? gexStrikes : (gexBuckets[bucket] ?? [])
  const rangeFiltered = activeGexRows.filter((r: any) => {
    const s = parseFloat(String(r.strike).replace(/,/g, ''))
    return Math.abs(s - priceNum) <= range
  })
  const bucketData = sortDesc(rangeFiltered.length > 0 ? rangeFiltered : activeGexRows)

  const hotScores = new Map<number, number>(
    [...computeHotScores(oiRows, bucketData, priceNum).entries()].filter(([, s]) => s >= 50)
  )

  // Reset auto-scroll flag whenever the ticker or bucket changes
  useEffect(() => { gexAutoScrolled.current = false }, [gexTicker, bucket])

  useEffect(() => {
    if (gexAutoScrolled.current || !bucketData.length) return
    if (isQIWM && !priceNum) return  // wait until QQQ/IWM levels load price
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = gexScrollRef.current, r = gexPriceRowRef.current
      if (c && r) {
        c.scrollTop = r.offsetTop - c.clientHeight / 2 + r.clientHeight / 2
        gexAutoScrolled.current = true
      }
    }))
  }, [bucketData.length, bucket, gexTicker, priceNum, isQIWM])

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
            <div className="kl-label"><Tooltip tip="Current gamma regime. Positive = dealers long gamma, they sell rallies and buy dips (price-stabilizing). Negative = dealers short gamma, they chase moves in the same direction (price-amplifying).">Regime</Tooltip></div>
            <div className="kl-val" style={{ fontSize: 9, color: regimeColor(regime) }}>{regime}</div>
          </div>
        )}
        {flip && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="The strike where net GEX crosses zero. Above this = positive gamma regime (stabilizing). Below = negative (amplifying). Crossing the flip zone is a high-volatility inflection point.">Gamma Flip</Tooltip></div>
            <div className="kl-val flip">{fmtNum(flip)}</div>
          </div>
        )}
        {maxPain != null && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Strike where the most open options expire worthless. Market makers benefit from price expiring here. Strongest gravitational pull in the final hour of expiration sessions.">Max Pain</Tooltip></div>
            <div className="kl-val" style={{ color: 'var(--yellow)' }}>{fmtNum(maxPain)}{maxPainDte != null ? ` (${String(maxPainDte).toUpperCase()})` : ''}</div>
          </div>
        )}
        {cWall && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Strike with the largest call GEX concentration. Acts as overhead resistance — dealers must sell underlying aggressively here to stay hedged, capping upside moves.">Call Wall</Tooltip></div>
            <div className="kl-val call">{fmtNum(cWall)}</div>
          </div>
        )}
        {pWall && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Strike with the largest put GEX concentration. Acts as downside support — dealers must buy underlying here to stay hedged, cushioning selloffs.">Put Wall</Tooltip></div>
            <div className="kl-val put">{fmtNum(pWall)}</div>
          </div>
        )}
        {netDelta && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Net directional delta exposure of all dealers combined. LONG = dealers are net buyers of the underlying (supportive). SHORT = net sellers (headwind for price).">Net Delta</Tooltip></div>
            <div className="kl-val" style={{ fontSize: 9, color: netDelta === 'LONG' ? 'var(--green)' : netDelta === 'SHORT' ? 'var(--red)' : 'var(--muted2)' }}>{netDelta}</div>
          </div>
        )}
        {flowBias && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Net options premium flow direction. CALL HEAVY = more call premium being bought (bullish lean). PUT HEAVY = more put premium (bearish/hedging). BALANCED = no clear institutional lean.">Flow</Tooltip></div>
            <div className="kl-val" style={{ fontSize: 9, color: String(flowBias).includes('CALL') ? 'var(--green)' : String(flowBias).includes('PUT') ? 'var(--red)' : 'var(--muted2)' }}>{flowBias}</div>
          </div>
        )}
        {pcRatio && (
          <div className="kl-item">
            <div className="kl-label"><Tooltip tip="Put/Call ratio. Above 1.0 = more put buying than calls (bearish lean or heavy hedging). Below 0.8 = call-heavy (risk-on). Extreme readings (>1.5 or <0.6) often mark near-term reversals.">P/C Ratio</Tooltip></div>
            <div className="kl-val" style={{ fontSize: 11, color: parseFloat(pcRatio) > 1.1 ? 'var(--red)' : parseFloat(pcRatio) < 0.8 ? 'var(--green)' : 'var(--yellow)' }}>{parseFloat(pcRatio).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* ── Dealer Read ── */}
      <div className="panel">
        <div className="panel-title"><Tooltip tip="AI-generated summary of current dealer positioning based on GEX data. Explains what dealers are likely doing and how their hedging activity affects price movement right now." label="Dealer Read">Dealer Read</Tooltip></div>
        <button className="ai-read-btn" onClick={loadDealer} disabled={loadingDealer}>
          {loadingDealer ? '⚡ LOADING...' : dealerText ? '↻ REFRESH DEALER READ' : '⚡ GET DEALER READ FROM CLAUDE'}
        </button>
        {dealerText && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>{dealerText}</div>
        )}
      </div>

      {/* ── GEX Ladder ── */}
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip tip="Net dealer gamma at each strike. Green bars = call GEX (dealers long gamma here, stabilizing). Red bars = put GEX (dealers short gamma here, amplifying). Largest bars = biggest hedging flows when price approaches that strike." label="Gamma by Strike">Gamma Exposure by Strike</Tooltip>
            <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>LIVE</span>
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Ticker selector */}
            {(['spx','ndx','qqq','iwm'] as const).map(t => (
              <span key={t} onClick={() => setGexTicker(t)}
                style={{ fontSize: 8, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 10, cursor: 'pointer', border: '1px solid', userSelect: 'none',
                  borderColor: gexTicker === t ? 'var(--yellow)' : 'var(--border)',
                  background:  gexTicker === t ? 'rgba(250,204,21,0.12)' : 'transparent',
                  color:       gexTicker === t ? 'var(--yellow)' : 'var(--muted2)',
                  fontWeight:  gexTicker === t ? 700 : 400,
                }}>{t.toUpperCase()}</span>
            ))}
            {/* Expiry bucket pills — not available for QQQ/IWM */}
            {!isQIWM && BUCKETS.map(b => (
              <span key={b} className={`expiry-btn${bucket === b ? ' active' : ''}`} onClick={() => setBucket(b)}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 8, fontWeight: 700, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--red)' }}>PUT GEX ▶</span>
          <span style={{ color: 'var(--muted2)' }}>then</span>
          <span style={{ color: 'var(--green)' }}>CALL GEX ▶</span>
        </div>
        <div ref={gexScrollRef} style={{ position: 'relative', maxHeight: '60vh', overflowY: 'auto' }}>
          {bucket !== 'all' && bucketData.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
              {bucket === '0dte'
                ? '0DTE opens at market open'
                : `No ${bucket} data available`}
            </div>
          ) : (
            <>
              <GEXHBars rows={bucketData} priceStrike={priceNum} flipStrike={flipNum} hotScores={hotScores} priceRowRef={gexPriceRowRef} />
              <LadderPriceLine rows={bucketData} price={priceNum} />
            </>
          )}
        </div>
        {gexStrikes.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Loading…</div>}
      </div>

      {/* ── Flow Pressure ── */}
      <div className="panel">
        <div className="panel-title">
          <Tooltip tip="Ratio of total call GEX to total put GEX across all strikes. Shows whether dealers are more exposed to upside moves (calls) or downside moves (puts). High call % = dealers are net long upside gamma (stabilizing on up moves). High put % = net long downside gamma (stabilizing on dips)." label="Flow Pressure">Flow Pressure</Tooltip>
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
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}><Tooltip tip="The aggregate net delta position of all market makers combined. Positive = dealers are net long the underlying (supporting price). Negative = net short (acting as a headwind). Dealers constantly hedge to stay delta-neutral, so this tells you the direction of their ongoing buy/sell pressure.">Net Dealer Delta</Tooltip></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: Number(netDeltaDisplay) > 0 ? 'var(--green)' : Number(netDeltaDisplay) < 0 ? 'var(--red)' : 'var(--muted2)' }}>{fmtNum(netDeltaDisplay)}</span>
          </div>
        )}
        {gammaPerPct != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)' }}><Tooltip tip="Dollar value of gamma exposure that dealers must hedge per 1% move in SPX. Large positive = dealers need to sell a lot if price rises 1% (cap on upside). Large negative = they need to buy a lot if price falls 1% (accelerates the drop). Key for understanding how violent a move can get.">Dealer Gamma / 1% Move</Tooltip></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: Number(gammaPerPct) > 0 ? 'var(--green)' : Number(gammaPerPct) < 0 ? 'var(--red)' : 'var(--muted2)' }}>{fmtNum(gammaPerPct)}</span>
          </div>
        )}
      </div>

      {/* ── Delta Hedging ── */}
      <div className="panel">
        <div className="panel-title">
          <Tooltip tip="How dealers must hedge their options positions using the underlying (buying or selling futures/shares). When dealers are long gamma, they sell into rallies and buy dips (stabilizing). When short gamma, they chase moves (amplifying)." label="Delta Hedging">Delta Hedging Flow</Tooltip>
          {dhPressure && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: String(dhPressure).toUpperCase().includes('BULL') ? 'var(--green)' : String(dhPressure).toUpperCase().includes('BEAR') ? 'var(--red)' : 'var(--muted2)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border2)' }}>
              {dhPressure}
            </span>
          )}
        </div>
        <div className="stat-grid">
          {netDelta    && <div className="stat"><div className="stat-label"><Tooltip tip="Net direction dealers must hedge. LONG = dealers are net buyers of the underlying (supportive). SHORT = net sellers (headwind). Switches when gamma regime crosses neutral.">Net Delta</Tooltip></div><div className="stat-val" style={{ fontSize: 10, color: netDelta === 'LONG' ? 'var(--green)' : 'var(--red)' }}>{netDelta}</div></div>}
          {charm       && <div className="stat"><div className="stat-label"><Tooltip tip="Charm is delta decay over time. As options expire, dealers must buy or sell the underlying to stay hedged. BUYING = time decay forcing dealer purchases (supportive). SELLING = decay forcing selling.">Charm Flow</Tooltip></div><div className="stat-val" style={{ fontSize: 10, color: String(charm).toUpperCase() === 'BUYING' ? 'var(--green)' : String(charm).toUpperCase() === 'SELLING' ? 'var(--red)' : 'var(--muted2)' }}>{charm}</div></div>}
          {vanna       && <div className="stat"><div className="stat-label"><Tooltip tip="Sensitivity of dealer delta to VIX changes. When VIX drops, dealers must sell the underlying to stay hedged (amplifying the move). AMPLIFIED = vol move creates outsized price response.">Vanna</Tooltip></div><div className="stat-val" style={{ fontSize: 10, color: String(vanna).toUpperCase() === 'AMPLIFIED' ? 'var(--red)' : String(vanna).toUpperCase() === 'ELEVATED' ? 'var(--yellow)' : 'var(--muted2)' }}>{vanna}</div></div>}
          {maxPain != null && <div className="stat"><div className="stat-label"><Tooltip tip="Strike where the most options (by dollar value) expire worthless. Near expiry, market makers benefit from keeping price here. Strongest pull in the final hour of expiration day.">Max Pain</Tooltip></div><div className="stat-val" style={{ fontSize: 10, color: 'var(--yellow)' }}>{fmtNum(maxPain)}</div></div>}
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
              <Tooltip tip="How strongly the largest same-day GEX strike is pulling price. HIGH = price is within 5 points of a major 0DTE gamma strike (strong magnet effect). MODERATE = within 15 points. LOW = no strong nearby magnet. Strongest effect in the last 2 hours of the session." label="0DTE Pin Risk">0DTE Pin Risk</Tooltip>
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

      {/* ── Gamma Gravity Field ── */}
      {(bucketData.length > 0 && priceNum > 0) && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <GammaGravityCanvas strikes={bucketData} priceNum={priceNum} />
        </div>
      )}

      {/* ── GEX Terrain Map ── */}
      <GEXTerrainMap
        strikes={bucketData}
        priceNum={priceNum}
        flipNum={flipNum}
        callWall={cWall ? parseFloat(String(cWall).replace(/,/g, '')) : undefined}
        putWall={pWall  ? parseFloat(String(pWall).replace(/,/g, ''))  : undefined}
      />

      {/* ── Top Gamma Strikes ── */}
      {topGamma.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Strikes with the highest absolute gamma exposure. These act as gravitational levels — price is naturally attracted to them as dealers hedge. Largest bar = strongest magnet. Green = net call GEX (support). Red = net put GEX (resistance)." label="Top Gamma Strikes">Top Gamma Strikes</Tooltip></div>
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

      {/* ── GEX by Expiry ── */}
      {gexByExpiry.length > 0 && (() => {
        const netOf = (r: any) => r.net_gex ?? r.gamma ?? (parseFloat(r.call_gex || 0) + parseFloat(r.put_gex || 0))
        const maxAbs = Math.max(...gexByExpiry.map((r: any) => Math.abs(netOf(r))), 1)
        return (
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tooltip tip="Dealer gamma exposure broken down by expiration date. Shows which expiry is carrying the most dealer hedging pressure. 0DTE = today's expiry — gamma here is extremely concentrated and forces rapid dealer hedging. Weekly/monthly expirations carry sustained positioning." label="GEX by Expiry">GEX by Expiry</Tooltip>
              <span style={{ fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 3, padding: '1px 5px' }}>UW</span>
            </div>
            <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 8 }}>Net dealer gamma per expiry date. Largest bars = most hedging activity concentrated here.</div>
            {gexByExpiry.slice(0, 10).map((r: any, i: number) => {
              const net  = netOf(r)
              const isPos = net >= 0
              const pct  = Math.min(95, Math.abs(net) / maxAbs * 90) + 5
              const exp  = r.expiry ?? r.expiration_date ?? r.date ?? ''
              const today = new Date().toISOString().slice(0, 10)
              const is0dte = exp === today
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, minWidth: 72, color: is0dte ? 'var(--yellow)' : 'var(--muted2)' }}>
                    {exp}{is0dte ? ' 0DTE' : ''}
                  </span>
                  <div style={{ flex: 1, height: 7, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isPos ? 'var(--green)' : 'var(--red)', borderRadius: 3, opacity: 0.85 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)', minWidth: 48, textAlign: 'right' }}>
                    {fmtNum(net)}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Intraday GEX 1-Min — SPX only (no NDX equivalent) ── */}
      {!isNdx && (data?.spot_exposures?.length > 0) && (
        <GexSparkline rows={data.spot_exposures} />
      )}

      {/* ── Dealer Positioning Score ── */}
      {score != null && (
        <div className="panel">
          <div className="panel-title"><Tooltip tip="Composite score 0–100 measuring the overall bullishness of dealer gamma positioning. Above 65 = dealers positioned bullishly (supportive for longs). Below 35 = bearishly positioned (tailwind for shorts). 50 = neutral/transitioning." label="Dealer Positioning Score">Dealer Positioning Score</Tooltip></div>
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
              {scFactors.map((f, i) => {
                const factorTips: Record<string, string> = {
                  Gamma:  'Whether dealers are in positive or negative gamma. Positive = dealers stabilize price (easier to hold trades). Negative = dealers amplify moves (higher volatility, wider stops needed).',
                  Delta:  'Net delta hedging direction from all dealers. BUYING = dealers need to buy the underlying (tailwind for longs). SELLING = need to sell (headwind). Dollar value shows magnitude.',
                  Flip:   'Distance from the GEX flip zone. Above = positive gamma environment (dealers stabilize). Below = negative gamma (dealers amplify moves — good for momentum trades). AT FLIP = transition zone, regime is uncertain. Shown for context, does not adjust the score.',
                  Flow:   'Current options premium flow bias. CALL HEAVY = institutions buying calls (bullish lean). PUT HEAVY = buying puts (bearish or hedging). BALANCED = no strong conviction.',
                  Charm:  'Delta decay effect — as options lose time value, dealers must rebalance. BUYING = time decay forces dealer purchases (supportive). SELLING = forced selling as options expire.',
                  Vanna:  'Sensitivity of dealer delta to VIX changes. AMPLIFIED = a VIX move causes large forced hedging (watch for vol-driven price spikes). MUTED = vol changes have little impact.',
                }
                return (
                  <div key={i} className="sc-factor">
                    <div className="sc-factor-label"><Tooltip tip={factorTips[f.label] ?? f.label}>{f.label}</Tooltip></div>
                    <div className={`sc-factor-val ${f.cls}`}>{f.val}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
