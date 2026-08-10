import { useState, useEffect, useCallback } from 'react'
import { fetchData } from '../lib/api'
import { useSSE } from '../lib/SSEContext'

// Fallback poll interval — SSE handles real-time; this catches ladder/OI data updates
const POLL_MS = 60_000

// Map SSE update fields into the live_data shape
function applyUpdate(prev: any, msg: any): any {
  if (!prev) return prev
  const nd = { ...(typeof prev.ndx === 'object' && prev.ndx ? prev.ndx : {}) }

  const patch: any = {}
  if (msg.spx  != null) patch.spx  = msg.spx
  if (msg.vix  != null) patch.vix  = msg.vix
  if (msg.es   != null) patch.es   = msg.es
  if (msg.nq   != null) patch.nq   = msg.nq

  if (msg.signal        != null) patch.trade_signal              = msg.signal
  if (msg.gamma_state   != null) patch.gamma_state               = msg.gamma_state
  if (msg.flip          != null) patch.gex_flip_zone             = msg.flip
  if (msg.flip_raw      != null) patch.gex_flip_zone_raw         = msg.flip_raw
  if (msg.cwall         != null) patch.nearest_call_wall         = msg.cwall
  if (msg.pwall         != null) patch.nearest_put_wall          = msg.pwall
  if (msg.regime        != null) patch.uw_gamma_regime           = msg.regime
  if (msg.dealer_gamma  != null) patch.dealer_gamma_dollar_per_pct = msg.dealer_gamma
  if (msg.net_gex_state != null) patch.net_gex_state             = msg.net_gex_state
  if (msg.flow_bias     != null) patch.flow_bias                 = msg.flow_bias
  if (msg.delta_hedging != null) patch.delta_hedging_pressure    = msg.delta_hedging
  if (msg.charm_flow    != null) patch.charm_flow                = msg.charm_flow
  if (msg.vanna_flow    != null) patch.vanna_flow                = msg.vanna_flow
  if (msg.net_delta_dir != null) patch.net_delta_dir             = msg.net_delta_dir
  if (msg.net_delta_dollar != null) patch.net_dealer_delta       = msg.net_delta_dollar
  if (msg.nyse_tick != null) patch.nyse_tick                     = msg.nyse_tick
  if (msg.nyse_add  != null) patch.nyse_add                      = msg.nyse_add

  // NDX fields go into ndx sub-object
  if (msg.ndx        != null) nd.price              = msg.ndx
  if (msg.ndx_flip   != null) nd.gex_flip_zone      = msg.ndx_flip
  if (msg.ndx_flip_raw != null) nd.gex_flip_zone_raw = msg.ndx_flip_raw
  if (msg.ndx_cwall  != null) {
    nd.nearest_call_wall     = msg.ndx_cwall
    patch.ndx_nearest_call_wall = msg.ndx_cwall
  }
  if (msg.ndx_pwall  != null) {
    nd.nearest_put_wall      = msg.ndx_pwall
    patch.ndx_nearest_put_wall = msg.ndx_pwall
  }
  if (msg.ndx_regime != null) {
    nd.uw_gamma_regime       = msg.ndx_regime
    patch.ndx_uw_gamma_regime = msg.ndx_regime
  }
  if (msg.ndx_dealer_gamma != null) {
    nd.dealer_gamma_dollar_per_pct   = msg.ndx_dealer_gamma
    patch.ndx_dealer_gamma_dollar_per_pct = msg.ndx_dealer_gamma
  }
  if (msg.ndx_net_gex_state != null) {
    nd.net_gex_state = msg.ndx_net_gex_state
  }

  patch.ndx = nd

  return { ...prev, ...patch }
}

export function useDashboard() {
  const [data, setData]             = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const { on }                      = useSSE()

  const refresh = useCallback(async () => {
    try {
      const d = await fetchData()
      setData(d)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    // Initial full fetch
    refresh()

    // SSE real-time patches for live scalar signals
    const off = on('update', (msg) => {
      setData((prev: any) => applyUpdate(prev, msg))
      setLastUpdated(new Date())
    })

    // Fallback poll every 60s for ladder/OI data that doesn't come via SSE
    const timer = setInterval(refresh, POLL_MS)

    return () => {
      off()
      clearInterval(timer)
    }
  }, [refresh, on])

  return { data, lastUpdated, error, refresh }
}
