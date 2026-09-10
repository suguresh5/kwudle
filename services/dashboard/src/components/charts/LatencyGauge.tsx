'use client';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface Props { p50: number; p95: number; p99: number; }

export function LatencyGauge({ p50, p95, p99 }: Props) {
  const maxMs = Math.max(p99 * 1.2, 100);
  const data = [
    { name: 'P99', value: (p99 / maxMs) * 100, fill: '#f85149' },
    { name: 'P95', value: (p95 / maxMs) * 100, fill: '#d29922' },
    { name: 'P50', value: (p50 / maxMs) * 100, fill: '#3fb950' },
  ];
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-[#e6edf3] font-mono mb-2">Latency Percentiles</h3>
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart cx="50%" cy="100%" innerRadius="40%" outerRadius="90%"
          startAngle={180} endAngle={0} data={data}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#21262d' }} dataKey="value" angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="flex justify-around text-xs font-mono mt-1">
        {[
          { label: 'P50', value: p50, color: '#3fb950' },
          { label: 'P95', value: p95, color: '#d29922' },
          { label: 'P99', value: p99, color: '#f85149' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p style={{ color }} className="font-semibold">{value?.toFixed(0)}ms</p>
            <p className="text-[#8b949e]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
