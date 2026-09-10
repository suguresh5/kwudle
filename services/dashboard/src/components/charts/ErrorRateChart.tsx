'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { format } from 'date-fns';

interface TimeSeriesPoint {
  minute: string;
  total_events: number;
  error_events: number;
  p99_ms: number;
  deployment_version?: string;
}

interface Deployment {
  version: string;
  timestamp: string;
  deployed_by: string;
}

interface Props {
  timeseries: TimeSeriesPoint[];
  deployments: Deployment[];
  title?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#21262d] border border-[#30363d] rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-[#8b949e] mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

export function ErrorRateChart({ timeseries, deployments, title = 'Error Rate & Latency' }: Props) {
  const data = timeseries.map(row => ({
    ...row,
    error_rate: row.total_events > 0
      ? ((row.error_events / row.total_events) * 100).toFixed(2)
      : 0,
    time: format(new Date(row.minute), 'HH:mm'),
  }));

  // Unique deployment timestamps for reference lines
  const deploySet = new Set<string>();
  deployments.forEach(d => deploySet.add(d.timestamp));

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-4 font-mono">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="time" tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }} />

          {/* Deployment marker lines (Feature F) */}
          {deployments.map((d) => (
            <ReferenceLine
              key={d.version}
              yAxisId="left"
              x={format(new Date(d.timestamp), 'HH:mm')}
              stroke="#d29922"
              strokeDasharray="4 4"
              label={{
                value: `v${d.version}`,
                fill: '#d29922',
                fontSize: 10,
                fontFamily: 'monospace',
                position: 'insideTopRight',
              }}
            />
          ))}

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="error_rate"
            name="Error Rate %"
            stroke="#f85149"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#f85149' }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="p99_ms"
            name="P99 Latency (ms)"
            stroke="#58a6ff"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#58a6ff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
