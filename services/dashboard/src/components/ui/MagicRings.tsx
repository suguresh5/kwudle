'use client'
import { CSSProperties } from 'react'

interface MagicRingsProps {
  size?: number
  color?: string
  style?: CSSProperties
}

export function MagicRings({
  size = 600,
  color = 'rgba(99,102,241,0.15)',
  style = {},
}: MagicRingsProps) {
  const rings = [1, 0.75, 0.5, 0.3]
  return (
    <div
      className="magic-rings"
      style={{
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {rings.map((scale, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: `${((1 - scale) / 2) * 100}%`,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            opacity: 0.4 + i * 0.15,
            animation: `magicRingPulse ${2.5 + i * 0.6}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  )
}
