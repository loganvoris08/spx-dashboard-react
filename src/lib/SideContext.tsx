import { createContext, useContext, useState, type ReactNode } from 'react'

type Side = 'spx' | 'ndx'

interface SideCtx {
  side: Side
  setSide: (s: Side) => void
  isNdx: boolean
}

const Ctx = createContext<SideCtx>({ side: 'spx', setSide: () => {}, isNdx: false })

export function SideProvider({ children }: { children: ReactNode }) {
  const [side, setSide] = useState<Side>('spx')
  return (
    <Ctx.Provider value={{ side, setSide, isNdx: side === 'ndx' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSide() { return useContext(Ctx) }
