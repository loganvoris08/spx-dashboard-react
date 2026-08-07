import { useState, useEffect } from 'react'

const MODULES = [
  {
    id: 1,
    title: 'Market Structure Basics',
    color: '#22c55e',
    lessons: [
      { id: 'ms1', title: 'What Are Auction Zones?', time: '8 min', content: `Auction zones are price levels where the market has previously spent significant time — levels where buyers and sellers have both been active. When price returns to these zones, the market is re-visiting a prior area of "fair value."\n\nThink of it like a store that had a sale at a certain price. When the price returns to that level, people who missed the sale remember it and step in. That's the foundation of zone-to-zone trading.\n\nYour dashboard's ES 10M zones are computed from the current auction structure, not from arbitrary support/resistance. They update automatically as the market moves through zones and establishes new ones.` },
      { id: 'ms2', title: 'Zone-to-Zone Trading Logic', time: '10 min', content: `The core trade: price closes through a zone (breaks the auction), waits for a retest back to the zone midline, then targets the next zone.\n\nLONG setup: 10m close above zone top → wait for pullback to zone mid → enter long, target = bottom of next zone above.\n\nSHORT setup: 10m close below zone bottom → wait for bounce back to zone mid → enter short, target = top of next zone below.\n\nThe math: if zone width is 20 points and zones are 30 points apart, you risk 10 (to zone bottom) for 30 reward. 3:1 R/R built into the structure.` },
      { id: 'ms3', title: 'Reading the Zone Status Row', time: '6 min', content: `The zone status row on the Signal tab shows numbered chips: -2, -1, 0, +1, +2.\n\n0 = current zone (where price is now)\n+1 = first zone above (long target)\n-1 = first zone below (short target)\n+2 = second zone above\n-2 = second zone below\n\nWhen a chip turns green/filled, price is in that zone. The Signal tab's Scalp Signal panel tells you the exact entry, target, and stop based on the live zone calculation.` },
    ],
  },
  {
    id: 2,
    title: 'Options Flow Fundamentals',
    color: '#3b82f6',
    lessons: [
      { id: 'of1', title: 'What Is Options Flow?', time: '10 min', content: `Options flow = real-time tracking of every options trade that hits the tape. Your dashboard pulls this from Unusual Whales, which monitors every exchange in real time.\n\nSweeps: market orders that hit multiple exchanges simultaneously. This is aggressive buying — someone wants size immediately and doesn't care about slippage. Bullish/bearish signal depending on direction.\n\nFloor trades: large block trades negotiated off-exchange, usually institutional. More deliberate, often hedging activity.\n\nUnusual alerts: contracts with premium above $100k+ where the options activity is statistically unusual relative to open interest.` },
      { id: 'of2', title: 'Reading the Live Ticker', time: '8 min', content: `Each row in the live ticker shows: type (C/P), strike, expiry, premium, condition (SWEEP/FLOOR/MULTI), and aggressor.\n\nAggressor = which side of the spread the trade hit:\n• ASK = buyer (paid the ask, bullish)\n• BID = seller (sold at the bid, bearish)\n\nFor calls: ASK side = buyer paying for upside = bullish signal. BID side = someone selling calls = bearish/neutral.\n\nFor puts: ASK side = buyer paying for downside = bearish signal. BID side = someone selling puts = bullish/neutral.\n\nFilter for SWEEP + ASK on calls = most aggressive bullish signal in the flow.` },
      { id: 'of3', title: 'Understanding 0DTE', time: '12 min', content: `0DTE = zero days to expiry. These are same-day options that expire today. They carry maximum gamma — the highest sensitivity to price moves.\n\nWhy they matter:\n• Massive volume: SPX 0DTE now accounts for ~50% of all SPX options volume\n• Maximum dealer hedging: every price move forces MM delta hedging\n• Creates self-fulfilling momentum: large 0DTE call buying forces MMs to buy ES, which pushes price higher, which forces more buying\n• Snap-back risk: as time decay accelerates toward close, all this delta collapses, often causing a violent reversal\n\nThe 0DTE panel shows call/put ratio, net premium, and ATM IV. When ATM IV spikes on 0DTE, a sharp move before close is likely.` },
    ],
  },
  {
    id: 3,
    title: 'GEX and Gamma',
    color: '#a855f7',
    lessons: [
      { id: 'gex1', title: 'What Is GEX?', time: '10 min', content: `GEX (Gamma Exposure) = the total gamma that market makers are exposed to across all open options positions.\n\nPositive GEX = MMs are net long gamma. They sell when price rises and buy when price falls. This pins price and creates low-volatility, mean-reverting conditions.\n\nNegative GEX = MMs are net short gamma. They buy when price rises and sell when price falls. This amplifies moves and creates trending, high-volatility conditions.\n\nYour dashboard computes GEX from the live options chain. The GEX tab shows the full picture by strike — where the biggest gamma clusters are and where the GEX flip zone (net zero) is.` },
      { id: 'gex2', title: 'The GEX Flip Zone', time: '8 min', content: `The GEX flip zone is the price where total market-maker gamma exposure crosses from positive to negative.\n\nAbove the flip: positive gamma → MMs fade moves → chop, low vol, mean reversion\nBelow the flip: negative gamma → MMs amplify moves → trends, higher vol, momentum\n\nThe OI Strip at the top of your dashboard shows the flip zone. When SPX trades near it, the dashboard shows the "AT GAMMA FLIP" alert.\n\nTrading the flip:\n• Breaking above flip zone with volume = breakout likely to extend\n• Failing at flip zone = likely rejection back into positive gamma\n• Trading into flip from below = resistance until proven broken` },
    ],
  },
  {
    id: 4,
    title: 'Market Context and VIX',
    color: '#f59e0b',
    lessons: [
      { id: 'vix1', title: 'VIX Term Structure', time: '8 min', content: `The VIX term structure shows how implied volatility is priced across different time horizons:\n\n• VIX9D: 9-day IV — short-term fear gauge. Spikes on imminent events.\n• VIX30 (VIX): 30-day IV — the standard fear gauge\n• VIX3M: 93-day IV — longer-term fear expectations\n\nContango (normal): VIX9D < VIX < VIX3M. Short-term calm, normal environment. Trending or stable conditions.\n\nBackwardation (fear): VIX9D > VIX > VIX3M. Immediate fear spike — something imminent is scaring the market. Mean reversion usually follows the event.\n\nYour Volatility tab shows the term structure chart with the current shape and regime badge.` },
      { id: 'vix2', title: 'Implied Weekly Move', time: '6 min', content: `The implied weekly move is calculated from the ATM straddle on the nearest SPXW Friday expiry.\n\nFormula: (call price + put price) × 0.7071 = expected weekly move in points\n\nThis tells you what options market makers are pricing as the expected ±range for the week. If SPX is at 5500 and the implied weekly move is ±65 points, the market expects price to stay between 5435 and 5565 with ~68% probability.\n\nWhen price approaches or breaks the weekly expected range, that's a significant structural event. MMs have to rapidly re-hedge, which creates sharp momentum moves.` },
    ],
  },
  {
    id: 5,
    title: 'Smart Money and Institutional Flow',
    color: '#06b6d4',
    lessons: [
      { id: 'sm1', title: 'Reading Congressional Trades', time: '10 min', content: `Members of Congress are required to disclose stock trades within 45 days of the transaction under the STOCK Act. Your Smart Money tab pulls these disclosures via Unusual Whales.\n\nWhat to look for:\n• Purchases = bullish signal on that stock/sector\n• Sales = reducing exposure\n• Late filings = trades disclosed after the 45-day deadline. Research suggests these show higher conviction — the filer wanted to delay disclosing the position.\n• Timing around legislation = watch for purchases or sales near committee votes or major policy announcements\n\nNote: this is legal — politicians can trade stocks. You're simply using the public disclosure data that is already available.` },
      { id: 'sm2', title: 'Institutional 13F Filings', time: '8 min', content: `Every quarter, institutions with $100M+ AUM must file a 13F disclosing their equity holdings. Your dashboard shows the top institutional holders and their net buy/sell activity.\n\nKey metrics:\n• Net buys vs. net sells: whether the institution is adding or reducing positions\n• Call/put ratio in holdings: high calls = bullish skew, high puts = hedged or bearish\n• AUM total: larger funds have more market impact\n\nLimitation: 13Fs are filed 45 days after quarter end. The data shows where institutions WERE, not necessarily where they are now. Use it for context, not as a real-time signal.\n\nThe SPY/QQQ institutional ownership panel is more useful — it shows which funds are specifically adding or cutting index exposure.` },
    ],
  },
]

