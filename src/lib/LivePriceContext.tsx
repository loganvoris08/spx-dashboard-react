import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const WS_URL  = 'wss://business.massive.com/indices'
const API_KEY = (import.meta.env.VITE_MASSIVE_KEY as string ?? '').trim()

export interface LivePrices {
  spx: number | null
  ndx: number | null
  vix: number | null
}

const LivePriceContext = createContext<LivePrices>({ spx: null, ndx: null, vix: null })

export function useLivePrice() {
  return useContext(LivePriceContext)
}

export function LivePriceProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<LivePrices>({ spx: null, ndx: null, vix: null })
  const ws   = useRef<WebSocket | null>(null)
  const dead = useRef(false)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)

  function connect() {
    if (dead.current || !API_KEY) return
    const sock = new WebSocket(WS_URL)
    ws.current = sock

    sock.onopen = () => {
      sock.send(JSON.stringify({ action: 'auth', params: API_KEY }))
    }

    sock.onmessage = (e) => {
      try {
        const msgs: any[] = JSON.parse(e.data)
        msgs.forEach(m => {
          if (m.ev === 'status' && m.status === 'auth_success') {
            sock.send(JSON.stringify({ action: 'subscribe', params: 'V.I:SPX,V.I:NDX,V.I:VIX' }))
          }
          if (m.ev === 'V') {
            const v = parseFloat(m.val)
            if (isNaN(v)) return
            const sym = (m.T ?? m.sym ?? '').toUpperCase()
            setPrices(prev => {
              if (sym.includes('NDX')) return { ...prev, ndx: v }
              if (sym.includes('VIX')) return { ...prev, vix: v }
              if (sym.includes('SPX')) return { ...prev, spx: v }
              return prev
            })
          }
        })
      } catch {}
    }

    sock.onclose = () => {
      if (dead.current) return
      retry.current = setTimeout(connect, 3000)
    }

    sock.onerror = () => {
      sock.close()
    }
  }

  useEffect(() => {
    dead.current = false
    connect()
    return () => {
      dead.current = true
      if (retry.current) clearTimeout(retry.current)
      ws.current?.close()
    }
  }, [])

  return (
    <LivePriceContext.Provider value={prices}>
      {children}
    </LivePriceContext.Provider>
  )
}
