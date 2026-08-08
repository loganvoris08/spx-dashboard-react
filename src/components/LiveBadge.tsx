type LiveBadgeVariant = 'green' | 'yellow' | 'dim'

interface LiveBadgeProps {
  label?: string
  variant?: LiveBadgeVariant
  pulse?: boolean
}

export default function LiveBadge({ label = 'LIVE', variant = 'green', pulse = true }: LiveBadgeProps) {
  const shouldPulse = pulse && variant !== 'dim'
  return (
    <span className={`live-badge ${variant}`}>
      {shouldPulse && <span className="live-badge-dot" />}
      {label}
    </span>
  )
}
