import { useState, useEffect, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''
function token() { return localStorage.getItem('dash_token') ?? '' }

export interface MarketStateData {
  timestamp: string
  direction_score: number
  confidence: number
  regime: string
  entry_state: string
  bias: string
  reasoning: string[]
  positioning: {
    regime: string
    uw_regime: string
    flip_zone: any
    call_wall: any
    put_wall: any
    dist_to_call: any
    dist_to_put: any
    dealer_gamma_usd: number
    gamma_trough: any
    dealer_pressure: string
    dealer_note: string
    vanna_flow: string
    expected_daily_move: number
    em_consumed_pct: number
    session_range: number
    atm_iv: any
    iv_rank: any
    iv_regime: string
    skew: number
    vix_term: string
    put_call_ratio: number
    max_pain: any
  }
  market: {
    spx: number | null
    es: number | null
    nq: number | null
    vix: number | null
    vix9d: number | null
    vix3m: number | null
    vvix: number | null
    vix_dir: string
    vwap: number | null
    or_high: number | null
    or_low: number | null
    day_high: number | null
    day_low: number | null
    prev_close: number | null
    spx_chg_pct: number | null
    auction_state: string
    break_state: string
    structure_conf: string
    retest_active: boolean
    es_10m_zone_state: string | null
    es_10m_zone_bot: number | null
    es_10m_zone_top: number | null
    es_10m_zone_pct: number | null
    es_d_zone_state: string | null
    es_d_zone_bot: number | null
    es_d_zone_top: number | null
    nyse_tick: number
    nyse_add: number
    session_range: number
    em_consumed_pct: number
  }
  flow: {
    flow_pressure: number
    flow_state: string
    flow_bias: string
    call_pct: number
    put_pct: number
    delta_flow: string
    delta_flow_val: number
    breadth_score: number
    nyse_tick: number
    nyse_add: number
    vanna_flow: string
    sweep_count: number
    large_count: number
    call_sweeps: number
    put_sweeps: number
  }
}

export function useMarketState() {
  const [ms, setMs]         = useState<MarketStateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    try {
      const res = await fetch(`${BASE}/api/market-state`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      // Stale-while-revalidate: always keep previous data visible until new
      // data is ready — never flash empty/loading between refreshes
      setMs(data)
      setError(null)
    } catch (e: any) {
      // On refresh errors, keep stale data visible — don't clear ms
      setError(e?.message ?? 'Failed to load market state')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    timer.current = setInterval(load, 15_000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  return { ms, loading, error, reload: load }
}
