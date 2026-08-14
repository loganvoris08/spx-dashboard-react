import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSSE } from './SSEContext'

export interface LiveBar {
  time:   number
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface FuturesState {
  esLiveBar:    LiveBar | null
  esPrice:      number | null
  esCumDelta:   number
  esSessionVol: number
  esVwap:       number | null
  nqLiveBar:    LiveBar | null
  nqPrice:      number | null
  nqCumDelta:   number
  nqSessionVol: number
  nqVwap:       number | null
  esBid:        number | null
  esAsk:        number | null
  esSpread:     number | null
  nqBid:        number | null
  nqAsk:        number | null
  nqSpread:     number | null
  connected:    boolean
}

const Ctx = createContext<FuturesState>({
  esLiveBar: null, esPrice: null, esCumDelta: 0, esSessionVol: 0, esVwap: null,
  nqLiveBar: null, nqPrice: null, nqCumDelta: 0, nqSessionVol: 0, nqVwap: null,
  esBid: null, esAsk: null, esSpread: null,
  nqBid: null, nqAsk: null, nqSpread: null,
  connected: false,
})

export function useLiveFutures() { return useContext(Ctx) }

export function LiveFuturesProvider({ children }: { children: ReactNode }) {
  const { on } = useSSE()
  const [state, setState] = useState<FuturesState>({
    esLiveBar: null, esPrice: null, esCumDelta: 0, esSessionVol: 0, esVwap: null,
    nqLiveBar: null, nqPrice: null, nqCumDelta: 0, nqSessionVol: 0, nqVwap: null,
    esBid: null, esAsk: null, esSpread: null,
    nqBid: null, nqAsk: null, nqSpread: null,
    connected: false,
  })

  useEffect(() => {
    // ES/NQ prices come from the server-side Massive WebSocket via SSE tick events.
    // The server holds the single allowed Massive futures connection; browser subscribing
    // directly would kick the server off and cause both to reconnect in an infinite loop.
    const off = on('tick', (msg) => {
      setState(prev => {
        const es = msg.es != null ? parseFloat(msg.es) : prev.esPrice
        const nq = msg.nq != null ? parseFloat(msg.nq) : prev.nqPrice
        const esBid    = msg.es_bid    != null ? parseFloat(msg.es_bid)    : prev.esBid
        const esAsk    = msg.es_ask    != null ? parseFloat(msg.es_ask)    : prev.esAsk
        const esSpread = msg.es_spread != null ? parseFloat(msg.es_spread) : prev.esSpread
        const nqBid    = msg.nq_bid    != null ? parseFloat(msg.nq_bid)    : prev.nqBid
        const nqAsk    = msg.nq_ask    != null ? parseFloat(msg.nq_ask)    : prev.nqAsk
        const nqSpread = msg.nq_spread != null ? parseFloat(msg.nq_spread) : prev.nqSpread
        return {
          ...prev,
          esPrice:  es && es > 0 ? es : prev.esPrice,
          nqPrice:  nq && nq > 0 ? nq : prev.nqPrice,
          esBid, esAsk, esSpread, nqBid, nqAsk, nqSpread,
          connected: true,
        }
      })
    })
    return off
  }, [on])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
