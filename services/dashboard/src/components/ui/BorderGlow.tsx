'use client'
import { ReactNode, CSSProperties } from 'react'

interface BorderGlowProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  glowColor?: string
}

export function BorderGlow({
  children,
  className = '',
  style = {},
  glowColor = 'rgba(99,102,241,0.6)',
}: BorderGlowProps) {
  return (
    <div
      className={`border-glow-wrapper ${className}`}
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Animated conic border */}
      <div
        className="border-glow-ring"
        style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: 'inherit',
          background: `conic-gradient(from var(--glow-angle, 0deg), transparent 0%, ${glowColor} 10%, transparent 20%, transparent 100%)`,
          animation: 'borderGlowSpin 3s linear infinite',
          zIndex: 0,
        }}
      />
      {/* Inner content container */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '18px',
          background: 'var(--glass-bg)',
          height: '100%',
        }}
      >
        {children}
      </div>
    </div>
  )
}