const STORAGE_KEY = 'learn_completed_lessons'

function getCompleted(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')) }
  catch { return new Set() }
}

function setCompleted(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export default function LearnScreen() {
  const [completed, setCompletedState] = useState<Set<string>>(getCompleted)
  const [lesson,    setLesson]         = useState<any>(null)
  const [module,    setModule]         = useState<any>(null)

  const totalLessons = MODULES.reduce((acc, m) => acc + m.lessons.length, 0)
  const completedCount = [...completed].filter(id => MODULES.some(m => m.lessons.some(l => l.id === id))).length
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  const markComplete = (lessonId: string) => {
    const next = new Set(completed)
    next.add(lessonId)
    setCompletedState(next)
    setCompleted(next)
  }

  useEffect(() => {
    setCompletedState(getCompleted())
  }, [])

  if (lesson) {
    const isDone = completed.has(lesson.id)
    return (
      <div id="learn_overlay" style={{ position: 'fixed', inset: 0, background: '#0d0d0d', zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#111' }}>
          <button onClick={() => setLesson(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{module?.title}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{lesson.title}</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{lesson.time}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {isDone && (
            <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid var(--green)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: 'var(--green)' }}>
              ✓ Lesson complete
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
            {lesson.content}
          </div>
          {!isDone && (
            <button onClick={() => markComplete(lesson.id)} style={{ marginTop: 24, padding: '10px 24px', background: 'var(--green)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Mark Complete
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>
          {completedCount === 0 ? 'Start your first lesson below' : `${completedCount} of ${totalLessons} lessons complete`}
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', background: 'var(--green)', borderRadius: 3, width: `${pct}%`, transition: 'width .4s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{pct}%</div>
      </div>

      {MODULES.map(mod => {
        const modCompleted = mod.lessons.filter(l => completed.has(l.id)).length
        const modPct = Math.round((modCompleted / mod.lessons.length) * 100)
        return (
          <div key={mod.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', userSelect: 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: modPct === 100 ? mod.color : 'rgba(255,255,255,.06)', color: modPct === 100 ? '#000' : mod.color, border: `1px solid ${mod.color}` }}>
                {modPct === 100 ? '✓' : mod.id}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{mod.title}</div>
              <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{modCompleted}/{mod.lessons.length}</div>
            </div>
            <div style={{ height: 3, margin: '0 14px 10px', background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: mod.color, borderRadius: 2, width: `${modPct}%`, transition: 'width .3s' }} />
            </div>
            <div style={{ paddingBottom: 8 }}>
              {mod.lessons.map(lesson => {
                const isDone = completed.has(lesson.id)
                return (
                  <div
                    key={lesson.id}
                    onClick={() => { setLesson(lesson); setModule(mod) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 18, textAlign: 'center', fontSize: 13, flexShrink: 0 }}>
                      {isDone ? <span style={{ color: mod.color }}>✓</span> : '○'}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{lesson.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0 }}>{lesson.time}</div>
                    <button style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}>
                      {isDone ? 'Review' : 'Start'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
