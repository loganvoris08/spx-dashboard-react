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

export default function Layout({ activeTab, setTab, data, children }: Props) {
  const { side, setSide } = useSide()
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const spxRaw  = data?.spx
  const spx     = typeof spxRaw === 'number' ? spxRaw : (spxRaw?.price ?? data?.daily_open ?? '--')
  const ndx     = data?.ndx?.price ?? '--'
  const signal  = data?.trade_signal ?? data?.signal ?? 'WAIT'
  const sigColor = signalColor(signal)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <header style={{
        height: 'var(--topbar-h)', flexShrink: 0,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
      }}>
        {/* Logo */}
        <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', color: 'var(--text)', flexShrink: 0 }}>
          SPX<span style={{ color: 'var(--green)' }}>/</span>NDX
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />

        {/* Prices */}
        <div style={{ display: 'flex', gap: 20, flex: 1 }}>
          <PriceChip label="SPX" value={spx} active={side === 'spx'} onClick={() => setSide('spx')} />
          <PriceChip label="NDX" value={ndx} active={side === 'ndx'} onClick={() => setSide('ndx')} />
        </div>

        {/* Signal pill */}
        <div style={{
          padding: '4px 10px', borderRadius: 6,
          background: sigColor + '18', border: `1px solid ${sigColor}44`,
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
          color: sigColor, letterSpacing: '0.06em', flexShrink: 0,
        }}>
          {signal}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Sidebar (desktop) ── */}
        <nav style={{
          width: 'var(--sidebar-w)', flexShrink: 0,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 0', gap: 2,
        }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id
            const hovered = hoveredTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                title={tab.label}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--green-bg)' : hovered ? 'var(--surface2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, opacity: active ? 1 : 0.45,
                  transition: 'all 0.15s ease',
                  outline: active ? '1px solid rgba(0,230,118,0.25)' : 'none',
                }}
              >
                {tab.icon}
              </button>
            )
          })}
        </nav>

        {/* ── Main content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {children}
        </main>
      </div>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav style={{
        display: 'none',
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '8px 0',
      }} className="mobile-tabbar">
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--green)' : 'var(--muted)', fontSize: 18,
              opacity: active ? 1 : 0.4,
            }}>
              {tab.icon}
              <span style={{ fontSize: 9, fontFamily: 'var(--sans)', fontWeight: 600, letterSpacing: '0.06em' }}>
                {tab.label.toUpperCase()}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function PriceChip({ label, value, active, onClick }: { label: string; value: any; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: active ? 'var(--green)' : 'var(--muted)',
        fontFamily: 'var(--sans)', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600,
        color: active ? 'var(--text)' : 'var(--muted)',
      }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </button>
  )
}

function signalColor(s: string) {
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))  return 'var(--green)'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'var(--red)'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'var(--yellow)'
  return 'var(--muted)'
}
