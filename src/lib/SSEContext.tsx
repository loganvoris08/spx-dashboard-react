import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

type Handler = (msg: any) => void

interface SSEContextValue {
  on: (type: string, handler: Handler) => () => void
}

const SSEContext = createContext<SSEContextValue>({ on: () => () => {} })

export function useSSE() { return useContext(SSEContext) }

const BASE = import.meta.env.VITE_API_URL ?? ''

export function SSEProvider({ children }: { children: ReactNode }) {
  const listeners = useRef<Map<string, Set<Handler>>>(new Map())
  const esRef     = useRef<EventSource | null>(null)
  const dead      = useRef(false)
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  function connect() {
    if (dead.current) return
    const token = localStorage.getItem('dash_token') ?? ''
    if (!token) return

    const es = new EventSource(`${BASE}/api/stream?t=${encodeURIComponent(token)}`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        const type: string = msg.type
        if (!type) return
        listeners.current.get(type)?.forEach(h => h(msg))
        listeners.current.get('*')?.forEach(h => h(msg))
      } catch {}
    }

    es.onerror = () => {
      es.close()
      if (!dead.current) {
        retryRef.current = setTimeout(connect, 3000)
      }
    }
  }

  useEffect(() => {
    dead.current = false
    connect()
    return () => {
      dead.current = true
      if (retryRef.current) clearTimeout(retryRef.current)
      esRef.current?.close()
    }
  }, [])

  const on = (type: string, handler: Handler) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set())
    listeners.current.get(type)!.add(handler)
    return () => { listeners.current.get(type)?.delete(handler) }
  }

  return <SSEContext.Provider value={{ on }}>{children}</SSEContext.Provider>
}
