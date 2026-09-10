'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ErrorRateChart } from '../../components/charts/ErrorRateChart';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

const ENVS = ['production', 'staging', 'development'];
const WINDOWS = [{ label: '1h', hours: 1 }, { label: '6h', hours: 6 }, { label: '24h', hours: 24 }, { label: '7d', hours: 168 }];

export default function DeploymentsPage() {
  const [env, setEnv] = useState('production');
  const [hours, setHours] = useState(24);
  const { data } = useSWR(
    ['deployments', env, hours],
    () => api.stats.deployments(env, hours),
    { refreshInterval: 60000 }
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#e6edf3] font-mono">Deployment View</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">Performance impact per release via ASOF JOIN</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-md border border-[#30363d] overflow-hidden">
            {ENVS.map(e => (
              <button key={e} onClick={() => setEnv(e)}
                className={`px-3 py-1.5 text-xs font-mono transition-colors ${env === e ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:bg-[#21262d]'}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-[#30363d] overflow-hidden">
            {WINDOWS.map(w => (
              <button key={w.hours} onClick={() => setHours(w.hours)}
                className={`px-3 py-1.5 text-xs font-mono transition-colors ${hours === w.hours ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:bg-[#21262d]'}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorRateChart
        timeseries={data?.timeseries ?? []}
        deployments={data?.deployments ?? []}
        title={`Error Rate & Latency — ${env}`}
      />

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d]">
          <h3 className="text-sm font-mono font-semibold text-[#e6edf3]">Deployment History</h3>
        </div>
        {(data?.deployments ?? []).map((d: any, i: number) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#21262d] text-xs font-mono">
            <Badge label={`v${d.version}`} variant="warning" />
            <span className="text-[#8b949e]">
              {d.timestamp ? format(new Date(d.timestamp), 'MMM d, HH:mm:ss') : '—'}
            </span>
            <span className="text-[#e6edf3]">by {d.deployed_by}</span>
            <span className="text-[#8b949e] flex-1 truncate">{d.notes}</span>
          </div>
        ))}
        {!data?.deployments?.length && (
          <p className="px-4 py-6 text-xs font-mono text-[#8b949e] text-center">No deployments in this window</p>
        )}
      </div>
    </div>
  );
}
