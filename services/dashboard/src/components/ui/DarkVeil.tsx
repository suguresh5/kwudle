'use client'

interface DarkVeilProps {
  intensity?: number
}

export function DarkVeil({ intensity = 0.12 }: DarkVeilProps) {
  return (
    <div
      className="dark-veil"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Top-right orb */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          top: '-120px',
          right: '-100px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(99,102,241,${intensity}) 0%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'veilFloat 8s ease-in-out infinite',
        }}
      />
      {/* Bottom-left orb */}
      <div
        style={{
          position: 'absolute',
          width: '450px',
          height: '450px',
          bottom: '-100px',
          left: '-80px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(59,130,246,${intensity}) 0%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'veilFloat 10s ease-in-out infinite reverse',
        }}
      />
      {/* Center-bottom subtle accent */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '300px',
          bottom: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(16,185,129,${intensity * 0.5}) 0%, transparent 70%)`,
          filter: 'blur(100px)',
          animation: 'veilFloat 12s ease-in-out infinite',
          animationDelay: '2s',
        }}
      />
    </div>
  )
}
