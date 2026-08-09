import { useMemo } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import { useLiveFutures } from '../lib/LiveFuturesContext'
import CandleChart from '../components/CandleChart'
import type { LevelLine } from '../components/CandleChart'
import LiveBadge from '../components/LiveBadge'

const HAS_KEY = !!(import.meta.env.VITE_MASSIVE_KEY as string ?? '').trim()

function fmtDelta(v: number) {
  const a = Math.abs(v)
  const s = v >= 0 ? '+' : '-'
  if (a >= 1000) return s + (a / 1000).toFixed(1) + 'K'
  return s + a.toFixed(0)
}

function pn(v: any) { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n }

export default function EsChartScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const { esLiveBar, esCumDelta, esSessionVol, esVwap, connected } = useLiveFutures()
  const isNdx = side === 'ndx'

  const esPrice = pn(data?.es)
  const nqPrice = pn(data?.nq)

  // Key levels for the ES chart
  const esLevels = useMemo<LevelLine[]>(() => {
    if (!data) return []
    const lines: LevelLine[] = []
    const flip  = pn(data.gex_flip_zone_raw ?? data.gex_flip_zone)
    const call  = pn(data.nearest_call_wall)
    const put   = pn(data.nearest_put_wall)
    // Prefer live tick-by-tick VWAP; fall back to session VWAP from backend
    const vwap  = esVwap ?? pn(data.spx_vwap)
    const isLiveVwap = esVwap != null
    if (flip)  lines.push({ price: flip,  color: 'rgba(168,85,247,0.85)',  label: 'Flip',      dashed: true,  width: 1 })
    if (call)  lines.push({ price: call,  color: 'rgba(0,255,136,0.75)',   label: 'Call Wall', dashed: true,  width: 1 })
    if (put)   lines.push({ price: put,   color: 'rgba(255,51,68,0.75)',   label: 'Put Wall',  dashed: true,  width: 1 })
    if (vwap)  lines.push({ price: vwap,  color: isLiveVwap ? 'rgba(64,196,255,0.9)' : 'rgba(64,196,255,0.55)', label: 'VWAP', dashed: false, width: 2 })
    return lines
  }, [data, esVwap])

  // NDX chart: use NDX-specific levels
  const ndxLevels = useMemo<LevelLine[]>(() => {
    if (!data) return []
    const nd = data.ndx ?? {}
    const lines: LevelLine[] = []
    const flip = pn(nd.gex_flip_zone_raw ?? nd.gex_flip_zone)
    const call = pn(nd.nearest_call_wall ?? nd.gex_nearest_call_wall)
    const put  = pn(nd.nearest_put_wall  ?? nd.gex_nearest_put_wall)
    if (flip) lines.push({ price: flip, color: 'rgba(168,85,247,0.85)', label: 'Flip',      dashed: true,  width: 1 })
    if (call) lines.push({ price: call, color: 'rgba(0,255,136,0.75)',  label: 'Call Wall', dashed: true,  width: 1 })
    if (put)  lines.push({ price: put,  color: 'rgba(255,51,68,0.75)',  label: 'Put Wall',  dashed: true,  width: 1 })
    return lines
  }, [data])

  if (isNdx) {
    return (
      <CandleChart
        title="NQ DAILY"
        candleEndpoint="/nq-candles"
        zonesEndpoint="/nq-zones"
        timeVisible={false}
        livePrice={nqPrice}
        levels={ndxLevels}
      />
    )
  }

  const deltaColor  = esCumDelta > 0 ? 'var(--green)' : esCumDelta < 0 ? 'var(--red)' : 'var(--muted2)'
  const deltaLabel  = esCumDelta > 0 ? 'BUYERS LEADING' : esCumDelta < 0 ? 'SELLERS LEADING' : 'BALANCED'
  const deltaBg     = esCumDelta > 0 ? 'rgba(0,255,136,0.06)' : esCumDelta < 0 ? 'rgba(255,51,68,0.06)' : 'transparent'
  const barPct      = connected && esSessionVol > 0
    ? Math.min(100, Math.abs(esCumDelta) / esSessionVol * 100 * 4)
    : 50

  return (
    <>
      <CandleChart
        title="ES DAILY"
        candleEndpoint="/es-candles"
        zonesEndpoint="/es-zones"
        timeVisible={false}
        livePrice={esPrice}
        liveBar={esLiveBar}
        levels={esLevels}
      />

      {/* ── ES Cumulative Delta ── */}
      <div className="panel" style={{ background: deltaBg, transition: 'background 0.4s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 1 }}>
              ES Cumulative Delta
            </span>
            <LiveBadge
              label={connected ? 'LIVE' : HAS_KEY ? 'NO FEED' : 'NO KEY'}
              variant={connected ? 'green' : 'dim'}
            />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: deltaColor }}>
            {connected ? deltaLabel : '--'}
          </span>
        </div>

        {/* Delta bar */}
        <div style={{ position: 'relative', height: 10, background: 'var(--surface)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
          {/* Center line */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border2)' }} />
          {connected && (
            <div style={{
              position: 'absolute',
              left:   esCumDelta >= 0 ? '50%' : `${50 - barPct / 2}%`,
              width:  `${barPct / 2}%`,
              height: '100%',
              background: deltaColor,
              borderRadius: 5,
              opacity: 0.75,
              transition: 'width 0.3s, left 0.3s',
            }} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted2)' }}>
          <span style={{ color: 'var(--red)' }}>← SELL</span>
          <span style={{ color: deltaColor, fontWeight: 700, fontSize: 12 }}>
            {connected ? fmtDelta(esCumDelta) : '--'}
          </span>
          <span style={{ color: 'var(--green)' }}>BUY →</span>
        </div>

        {connected && esSessionVol > 0 && (
          <div style={{ marginTop: 6, fontSize: 8, color: 'var(--muted2)', fontFamily: 'var(--mono)', textAlign: 'center' }}>
            Session vol: {esSessionVol >= 1000 ? (esSessionVol / 1000).toFixed(1) + 'K' : esSessionVol} contracts
          </div>
        )}
      </div>
    </>
  )
}
