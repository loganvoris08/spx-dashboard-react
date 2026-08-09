import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const closeCallbacks = new Set<() => void>()

interface TooltipProps {
  tip: string
  label?: string
  children: React.ReactNode
  iconColor?: string
}

export function Tooltip({ tip, label, children, iconColor }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    closeCallbacks.add(close)
    return () => { closeCallbacks.delete(close) }
  }, [close])

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (open) { setOpen(false); return }
    closeCallbacks.forEach(fn => fn())

    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const TIP_W = 240
    const TIP_GAP = 8
    const MARGIN = 10

    let left = rect.left + rect.width / 2 - TIP_W / 2
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - TIP_W - MARGIN))

    const spaceBelow = window.innerHeight - rect.bottom
    const above = rect.top - TIP_GAP
    const below = rect.bottom + TIP_GAP

    const pos: React.CSSProperties = {
      position: 'fixed',
      width: TIP_W,
      left,
      zIndex: 99999,
    }

    if (spaceBelow < 130 && above > 80) {
      pos.bottom = window.innerHeight - rect.top + TIP_GAP
    } else {
      pos.top = below
    }

    setStyle(pos)
    setOpen(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: Event) => {
      if (!(e.target as Element)?.closest?.('.tt-box')) setOpen(false)
    }
    document.addEventListener('click', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <>
      <span
        ref={triggerRef}
        onClick={toggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        {children}
        <span style={{ fontSize: 9, lineHeight: 1, color: iconColor ?? 'rgba(136,136,136,0.7)', flexShrink: 0, userSelect: 'none' }}>ⓘ</span>
      </span>

      {open && createPortal(
        <div
          className="tt-box"
          onClick={e => e.stopPropagation()}
          style={{
            ...style,
            background: '#0c1018',
            border: '1px solid #243040',
            borderRadius: 8,
            padding: '10px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
            pointerEvents: 'auto',
          }}
        >
          {label && (
            <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#00ff88', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
              {label}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.55, fontFamily: 'system-ui, sans-serif' }}>
            {tip}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
