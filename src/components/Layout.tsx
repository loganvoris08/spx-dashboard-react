import { useState, type ReactNode, useRef, useEffect } from 'react'
import { useSide } from '../lib/SideContext'
import { useLivePrice } from '../lib/LivePriceContext'

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
  { id: 'signal',      label: 'Signal' },
  { id: 'engine',      label: 'Engine' },
  { id: 'playbook',    label: 'MM Playbook' },
  { id: 'learn',       label: 'Learn' },
  { id: 'smartmoney',  label: 'Smart Money' },
  { id: 'optionssetup',label: 'Options Setup' },
  { id: 'journal',     label: 'Journal' },
  { id: 'hotoptions',  label: 'Hot Options' },
  { id: 'admin',       label: 'Admin' },
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
  const live = useLivePrice()

  // Tickers — live WebSocket price takes precedence, fall back to polled data
  const spxNum  = live.spx ?? (isNdx
    ? (() => { const r = data?.ndx?.price ?? data?.ndx_price; return r != null ? parseFloat(String(r).replace(/,/g,'')) : null })()
    : (() => { const r = data?.spx; return r != null ? parseFloat(String(r).replace(/,/g,'')) : data?.daily_open ?? null })())
  const ndxNum  = live.ndx ?? (() => { const r = data?.ndx?.price ?? data?.ndx_price; return r != null ? parseFloat(String(r).replace(/,/g,'')) : null })()
  const vixNum2 = live.vix ?? (data?.vix != null ? Number(data.vix) : null)

  const displayNum = isNdx ? ndxNum : spxNum
  const spxFmt  = displayNum != null && !isNaN(displayNum) ? fmt2(displayNum) : '--'
  const esRaw   = isNdx
    ? (data?.ndx?.nq ?? data?.nq ?? data?.nq_price)
    : (data?.es_price ?? data?.es)
  const esFmt   = esRaw != null ? fmt2(parseFloat(String(esRaw).replace(/,/g, ''))) : '--'
  const vixFmt  = vixNum2 != null ? vixNum2.toFixed(2) : '--'
  const spxLabel = isNdx ? 'NDX' : 'SPX'
  const esLabel  = isNdx ? 'NQ'  : 'ES'

  // Day change — compute from prev_close if pre-computed field missing
  const pn = (v: any) => v != null ? parseFloat(String(v).replace(/,/g, '')) : null
  const spxPrev = pn(isNdx ? data?.ndx_prev_close : data?.prev_close)
  const esPrev  = pn(isNdx ? data?.nq_prev_close  : data?.es_prev_close)
  const vixPrev = pn(data?.vix_prev_close)
  const spxChg  = data?.spx_change ?? data?.day_change
    ?? (spxNum != null && spxPrev != null ? spxNum - spxPrev : null)
  const spxChgPct = data?.spx_change_pct ?? data?.day_change_pct
    ?? (spxNum != null && spxPrev != null && spxPrev !== 0 ? (spxNum - spxPrev) / spxPrev * 100 : null)
  const esRawNum = pn(esRaw)
  const esChg   = data?.es_change
    ?? (esRawNum != null && esPrev != null ? esRawNum - esPrev : null)
  const esChgPct = esRawNum != null && esPrev != null && esPrev !== 0 ? (esRawNum - esPrev) / esPrev * 100 : null
  const vixNum  = pn(data?.vix)
  const vixChg  = data?.vix_change
    ?? (vixNum != null && vixPrev != null ? vixNum - vixPrev : null)
  const vixChgPct = vixNum != null && vixPrev != null && vixPrev !== 0 ? (vixNum - vixPrev) / vixPrev * 100 : null

  function fmtChg(v: any, pct?: any) {
    if (v == null) return null
    const n = parseFloat(String(v))
    if (isNaN(n)) return null
    const sign = n >= 0 ? '+' : ''
    const pStr = pct != null ? ` (${n >= 0 ? '+' : ''}${parseFloat(String(pct)).toFixed(2)}%)` : ''
    return `${sign}${n.toFixed(2)}${pStr}`
  }

  function parseNum(v: any): number | null {
    if (v == null) return null
    const n = parseFloat(String(v).replace(/,/g, ''))
    return isNaN(n) ? null : n
  }

  // OI Strip
  const putWall  = parseNum(data?.nearest_put_wall ?? data?.put_wall)
  const callWall = parseNum(data?.nearest_call_wall ?? data?.call_wall)
  const gexFlip  = parseNum(data?.gex_flip_zone_raw ?? data?.gex_flip_zone)
  const hasOiStrip = putWall || gexFlip || callWall

  // Flip Alert — show when within 5 pts of flip zone
  const spxPrice = spxNum ?? 0
  const flipDist = gexFlip && spxPrice ? Math.abs(spxPrice - gexFlip) : null
  const showFlipAlert = flipDist != null && flipDist < 5

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
            <div className="ticker-label">{spxLabel}</div>
            <div className="ticker-val spx">{spxFmt}</div>
            {fmtChg(spxChg, spxChgPct) && (
              <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: (spxChg ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 1 }}>{fmtChg(spxChg, spxChgPct)}</div>
            )}
          </div>
          <div className="ticker">
            <div className="ticker-label">{esLabel}</div>
            <div className="ticker-val es">{esFmt}</div>
            {fmtChg(esChg, esChgPct) && (
              <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: (esChg ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 1 }}>{fmtChg(esChg, esChgPct)}</div>
            )}
          </div>
          <div className="ticker">
            <div className="ticker-label">VIX</div>
            <div className="ticker-val vix">{vixFmt}</div>
            {fmtChg(vixChg, vixChgPct) && (
              <div style={{ fontSize: 8, fontFamily: 'var(--mono)', color: (vixChg ?? 0) >= 0 ? 'var(--red)' : 'var(--green)', marginTop: 1 }}>{fmtChg(vixChg, vixChgPct)}</div>
            )}
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

      {/* ── Flip Alert ── */}
      {showFlipAlert && (
        <div className="flip-alert">⚡ AT GAMMA FLIP — {flipDist != null ? flipDist.toFixed(1) : '--'} pts away</div>
      )}

      {/* ── OI Strip ── */}
      {hasOiStrip && (
        <div className="oi-strip">
          <div className="oi-strip-main">
            {putWall && (
              <div className="oi-strip-level put">
                <div className="oi-strip-label">Put Wall</div>
                <div className="oi-strip-val">{fmt2(putWall)}</div>
                {spxPrice > 0 && <div className="oi-strip-dist">{(putWall - spxPrice > 0 ? '+' : '')}{(putWall - spxPrice).toFixed(0)} pts</div>}
              </div>
            )}
            {putWall && callWall && (
              <div className="oi-strip-bar-wrap">
                <div className="oi-strip-track">
                  {(() => {
                    const range = callWall - putWall
                    const flip = gexFlip ?? (putWall + range / 2)
                    const putFill = range > 0 ? ((flip - putWall) / range * 100) : 50
                    const cursorPct = range > 0 ? ((spxPrice - putWall) / range * 100) : 50
                    return <>
                      <div className="oi-strip-fill-put" style={{ width: `${putFill}%` }} />
                      <div className="oi-strip-fill-call" style={{ width: `${100 - putFill}%` }} />
                      <div className="oi-strip-cursor" style={{ left: `${Math.max(0, Math.min(100, cursorPct))}%` }} />
                    </>
                  })()}
                </div>
                <div className="oi-strip-price">{fmt2(spxPrice)}</div>
              </div>
            )}
            {gexFlip && (
              <div className="oi-strip-level flip">
                <div className="oi-strip-label">GEX Flip</div>
                <div className="oi-strip-val">{fmt2(gexFlip)}</div>
                {spxPrice > 0 && <div className="oi-strip-dist">{(gexFlip - spxPrice > 0 ? '+' : '')}{(gexFlip - spxPrice).toFixed(0)} pts</div>}
              </div>
            )}
            {callWall && (
              <div className="oi-strip-level call">
                <div className="oi-strip-label">Call Wall</div>
                <div className="oi-strip-val">{fmt2(callWall)}</div>
                {spxPrice > 0 && <div className="oi-strip-dist">{(callWall - spxPrice > 0 ? '+' : '')}{(callWall - spxPrice).toFixed(0)} pts</div>}
              </div>
            )}
          </div>
        </div>
      )}

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
