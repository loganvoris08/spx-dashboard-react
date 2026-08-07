import { useDashboard } from '../hooks/useDashboard'

function fmtN(v: any, d = 2) {
  if (v == null || v === '' || v === '--') return '--'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function MonitorCard({ title, val, sub, desc }: { title: string; val: string; sub?: string; desc?: string }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', marginBottom: 4 }}>{val}</div>
      {sub  && <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>{sub}</div>}
      {desc && <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>{desc}</div>}
    </div>
  )
}

function EdPanel({ title, body, tip }: { title: string; body: string; tip: string }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 10 }}>
      <h4 style={{ fontSize: 13, color: 'var(--green)', margin: '0 0 8px 0' }}>{title}</h4>
      <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 8px 0' }}>{body}</p>
      <div style={{ fontSize: 11, color: 'var(--yellow)', borderLeft: '2px solid var(--yellow)', paddingLeft: 10, marginTop: 8, lineHeight: 1.5 }}>▸ {tip}</div>
    </div>
  )
}

function widthClass(pct?: number) {
  if (!pct) return 'var(--muted2)'
  if (pct < 5)  return '#22c55e'
  if (pct < 10) return '#eab308'
  if (pct < 20) return '#f97316'
  return '#ef4444'
}

export default function MMPlaybookScreen() {
  const { data } = useDashboard()

  const mmData      = data?.mm_data ?? {}
  const spreadWidth = mmData.spread_width ?? data?.mm_spread_width
  const spreadPct   = mmData.spread_pct   ?? data?.mm_spread_pct
  const spreadReg   = mmData.spread_regime ?? data?.mm_spread_regime
  const spreadDesc  = mmData.spread_desc  ?? data?.mm_spread_desc
  const spreadTrend = mmData.spread_trend ?? data?.mm_spread_trend
  const trendDesc   = mmData.spread_trend_desc ?? data?.mm_trend_desc
  const dhPressure  = mmData.dealer_delta_lean ?? data?.dealer_delta_lean ?? data?.dh_pressure
  const dhDelta     = mmData.dh_delta    ?? data?.dh_delta
  const dhDesc      = mmData.dh_desc     ?? data?.mm_dh_desc
  const gammaReg    = data?.uw_gamma_regime ?? data?.gamma_state
  const gexFlip     = data?.gex_flip_zone_raw ?? data?.gex_flip_zone

  const ladder: any[] = data?.mm_spread_ladder ?? data?.spread_ladder ?? []

  const signal = data?.trade_signal ?? data?.signal
  const entry  = data?.entry
  const target = data?.target
  const spreadCalcData = data?.mm_spread_calc ?? null

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Section A: Live Monitor */}
      <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 0 0' }}>Live MM Spread Monitor</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <MonitorCard
          title="NTM Spread Width"
          val={spreadWidth != null ? String(spreadWidth) : '--'}
          sub={`${spreadPct != null ? Number(spreadPct).toFixed(1) : '--'}% avg · ${spreadReg ?? '--'}`}
          desc={spreadDesc ?? 'Waiting for options data...'}
        />
        <MonitorCard
          title="Spread Trend"
          val={spreadTrend ?? '--'}
          desc={trendDesc ?? 'Waiting for options data...'}
        />
        <MonitorCard
          title="Dealer Delta Lean"
          val={dhPressure ?? '--'}
          sub={dhDelta != null ? `Net ${String(dhDelta)}` : 'Net -- $--M'}
          desc={dhDesc ?? 'Waiting for data...'}
        />
        <MonitorCard
          title="Gamma Regime + Flip"
          val={gammaReg ?? '--'}
          sub={`Flip: ${gexFlip != null ? fmtN(gexFlip, 0) : '--'}`}
          desc={gammaReg ? `Market in ${gammaReg} environment — see Gamma Scalping below for what that means.` : 'Waiting for data...'}
        />
      </div>

      {/* Section B: Live Spread Ladder */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Live Spread Ladder</div>
        <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8, fontStyle: 'italic' }}>
          Wide spreads = MMs uncertain at that strike. MM Lean = which direction dealers are inventory-hedging.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Strike', 'Type', 'Bid', 'Ask', 'Width', 'Spread%', 'MM Lean'].map(h => (
                  <th key={h} style={{ color: 'var(--muted2)', textAlign: h === 'Strike' ? 'left' : 'right', padding: '4px 6px', borderBottom: '1px solid var(--border)', fontWeight: 400, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ladder.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted2)', padding: 12 }}>Waiting for options data...</td></tr>
              ) : ladder.map((row, i) => {
                const pct = parseFloat(row.spread_pct ?? 0)
                return (
                  <tr key={i} style={{ background: row.is_spx ? 'rgba(255,255,255,.05)' : 'transparent' }}>
                    <td style={{ padding: '3px 6px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{row.strike}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', color: row.type === 'CALL' ? 'var(--green)' : 'var(--red)' }}>{row.type}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'var(--mono)' }}>{fmtN(row.bid)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'var(--mono)' }}>{fmtN(row.ask)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'var(--mono)', color: widthClass(pct) }}>{fmtN(row.width)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'var(--mono)', color: widthClass(pct) }}>{row.spread_pct != null ? Number(row.spread_pct).toFixed(1) + '%' : '--'}</td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', color: (row.mm_lean || '').includes('LONG') ? '#22c55e' : (row.mm_lean || '').includes('SHORT') ? '#ef4444' : 'var(--muted2)' }}>{row.mm_lean ?? '--'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C: Educational Reference */}
      <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>MM Educational Reference</div>

      <EdPanel
        title="How Market Makers Make Money"
        body="Market makers simultaneously post a bid and an ask on every single strike across the entire options chain — thousands of quotes at once. They don't take directional bets. Their entire business is being the counterparty to your trade and capturing the difference between what you pay (the ask) and what they bought it for (the bid). That spread, multiplied by thousands of transactions per day, is their profit. When you place a market order on an option, you're guaranteed to pay full ask and give the MM the entire spread immediately. When you place a limit order at the mid, you split the spread with them. On liquid SPX ATM strikes the spread can be $0.05–$0.25. On OTM or illiquid strikes it can be $2.00+. That $2 spread on a $5 option means you need a 40% move just to break even."
        tip="Always use limit orders at the mid price or better. Never use market orders on options. Check the Spread% column above — anything above 15% is giving away too much edge before the trade even starts."
      />

      <EdPanel
        title="Delta Hedging and Why It Moves ES"
        body="When a market maker sells you a call option, they are short delta. If the underlying rises, the call gains value and the MM loses money. To stay neutral — to not have a directional opinion — they immediately buy ES futures to offset that delta. The amount they buy is exactly proportional to the delta of the option. When they sell puts, they go long delta and must sell ES futures to hedge. These flows are not discretionary. The MM does not decide whether to hedge based on market opinion — it is automatic, mechanical, and constant. Every time a large block of options changes hands, a corresponding wave of ES buying or selling hits the futures market within milliseconds. This is what your dashboard's delta hedging pressure indicator is measuring: the net direction and magnitude of all these forced hedging flows."
        tip="The delta hedging pressure card on your Flow tab shows the direction of forced MM futures flow. Trade with it, not against it. If dealers must buy ES, that's a structural tailwind for longs regardless of sentiment."
      />

      <EdPanel
        title="Gamma Scalping and Price Pinning"
        body="Gamma is the rate at which delta changes. When MMs are long gamma (positive gamma environment), as price rises their calls gain delta rapidly — making them more long than they want. So they sell ES to rebalance. As price falls, their puts gain negative delta — so they buy ES. This constant buy-low-sell-high rebalancing creates a gravitational force pulling price back toward large strike clusters. The strike with the most open interest becomes a magnet. In negative gamma environments the opposite happens: as price rises, MMs must buy even more ES to keep up, amplifying the move. As price falls, they must sell more ES, amplifying that too."
        tip="In positive gamma, fade moves away from the nearest call wall — MMs will bring price back. In negative gamma, follow momentum with a tight stop — MMs are adding fuel to every move."
      />

      <EdPanel
        title="Vanna and Charm — Predictable Intraday Flows"
        body="Vanna measures how delta changes when implied volatility changes. When VIX drops sharply, the delta of OTM options collapses toward zero. MMs who were hedging those deltas suddenly don't need to hold as many ES futures, so they sell. A VIX drop of 2 points can force hundreds of millions of dollars of delta to be unwound. Charm measures how delta changes purely from the passage of time. As options approach expiration, all deltas decay toward zero (OTM) or 1 (ITM). MMs must continuously rebalance as charm eats away at their delta positions. This typically creates directional flows into the close of each trading day — especially on Fridays when weekly options expire."
        tip="Watch for late-day charm-driven flows, especially Thursday and Friday. Any sharp VIX move triggers mechanical MM repositioning — these aren't random, they're predictable events that repeat weekly."
      />

      <EdPanel
        title="Using Spreads Like a Market Maker"
        body="Instead of buying a naked call or put — where you pay full premium and need a large move just to break even — structure a spread that uses your auction zones as natural boundaries. The logic: your entry zone gives you the buy strike, your target zone gives you the sell strike. For a retest long at zone top targeting the next zone, buy a call at your entry strike and sell a call at your target strike. This defines your maximum profit (distance between strikes minus premium paid) and maximum loss (premium paid). You eliminate runaway theta risk. You reduce cost because you collect premium on the short leg. The tradeoff is capping upside at the target zone — but that's where you'd take profit anyway."
        tip="Zone retest long at 5600 targeting 5700 → buy the 5600 call, sell the 5700 call. The Zone Spread Calculator below shows you the exact cost and R/R using live bid/ask data right now."
      />

      {/* Section D: Zone Spread Calculator */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Zone Spread Calculator — Based on Current Signal</div>
        {!signal || signal === 'WAIT' || !entry || !target ? (
          <div style={{ color: 'var(--muted2)', fontSize: 12 }}>Waiting for signal data...</div>
        ) : spreadCalcData ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              {spreadCalcData.type ?? signal}
            </div>
            {Object.entries(spreadCalcData).filter(([k]) => k !== 'type').map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted2)' }}>{k.replace(/_/g, ' ')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{signal}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
              <span style={{ color: 'var(--muted2)' }}>Signal</span>
              <span style={{ fontFamily: 'var(--mono)', color: signal.includes('LONG') ? 'var(--green)' : signal.includes('SHORT') ? 'var(--red)' : 'var(--muted2)' }}>{signal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
              <span style={{ color: 'var(--muted2)' }}>Buy strike (entry)</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>{entry}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
              <span style={{ color: 'var(--muted2)' }}>Sell strike (target)</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{target}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted2)', fontStyle: 'italic', lineHeight: 1.5 }}>
              Live bid/ask spread data is not available. Use your broker's options chain to price the spread at these strikes.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
