import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const WS_URL  = 'wss://socket.massive.com/futures'
const API_KEY = (import.meta.env.VITE_MASSIVE_KEY as string ?? '').trim()

export interface LiveBar {
  time:   number   // unix seconds (minute-aligned)
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface FuturesState {
  esLiveBar:    LiveBar | null   // current building minute bar
  esCumDelta:   number           // running buy − sell volume today
  esSessionVol: number           // total ES volume this session
  esVwap:       number | null    // session VWAP from trade ticks
  connected:    boolean
}

const Ctx = createContext<FuturesState>({
  esLiveBar: null, esCumDelta: 0, esSessionVol: 0, esVwap: null, connected: false,
})

export function useLiveFutures() { return useContext(Ctx) }

// Session start = 9:30 ET = 13:30 UTC on a normal day
function sessionStartMs(): number {
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const open = new Date(et)
  open.setHours(9, 30, 0, 0)
  return open.getTime() - (et.getTime() - now.getTime())
}

export function LiveFuturesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FuturesState>({
    esLiveBar: null, esCumDelta: 0, esSessionVol: 0, esVwap: null, connected: false,
  })

  const ws          = useRef<WebSocket | null>(null)
  const dead        = useRef(false)
  const retry       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveBar     = useRef<LiveBar | null>(null)
  const cumDelta    = useRef(0)
  const sessionVol  = useRef(0)
  const prevPrice   = useRef<number | null>(null)  // for T-tick delta
  const prevClose   = useRef<number | null>(null)  // for A-agg delta fallback
  const sessionTs   = useRef(sessionStartMs())
  const vwapNum     = useRef(0)   // sum(price × size)
  const vwapDen     = useRef(0)   // sum(size)

  function flush() {
    setState({
      esLiveBar:    liveBar.current ? { ...liveBar.current } : null,
      esCumDelta:   cumDelta.current,
      esSessionVol: sessionVol.current,
      esVwap:       vwapDen.current > 0 ? vwapNum.current / vwapDen.current : null,
      connected:    true,
    })
  }

  function connect() {
    if (dead.current || !API_KEY) {
      console.warn('[LiveFutures] No API key — set VITE_MASSIVE_KEY in Vercel env vars')
      return
    }
    const sock = new WebSocket(WS_URL)
    ws.current = sock

    sock.onopen = () => {
      sock.send(JSON.stringify({ action: 'auth', params: API_KEY }))
    }

    sock.onmessage = (e) => {
      try {
        const msgs: any[] = JSON.parse(e.data)
        let changed = false

        msgs.forEach(m => {
          // Auth success → subscribe to ES trades + second aggregates
          if (m.ev === 'status' && m.status === 'auth_success') {
            sock.send(JSON.stringify({ action: 'subscribe', params: 'T.ES1!,A.ES1!' }))
            setState(s => ({ ...s, connected: true }))
          }
          // Auth failed
          if (m.ev === 'status' && m.status === 'auth_failed') {
            console.error('[LiveFutures] Auth failed — check VITE_MASSIVE_KEY and futures subscription')
          }

          // Second aggregate — build live minute bar + cumDelta fallback
          if (m.ev === 'A' && (m.sym === 'ES1!' || m.T === 'ES1!')) {
            const startMs  = m.s ?? m.start_timestamp ?? 0
            const minTs    = Math.floor(startMs / 60000) * 60
            const o = parseFloat(m.o ?? m.open  ?? 0)
            const h = parseFloat(m.h ?? m.high  ?? 0)
            const l = parseFloat(m.l ?? m.low   ?? 0)
            const c = parseFloat(m.c ?? m.close ?? 0)
            const v = parseFloat(m.v ?? m.volume ?? 0)
            if (!c || !minTs) return

            const cur = liveBar.current
            if (!cur || minTs > cur.time) {
              liveBar.current = { time: minTs, open: o || c, high: h || c, low: l || c, close: c, volume: v }
            } else if (minTs === cur.time) {
              liveBar.current = {
                time: cur.time, open: cur.open,
                high: Math.max(cur.high, h), low: Math.min(cur.low, l),
                close: c, volume: cur.volume + v,
              }
            }
            sessionVol.current += v

            // Aggregate-based cumDelta: direction of close vs prev close × volume
            // Used as primary source since T (tick) events may not be in plan tier
            if (prevClose.current !== null && v > 0) {
              if (c > prevClose.current)      cumDelta.current += v
              else if (c < prevClose.current) cumDelta.current -= v
            }
            prevClose.current = c

            // VWAP from aggregates (vw field = volume-weighted price for the second)
            const vw = parseFloat(m.vw ?? 0)
            if (vw > 0 && v > 0) {
              vwapNum.current += vw * v
              vwapDen.current += v
            }
            changed = true
          }

          // Individual trade ticks — higher-res cumDelta if available in plan
          if (m.ev === 'T' && (m.sym === 'ES1!' || m.T === 'ES1!')) {
            const price = parseFloat(m.p ?? 0)
            const size  = parseFloat(m.s ?? m.size ?? 1)
            const tMs   = m.t ?? m.timestamp ?? 0
            if (!price) return

            if (tMs > 0 && tMs < sessionTs.current) {
              cumDelta.current   = 0
              sessionVol.current = 0
              vwapNum.current    = 0
              vwapDen.current    = 0
              prevClose.current  = null
              sessionTs.current  = sessionStartMs()
            }

            if (prevPrice.current !== null) {
              if (price > prevPrice.current)      cumDelta.current += size
              else if (price < prevPrice.current) cumDelta.current -= size
            }
            prevPrice.current = price
            vwapNum.current += price * size
            vwapDen.current += size
            changed = true
          }
        })

        if (changed) flush()
      } catch {}
    }

    sock.onclose = () => {
      setState(s => ({ ...s, connected: false }))
      if (dead.current) return
      retry.current = setTimeout(connect, 4000)
    }

    sock.onerror = () => { try { sock.close() } catch {} }
  }

  useEffect(() => {
    dead.current = false
    connect()
    return () => {
      dead.current = true
      if (retry.current) clearTimeout(retry.current)
      try { ws.current?.close() } catch {}
    }
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
