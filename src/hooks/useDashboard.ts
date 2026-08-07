import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchData } from '../lib/api'

const POLL_MS = 20_000

export function useDashboard() {
  const [data, setData] = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

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
    refresh()
    timer.current = setInterval(refresh, POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [refresh])

  return { data, lastUpdated, error, refresh }
}
