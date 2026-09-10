'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { safeFormat } from '@/lib/safeFormat';

interface Props { data: { event_date: string; dau: number }[]; }

export function DAUSparkline({ data }: Props) {
  const chartData = data.map(d => ({
    date: safeFormat(d.event_date, 'MMM d'),
    dau: d.dau,
  }));
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-[#e6edf3] font-mono mb-4">Daily Active Users</h3>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#21262d', border: '1px solid #30363d', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}
            labelStyle={{ color: '#8b949e' }}
            itemStyle={{ color: '#58a6ff' }}
          />
          <Area type="monotone" dataKey="dau" name="DAU" stroke="#58a6ff" strokeWidth={2} fill="url(#dauGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
