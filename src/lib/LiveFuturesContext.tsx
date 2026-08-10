import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const WS_URL  = 'wss://socket.massive.com/futures'
const API_KEY = (import.meta.env.VITE_MASSIVE_KEY as string ?? '').trim()

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
  esPrice:      number | null   // live ES price from WebSocket
  esCumDelta:   number
  esSessionVol: number
  esVwap:       number | null
  nqLiveBar:    LiveBar | null
  nqPrice:      number | null   // live NQ price from WebSocket
  nqCumDelta:   number
  nqSessionVol: number
  nqVwap:       number | null
  connected:    boolean
}

const Ctx = createContext<FuturesState>({
  esLiveBar: null, esPrice: null, esCumDelta: 0, esSessionVol: 0, esVwap: null,
  nqLiveBar: null, nqPrice: null, nqCumDelta: 0, nqSessionVol: 0, nqVwap: null,
  connected: false,
})

export function useLiveFutures() { return useContext(Ctx) }

// Compute CME front-month contract ticker (e.g. ESU26, NQU26)
function frontMonth(base: string): string {
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const year = et.getFullYear()
  const contracts: [number, string][] = [[3,'H'],[6,'M'],[9,'U'],[12,'Z']]
  for (const [month, code] of contracts) {
    const firstDay = new Date(year, month - 1, 1)
    const firstFri = 1 + (4 - firstDay.getDay() + 7) % 7
    const rollDate = new Date(year, month - 1, firstFri + 14)
    if (et < rollDate) return `${base}${code}${String(year).slice(2)}`
  }
  return `${base}H${String(year + 1).slice(2)}`
}

function sessionStartMs(): number {
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const open = new Date(et)
  open.setHours(9, 30, 0, 0)
  return open.getTime() - (et.getTime() - now.getTime())
}

function makeBarRefs() {
  return {
    liveBar:   { current: null as LiveBar | null },
    livePrice: { current: null as number | null },
    cumDelta:  { current: 0 },
    sessionVol:{ current: 0 },
    prevPrice: { current: null as number | null },
    prevClose: { current: null as number | null },
    vwapNum:   { current: 0 },
    vwapDen:   { current: 0 },
  }
}

