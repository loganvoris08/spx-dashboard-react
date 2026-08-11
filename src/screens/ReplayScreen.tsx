import { useState, useEffect, useCallback, useMemo } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function fmt(v: any, d = 2) {
  if (v == null || isNaN(parseFloat(v))) return '--'
  const n = parseFloat(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtTime(ts: number) {
  const d = new Date(ts * 1000)
  let h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

function StatBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 8, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Simple SVG-based multi-line chart with replay cursor
function ReplayChart({ rows, priceBars, cursorIdx }: { rows: any[]; priceBars: any[]; cursorIdx: number }) {
  const W = 100, H = 200 // viewBox units
  const PAD = { t: 6, b: 16, l: 38, r: 6 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const allTs = useMemo(() => {
    const s = new Set<number>()
    rows.forEach(r => s.add(r.ts))
    priceBars.forEach(r => s.add(r.t ?? r.ts))
    return Array.from(s).sort((a, b) => a - b)
  }, [rows, priceBars])

  const combined = useMemo(() => {
    const priceMap = new Map<number, number>()
    priceBars.forEach(b => priceMap.set(b.t ?? b.ts, b.c ?? b.close ?? b.value ?? 0))
    return rows.map(r => ({
      ...r,
      price_bar: priceMap.get(r.ts) ?? null,
    }))
  }, [rows, priceBars])

  if (combined.length < 2) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted2)', fontSize: 11 }}>No history data</div>

  const spxVals  = combined.map(r => r.spx).filter(Boolean)
  const flipVals = combined.map(r => r.flip).filter(Boolean)
  const cwVals   = combined.map(r => r.call_wall).filter(Boolean)
  const pwVals   = combined.map(r => r.put_wall).filter(Boolean)
  const allVals  = [...spxVals, ...flipVals, ...cwVals, ...pwVals].filter(v => v > 0)
  if (!allVals.length) return null

  const minV = Math.min(...allVals) * 0.9995
  const maxV = Math.max(...allVals) * 1.0005
  const range = maxV - minV || 1
  const n = combined.length

  const mapX = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * iW
  const mapY = (v: number) => PAD.t + iH * (1 - (v - minV) / range)

  function polyline(vals: (number | null)[], color: string, dash?: string) {
    const pts = vals.map((v, i) => v && v > 0 ? `${mapX(i).toFixed(1)},${mapY(v).toFixed(1)}` : null)
    const segments: string[][] = []
    let cur: string[] = []
    pts.forEach(p => { if (p) cur.push(p); else if (cur.length) { segments.push(cur); cur = [] } })
    if (cur.length) segments.push(cur)
    return segments.map((seg, si) => (
      <polyline key={si} points={seg.join(' ')} fill="none" stroke={color} strokeWidth="0.6"
        strokeDasharray={dash} opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
    ))
  }

  const curX = mapX(Math.max(0, Math.min(cursorIdx, n - 1)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }} preserveAspectRatio="none">
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={PAD.l} y1={PAD.t + iH * f} x2={W - PAD.r} y2={PAD.t + iH * f}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      ))}
      {/* y-axis labels */}
      {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
        <text key={i} x={PAD.l - 1} y={mapY(v) + 1.5} textAnchor="end" fontSize="3.5" fill="#4b5563" fontFamily="monospace">
          {v.toFixed(0)}
        </text>
      ))}
      {/* series */}
      {polyline(combined.map(r => r.spx), '#facc15')}
      {polyline(combined.map(r => r.flip > 0 ? r.flip : null), '#a78bfa', '1,1')}
      {polyline(combined.map(r => r.call_wall > 0 ? r.call_wall : null), '#34d399', '1.5,1.5')}
      {polyline(combined.map(r => r.put_wall > 0 ? r.put_wall : null), '#f87171', '1.5,1.5')}
      {/* cursor */}
      <line x1={curX} y1={PAD.t} x2={curX} y2={PAD.t + iH} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
      {combined[cursorIdx]?.spx > 0 && (
        <circle cx={curX} cy={mapY(combined[cursorIdx].spx)} r="1.2" fill="#facc15" />
      )}
      {/* time axis */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const idx = Math.round(f * (n - 1))
        return combined[idx] ? (
          <text key={f} x={mapX(idx)} y={H - 1} textAnchor="middle" fontSize="3" fill="#4b5563" fontFamily="monospace">
            {fmtTime(combined[idx].ts).replace(' ', '')}
          </text>
        ) : null
      })}
      {/* legend */}
      {[['SPX', '#facc15'], ['Flip', '#a78bfa'], ['CW', '#34d399'], ['PW', '#f87171']].map(([l, c], i) => (
        <g key={l} transform={`translate(${PAD.l + i * 14}, ${PAD.t - 1})`}>
          <line x1={0} y1={0} x2={5} y2={0} stroke={c as string} strokeWidth="0.7" />
          <text x={6} y={1} fontSize="2.8" fill={c as string} fontFamily="monospace">{l}</text>
        </g>
      ))}
    </svg>
  )
}

