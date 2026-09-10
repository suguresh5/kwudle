import { clsx } from 'clsx';
interface BadgeProps { label: string; variant?: 'success' | 'danger' | 'warning' | 'default'; }
export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wide',
      variant === 'success' && 'bg-[#3fb95020] text-[#3fb950] border border-[#3fb95040]',
      variant === 'danger'  && 'bg-[#f8514920] text-[#f85149] border border-[#f8514940]',
      variant === 'warning' && 'bg-[#d2992220] text-[#d29922] border border-[#d2992240]',
      variant === 'default' && 'bg-[#30363d] text-[#8b949e] border border-[#30363d]',
    )}>{label}</span>
  );
}