export function LiveFuturesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FuturesState>({
    esLiveBar: null, esPrice: null, esCumDelta: 0, esSessionVol: 0, esVwap: null,
    nqLiveBar: null, nqPrice: null, nqCumDelta: 0, nqSessionVol: 0, nqVwap: null,
    connected: false,
  })

  const ws         = useRef<WebSocket | null>(null)
  const dead       = useRef(false)
  const retry      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTs  = useRef(sessionStartMs())
  const es         = useRef(makeBarRefs())
  const nq         = useRef(makeBarRefs())
  // Store tickers so the message handler can match them
  const esTicker   = useRef(frontMonth('ES'))
  const nqTicker   = useRef(frontMonth('NQ'))

  function flush() {
    const e = es.current, n = nq.current
    setState({
      esLiveBar:    e.liveBar.current   ? { ...e.liveBar.current }   : null,
      esPrice:      e.livePrice.current,
      esCumDelta:   e.cumDelta.current,
      esSessionVol: e.sessionVol.current,
      esVwap:       e.vwapDen.current > 0 ? e.vwapNum.current / e.vwapDen.current : null,
      nqLiveBar:    n.liveBar.current   ? { ...n.liveBar.current }   : null,
      nqPrice:      n.livePrice.current,
      nqCumDelta:   n.cumDelta.current,
      nqSessionVol: n.sessionVol.current,
      nqVwap:       n.vwapDen.current > 0 ? n.vwapNum.current / n.vwapDen.current : null,
      connected:    true,
    })
  }

  function handleAggregate(m: any, r: ReturnType<typeof makeBarRefs>) {
    const startMs = m.s ?? 0
    const minTs   = Math.floor(startMs / 60000) * 60
    const o = parseFloat(m.o ?? 0)
    const h = parseFloat(m.h ?? 0)
    const l = parseFloat(m.l ?? 0)
    const c = parseFloat(m.c ?? 0)
    const v = parseFloat(m.v ?? 0)
    if (!c || !minTs) return false

    r.livePrice.current = c

    const cur = r.liveBar.current
    if (!cur || minTs > cur.time) {
      r.liveBar.current = { time: minTs, open: o || c, high: h || c, low: l || c, close: c, volume: v }
    } else if (minTs === cur.time) {
      r.liveBar.current = {
        time: cur.time, open: cur.open,
        high: Math.max(cur.high, h), low: Math.min(cur.low, l),
        close: c, volume: cur.volume + v,
      }
    }
    r.sessionVol.current += v

    if (r.prevClose.current !== null && v > 0) {
      if (c > r.prevClose.current)      r.cumDelta.current += v
      else if (c < r.prevClose.current) r.cumDelta.current -= v
    }
    r.prevClose.current = c

    const vw = parseFloat(m.vw ?? 0)
    if (vw > 0 && v > 0) {
      r.vwapNum.current += vw * v
      r.vwapDen.current += v
    }
    return true
  }

  function handleTrade(m: any, r: ReturnType<typeof makeBarRefs>) {
    // Massive futures T tick prices: integer format (e.g. 606450 = 6064.50)
    const rawP = parseFloat(m.p ?? 0)
    if (!rawP) return false
    // Heuristic: if price > 10× what a reasonable futures price would be, divide by 100
    // ES/NQ trade around 4000–8000, so if rawP > 80000 it's the integer format
    const price = rawP > 80000 ? rawP / 100 : rawP
    const size  = parseFloat(m.s ?? 1)
    const tMs   = m.t ?? 0

    if (tMs > 0 && tMs < sessionTs.current) {
      r.cumDelta.current  = 0
      r.sessionVol.current = 0
      r.vwapNum.current   = 0
      r.vwapDen.current   = 0
      r.prevClose.current = null
      r.prevPrice.current = null
      sessionTs.current   = sessionStartMs()
    }

    r.livePrice.current = price

    if (r.prevPrice.current !== null) {
      if (price > r.prevPrice.current)      r.cumDelta.current += size
      else if (price < r.prevPrice.current) r.cumDelta.current -= size
    }
    r.prevPrice.current  = price
    r.vwapNum.current   += price * size
    r.vwapDen.current   += size
    return true
  }

  function connect() {
    if (dead.current || !API_KEY) {
      console.warn('[LiveFutures] No API key — set VITE_MASSIVE_KEY in Vercel env vars')
      return
    }
    // Refresh front-month tickers on each connect (handles roll)
    esTicker.current = frontMonth('ES')
    nqTicker.current = frontMonth('NQ')

    const sock = new WebSocket(WS_URL)
    ws.current = sock
    let pingInterval: ReturnType<typeof setInterval> | null = null

    sock.onopen = () => {
      sock.send(JSON.stringify({ action: 'auth', params: API_KEY }))
    }

    sock.onmessage = (e) => {
      try {
        const msgs: any[] = JSON.parse(e.data)
        let changed = false

        msgs.forEach(m => {
          if (m.ev === 'status' && m.status === 'auth_success') {
            const sub = [
              `T.${esTicker.current}`, `A.${esTicker.current}`,
              `T.${nqTicker.current}`, `A.${nqTicker.current}`,
            ].join(',')
            sock.send(JSON.stringify({ action: 'subscribe', params: sub }))
            setState(s => ({ ...s, connected: true }))
            console.log(`[LiveFutures] Subscribed to ${sub}`)
            // keepalive — prevents idle timeout disconnects
            if (pingInterval) clearInterval(pingInterval)
            pingInterval = setInterval(() => {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({ action: 'ping' }))
              }
            }, 15000)
          }

          if (m.ev === 'status' && m.status === 'auth_failed') {
            console.error('[LiveFutures] Auth failed — check VITE_MASSIVE_KEY')
          }

          const sym = m.sym ?? m.T ?? ''

          if (m.ev === 'A') {
            if (sym === esTicker.current)      changed = handleAggregate(m, es.current) || changed
            else if (sym === nqTicker.current) changed = handleAggregate(m, nq.current) || changed
          }

          if (m.ev === 'T') {
            if (sym === esTicker.current)      changed = handleTrade(m, es.current) || changed
            else if (sym === nqTicker.current) changed = handleTrade(m, nq.current) || changed
          }
        })

        if (changed) flush()
      } catch {}
    }

    sock.onclose = () => {
      if (pingInterval) clearInterval(pingInterval)
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
