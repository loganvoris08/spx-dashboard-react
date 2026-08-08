import { useDashboard } from '../hooks/useDashboard'
import { useSide } from '../lib/SideContext'
import { useLiveFutures } from '../lib/LiveFuturesContext'
import CandleChart from '../components/CandleChart'
import LiveBadge from '../components/LiveBadge'

const HAS_KEY = !!(import.meta.env.VITE_MASSIVE_KEY as string ?? '').trim()

function fmtDelta(v: number) {
  const a = Math.abs(v)
  const s = v >= 0 ? '+' : '-'
  if (a >= 1000) return s + (a / 1000).toFixed(1) + 'K'
  return s + a.toFixed(0)
}

export default function EsChartScreen() {
  const { data } = useDashboard()
  const { side } = useSide()
  const { esLiveBar, esCumDelta, esSessionVol, connected } = useLiveFutures()
  const isNdx = side === 'ndx'

  const esPrice = data?.es != null ? parseFloat(String(data.es).replace(/,/g, '')) : null
  const nqPrice = data?.nq != null ? parseFloat(String(data.nq).replace(/,/g, '')) : null

  if (isNdx) {
    return (
      <CandleChart
        title="NQ DAILY"
        candleEndpoint="/nq-candles"
        zonesEndpoint="/nq-zones"
        timeVisible={false}
        livePrice={nqPrice}
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
