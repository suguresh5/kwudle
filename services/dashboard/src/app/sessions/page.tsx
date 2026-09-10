'use client';
import useSWR from 'swr';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSWR(
    'sessions',
    () => api.stats.sessions(100),
    { refreshInterval: 30000 }
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e6edf3] font-mono">Session Explorer</h1>
        <p className="text-sm text-[#8b949e] mt-0.5">Stitched sessions via 30-minute gap strategy</p>
      </div>
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-4 px-4 py-2 border-b border-[#30363d] text-[10px] font-mono text-[#8b949e] uppercase tracking-wider">
          <span>User</span><span>Start</span><span>Duration</span>
          <span>Pages</span><span>Events</span><span>Device</span><span>Status</span>
        </div>
        {isLoading
          ? [...Array(8)].map((_, i) => (
              <div key={i} className="h-12 mx-4 my-2 rounded bg-[#21262d] animate-pulse" />
            ))
          : (sessions ?? []).map((s: any, i: number) => (
              <div
                key={s.session_id ?? i}
                className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-[#21262d] text-xs font-mono hover:bg-[#21262d] transition-colors"
              >
                <span className="text-[#58a6ff] truncate">{s.user_id?.slice(0, 8) ?? '—'}</span>
                <span className="text-[#8b949e]">
                  {s.session_start ? format(new Date(s.session_start), 'MMM d HH:mm') : '—'}
                </span>
                <span className="text-[#e6edf3]">
                  {s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—'}
                </span>
                <span className="text-[#e6edf3]">{s.page_depth ?? 0}</span>
                <span className="text-[#e6edf3]">{s.event_count ?? 0}</span>
                <span className="text-[#8b949e] capitalize">{s.device_type ?? 'unknown'}</span>
                <span>
                  {s.converted
                    ? <Badge label="converted" variant="success" />
                    : <Badge label="browsed" variant="default" />}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