export default function ReplayScreen() {
  const [rows, setRows]       = useState<any[]>([])
  const [priceBars, setPriceBars] = useState<any[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/api/levels-history')
      const r = d.history ?? []
      setRows(r)
      setPriceBars(d.price_bars ?? [])
      if (r.length) setCursorIdx(r.length - 1)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const snap = rows[cursorIdx]
  const prev = cursorIdx > 0 ? rows[cursorIdx - 1] : null

  const spxChg = snap && prev ? snap.spx - prev.spx : null
  const flipColor = snap?.spx > 0 && snap?.flip > 0
    ? (snap.spx >= snap.flip ? 'var(--green)' : 'var(--red)') : 'var(--muted2)'

  return (
    <>
      <div className="panel">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Intraday Replay</span>
          <button onClick={load} style={{ fontSize: 9, fontFamily: 'var(--mono)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>REFRESH</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8 }}>
          Scrub through today's SPX price, flip zone, call wall, and put wall history.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', padding: 24, fontSize: 11 }}>Loading history…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', padding: 24, fontSize: 11 }}>No history yet — data builds during market hours.</div>
        ) : (
          <>
            <ReplayChart rows={rows} priceBars={priceBars} cursorIdx={cursorIdx} />

            {/* scrubber */}
            <div style={{ padding: '8px 0 4px' }}>
              <input type="range" min={0} max={rows.length - 1} value={cursorIdx}
                onChange={e => setCursorIdx(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#facc15' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
                {rows[0] && <span>{fmtTime(rows[0].ts)}</span>}
                {snap && <span style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtTime(snap.ts)}</span>}
                {rows[rows.length - 1] && <span>{fmtTime(rows[rows.length - 1].ts)}</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* snapshot stats */}
      {snap && (
        <div className="panel">
          <div className="panel-title">{fmtTime(snap.ts)} Snapshot</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
            <StatBox label="SPX" value={fmt(snap.spx)}
              color="var(--yellow)"
              sub={spxChg != null ? (spxChg >= 0 ? '+' : '') + spxChg.toFixed(2) + ' from prev' : undefined} />
            <StatBox label="GEX Flip Zone" value={fmt(snap.flip)}
              color={flipColor}
              sub={snap.spx > 0 && snap.flip > 0 ? (snap.spx >= snap.flip ? 'Above flip — positive GEX' : 'Below flip — negative GEX') : undefined} />
            <StatBox label="Call Wall" value={snap.call_wall > 0 ? fmt(snap.call_wall) : '--'}
              color="var(--green)"
              sub={snap.call_wall > 0 && snap.spx > 0 ? `+${(snap.call_wall - snap.spx).toFixed(0)} pts away` : undefined} />
            <StatBox label="Put Wall" value={snap.put_wall > 0 ? fmt(snap.put_wall) : '--'}
              color="var(--red)"
              sub={snap.put_wall > 0 && snap.spx > 0 ? `${(snap.put_wall - snap.spx).toFixed(0)} pts away` : undefined} />
            <StatBox label="VIX" value={fmt(snap.vix)} color={Number(snap.vix) > 20 ? 'var(--red)' : 'var(--green)'} />
            <StatBox label="DH Pressure" value={snap.dh_pressure ?? '--'}
              color={(snap.dh_pressure || '').includes('BULL') ? 'var(--green)' : (snap.dh_pressure || '').includes('BEAR') ? 'var(--red)' : 'var(--muted2)'} />
          </div>
          {snap.flow_bias && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)' }}>
              Flow bias: <span style={{ color: (snap.flow_bias || '').includes('CALL') ? 'var(--green)' : (snap.flow_bias || '').includes('PUT') ? 'var(--red)' : 'var(--muted2)', fontWeight: 700 }}>{snap.flow_bias}</span>
            </div>
          )}
        </div>
      )}

      {/* nav hint */}
      {rows.length > 0 && (
        <div className="panel" style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--muted2)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>{rows.length}</strong> snapshots · one per refresh cycle (~30s) ·
            drag the slider or tap the chart area to step through the session
          </div>
        </div>
      )}
    </>
  )
}
