interface SkeletonLineProps {
  width?: string
  size?: 'sm' | 'md' | 'lg'
}

interface SkeletonBoxProps {
  width?: string
  height?: string
}

export function SkeletonLine({ width = '100%', size = 'md' }: SkeletonLineProps) {
  const sizeClass = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''
  return <div className={`skeleton sk-line ${sizeClass}`} style={{ width }} />
}

export function SkeletonBox({ width = '100%', height = '40px' }: SkeletonBoxProps) {
  return <div className="skeleton sk-box" style={{ width, height }} />
}

export function SkeletonStat() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SkeletonLine width="50%" size="sm" />
      <SkeletonLine width="75%" size="lg" />
    </div>
  )
}
