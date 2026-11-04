'use client';

import dynamic from 'next/dynamic';

const Particles = dynamic(() => import('@/components/ui/Particles'), { ssr: false });

export function DashboardBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Particles
        particleColors={['#3b82f6', '#60a5fa', '#818cf8', '#38bdf8', '#c084fc']}
        particleCount={240}
        particleSpread={12}
        speed={0.1}
        particleBaseSize={90}
        sizeRandomness={0.9}
        shape="circle"
        glow={0.65}
        twinkle={0.35}
        depthOfField={0.15}
        connections={true}
        connectionDistance={115}
        moveParticlesOnHover={true}
        hoverEffect="parallax"
        particleHoverFactor={1.2}
        clickBurst={true}
        drift="forward"
        driftSpeed={0.8}
        opacity={0.65}
      />
    </div>
  );
}
