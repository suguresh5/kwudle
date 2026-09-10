import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent?: boolean;
}

export function StatCard({ label, value, sub, trend, accent }: StatCardProps) {
  return (
    <div className={clsx(
      'rounded-lg border p-4',
      accent ? 'border-[#388bfd] bg-[#161b22]' : 'border-[#30363d] bg-[#161b22]'
    )}>
      <p className="text-[11px] font-mono text-[#8b949e] uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx('text-2xl font-semibold font-mono', accent ? 'text-[#58a6ff]' : 'text-[#e6edf3]')}>
        {value}
      </p>
      {sub && (
        <p className={clsx(
          'text-xs mt-1',
          trend === 'up' ? 'text-[#3fb950]' :
          trend === 'down' ? 'text-[#f85149]' : 'text-[#8b949e]'
        )}>{sub}</p>
      )}
    </div>
  );
}
