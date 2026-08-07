import { type ReactNode, useState } from 'react'
import { useSide } from '../lib/SideContext'

const TABS = [
  { id: 'signal', label: 'Signal',  icon: '📡' },
  { id: 'levels', label: 'Levels',  icon: '📍' },
  { id: 'gex',    label: 'GEX',     icon: '⚡' },
  { id: 'oi',     label: 'OI',      icon: '📊' },
  { id: 'flow',   label: 'Flow',    icon: '🌊' },
  { id: 'ai',     label: 'AI',      icon: '🧠' },
]

interface Props {
  activeTab: string
  setTab: (t: string) => void
  data: any
  children: ReactNode
}

function regimeClass(r?: string) {
  if (!r) return 'regime-neut'
  const u = r.toUpperCase()
  if (u.includes('NEG')) return 'regime-neg'
  if (u.includes('POS') || u.includes('CALL') || u.includes('STRONG')) return 'regime-pos'
  return 'regime-neut'
}

function signalClass(s: string) {
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))  return 'sig-long'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'sig-short'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'sig-watch'
  return 'sig-wait'
}

export default function Layout({ activeTab, setTab, data, children }: Props) {
  const { side, setSide } = useSide()
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const spxRaw = data?.spx
  const spxVal = typeof spxRaw === 'number' ? spxRaw : (spxRaw?.price ?? data?.daily_open ?? null)
  const ndxVal = data?.ndx?.price ?? '--'

  const spxFmt = spxVal != null ? Number(spxVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
  const ndxFmt = typeof ndxVal === 'string' ? ndxVal : ndxVal?.toLocaleString?.() ?? '--'

  const signal  = data?.trade_signal ?? data?.signal ?? 'WAIT'
  const regime  = data?.uw_gamma_regime ?? data?.gamma_state ?? data?.net_gex_state
  const isLive  = !!data

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <header style={{
        height: 'var(--topbar-h)', flexShrink: 0,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      }}>
        {/* Logo */}
        <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', color: 'var(--green)', flexShrink: 0 }}>
          SPX//CMD
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--border2)', flexShrink: 0 }} />

        {/* Price chips */}
        <div style={{ display: 'flex', gap: 14, flex: 1 }}>
          <PriceTicker label="SPX" value={spxFmt} active={side === 'spx'} onClick={() => setSide('spx')} />
          <PriceTicker label="NDX" value={ndxFmt} active={side === 'ndx'} onClick={() => setSide('ndx')} />
        </div>

        {/* Regime badge */}
        {regime && (
          <div className={`regime-badge ${regimeClass(regime)}`} style={{ flexShrink: 0 }}>
            {regime.toUpperCase()}
          </div>
        )}

        {/* Signal pill */}
        <div className={`sig-pill ${signalClass(signal)}`} style={{ flexShrink: 0 }}>
          {signal}
        </div>

        {/* Live dot */}
        <div className={`live-dot${isLive ? '' : ' stale'}`} />
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Sidebar (desktop) ── */}
        <nav className="desktop-sidebar" style={{
          width: 'var(--sidebar-w)', flexShrink: 0,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '6px 0', gap: 1,
        }}>
          {TABS.map(tab => {
            const active  = activeTab === tab.id
            const hovered = hoveredTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                title={tab.label}
                style={{
                  width: 38, height: 38, borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(0,255,136,0.08)' : hovered ? 'var(--surface2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, opacity: active ? 1 : hovered ? 0.6 : 0.35,
                  transition: 'all 0.12s ease',
                  outline: active ? '1px solid rgba(0,255,136,0.2)' : 'none',
                }}
              >
                {tab.icon}
              </button>
            )
          })}
        </nav>

        {/* ── Main content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '12px', background: 'var(--bg)' }}>
          {children}
        </main>
      </div>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav style={{
        display: 'none',
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '6px 0', flexShrink: 0,
      }} className="mobile-tabbar">
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--green)' : 'var(--muted)', fontSize: 16,
              opacity: active ? 1 : 0.4, padding: '2px 0',
            }}>
              {tab.icon}
              <span style={{ fontSize: 8, fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function PriceTicker({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
    }}>
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: active ? 'var(--green)' : 'var(--muted)',
        fontFamily: 'var(--sans)',
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, lineHeight: 1,
        color: active ? 'var(--price)' : 'var(--muted)',
        transition: 'color 0.3s',
      }}>{value}</span>
    </button>
  )
}
