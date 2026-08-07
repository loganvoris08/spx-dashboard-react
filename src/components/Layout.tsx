import { useState, type ReactNode, useRef, useEffect } from 'react'
import { useSide } from '../lib/SideContext'

const SPX_TABS = [
  { id: 'levels', label: 'Levels' },
  { id: 'oi',     label: 'OI' },
  { id: 'gex',    label: 'GEX' },
  { id: 'flow',   label: 'Flow' },
  { id: 'tide',   label: 'Tide' },
  { id: 'vol',    label: 'Vol' },
  { id: 'news',   label: 'News' },
  { id: 'spx',    label: 'SPX' },
  { id: 'es',     label: 'ES' },
  { id: 'es10m',  label: '10M' },
]

const NDX_EXTRA = [
  { id: 'ndx',   label: 'NDX' },
  { id: 'nq',    label: 'NQ' },
  { id: 'nq10m', label: 'NQ10M' },
]

const MENU_ITEMS = [
  { id: 'signal',   label: 'Signal' },
  { id: 'engine',   label: 'Engine' },
  { id: 'playbook', label: 'MM Playbook' },
  { id: 'learn',    label: 'Learn' },
  { id: 'smartmoney', label: 'Smart Money' },
]

interface Props {
  activeTab: string
  setTab: (t: string) => void
  data: any
  children: ReactNode
}

function regimeClass(r?: string) {
  if (!r) return 'gex-neut'
  const u = r.toUpperCase()
  if (u.includes('NEG')) return 'gex-neg'
  if (u.includes('POS') || u.includes('CALL') || u.includes('STRONG')) return 'gex-pos'
  return 'gex-neut'
}

function pillClass(s: string) {
  const u = s.toUpperCase()
  if (u.includes('LONG') || u.includes('BULL') || u.includes('BUY'))   return 'long'
  if (u.includes('SHORT') || u.includes('BEAR') || u.includes('SELL')) return 'short'
  if (u.includes('LEAN') || u.includes('WATCH') || u.includes('TRAP')) return 'watch'
  return 'wait'
}

function swingClass(s?: string) {
  if (!s) return 'none'
  return pillClass(s)
}

function sessionClass(s?: string) {
  if (!s) return ''
  const u = s.toLowerCase()
  if (u.includes('morning') || u.includes('open') || u.includes('rth')) return 'rth-open'
  if (u.includes('afternoon') || u.includes('pm')) return 'afternoon'
  return ''
}

function zoneClass(state?: string) {
  if (!state) return ''
  const u = state.toUpperCase()
  if (u.includes('ABOVE')) return 'above'
  if (u.includes('BELOW')) return 'below'
  return 'current'
}

function fmt2(v: any) {
  if (v == null) return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Layout({ activeTab, setTab, data, children }: Props) {
  const { side, setSide } = useSide()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const isNdx = side === 'ndx'
  const tabs = [...SPX_TABS, ...(isNdx ? NDX_EXTRA : [])]

  // Tickers
  const spxRaw  = data?.spx
  const spxNum  = typeof spxRaw === 'number' ? spxRaw : (data?.daily_open ?? null)
  const spxFmt  = spxNum != null ? fmt2(spxNum) : '--'
  const esFmt   = data?.es_price != null ? fmt2(data.es_price) : (data?.es != null ? fmt2(data.es) : '--')
  const vixFmt  = data?.vix != null ? Number(data.vix).toFixed(2) : '--'

  // Signal
  const signal   = data?.trade_signal ?? data?.signal ?? 'WAIT'
  const sc       = pillClass(signal)
  const score    = data?.score
  const maxScore = data?.max_score
  const session  = data?.session
  const swing    = data?.swing_signal?.signal ?? data?.swing_history?.[0]?.signal

  // Zone chip
  const zoneState = data?.spx_zone_state

  // Regime
  const regime = data?.uw_gamma_regime ?? data?.gamma_state ?? data?.net_gex_state
  const isLive = !!data

  function selectTab(id: string) {
    setTab(id)
    setMenuOpen(false)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-title">SPX // CMD</div>

        {/* Hamburger menu — lives in topbar so dropdown isn't clipped by tabbar overflow */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            className={`menu-btn${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
          >
            ☰
          </div>
          {menuOpen && (
            <div className="menu-dropdown">
              {MENU_ITEMS.map(m => (
                <div
                  key={m.id}
                  className={`menu-item${activeTab === m.id ? ' active' : ''}`}
                  onClick={() => selectTab(m.id)}
                >
                  {m.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ticker-strip">
          <div className="ticker">
            <div className="ticker-label">SPX</div>
            <div className="ticker-val spx">{spxFmt}</div>
          </div>
          <div className="ticker">
            <div className="ticker-label">ES</div>
            <div className="ticker-val es">{esFmt}</div>
          </div>
          <div className="ticker">
            <div className="ticker-label">VIX</div>
            <div className="ticker-val vix">{vixFmt}</div>
          </div>
        </div>

        {regime && (
          <div className={`topbar-regime ${regimeClass(regime)}`}>{regime.toUpperCase()}</div>
        )}

        <div className="side-toggle">
          <button className={`side-btn${side === 'spx' ? ' active' : ''}`} onClick={() => setSide('spx')}>SPX</button>
          <button className={`side-btn${side === 'ndx' ? ' active' : ''}`} onClick={() => setSide('ndx')}>NDX</button>
        </div>

        <div className="status-bar">
          <div className={`dot${isLive ? '' : ' stale'}`} />
          <span>{isLive ? 'LIVE' : 'LOADING'}</span>
        </div>
      </div>

      {/* ── Mobile side row ── */}
      <div className="mobile-side-row">
        <button className={`side-btn${side === 'spx' ? ' active' : ''}`} onClick={() => setSide('spx')}>SPX</button>
        <button className={`side-btn${side === 'ndx' ? ' active' : ''}`} onClick={() => setSide('ndx')}>NDX</button>
      </div>

      {/* ── Signal banner ── */}
      <div className="signal-banner">
        <span className={`sb-pill ${sc}`}>{signal}</span>

        {zoneState && (
          <span className={`zn-chip ${zoneClass(zoneState)}`}>{zoneState}</span>
        )}

        {score != null && maxScore != null && signal !== 'WAIT' && (
          <>
            <span className="sb-score-text">{score}/{maxScore}</span>
            <div className="sb-bar-track">
              <div className="sb-bar-fill" style={{ width: `${Math.round((score / maxScore) * 100)}%` }} />
            </div>
          </>
        )}

        {swing && !swing.includes('NO ') && (
          <span className={`sb-swing ${swingClass(swing)}`}>{swing}</span>
        )}

        <span style={{ flex: 1 }} />

        {session && (
          <span className={`sb-session ${sessionClass(session)}`}>{session.toUpperCase()}</span>
        )}
      </div>

      {/* ── Tabbar ── */}
      <div className="tabbar">
        {tabs.map(t => (
          <div key={t.id} className={`tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="tab-content">
        {children}
      </div>
    </div>
  )
}
