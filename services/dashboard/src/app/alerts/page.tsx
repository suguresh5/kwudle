'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

interface AlertForm {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  threshold: string;
  window_seconds: string;
  notify_channel: string;
  notify_webhook: string;
}

const DEFAULT_FORM: AlertForm = {
  metric: 'error_rate',
  operator: 'gt',
  threshold: '5',
  window_seconds: '300',
  notify_channel: 'slack',
  notify_webhook: '',
};

export default function AlertsPage() {
  const { data: rules, isLoading, mutate } = useSWR('alerts', api.alerts.list, { refreshInterval: 30000 });
  const [form, setForm] = useState<AlertForm>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.alerts.create({
        ...form,
        threshold: parseFloat(form.threshold),
        window_seconds: parseInt(form.window_seconds),
      });
      setForm(DEFAULT_FORM);
      setShowForm(false);
      mutate();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.alerts.delete(id);
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e6edf3] font-mono">Alert Manager</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">Threshold rules — polled every 60s, 5-min re-fire guard</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-xs font-mono bg-[#388bfd] text-white rounded-md hover:bg-[#58a6ff] transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ New Rule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#161b22] border border-[#388bfd] rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-mono font-semibold text-[#58a6ff]">New Alert Rule</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Metric', key: 'metric', type: 'text', placeholder: 'error_rate' },
              { label: 'Threshold', key: 'threshold', type: 'number', placeholder: '5' },
              { label: 'Window (seconds)', key: 'window_seconds', type: 'number', placeholder: '300' },
              { label: 'Notify Channel', key: 'notify_channel', type: 'text', placeholder: 'slack' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-[10px] font-mono text-[#8b949e] uppercase mb-1">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-xs font-mono text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
                  required
                />
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-mono text-[#8b949e] uppercase mb-1">Operator</label>
              <select
                value={form.operator}
                onChange={e => setForm(f => ({ ...f, operator: e.target.value as any }))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-xs font-mono text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
              >
                <option value="gt">gt (greater than)</option>
                <option value="lt">lt (less than)</option>
                <option value="eq">eq (equal to)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[#8b949e] uppercase mb-1">Webhook URL</label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/..."
                value={form.notify_webhook}
                onChange={e => setForm(f => ({ ...f, notify_webhook: e.target.value }))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-xs font-mono text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
                required
              />
            </div>
          </div>
          <button type="submit" disabled={creating}
            className="px-4 py-2 text-xs font-mono bg-[#388bfd] text-white rounded-md hover:bg-[#58a6ff] transition-colors disabled:opacity-50">
            {creating ? 'Creating…' : 'Create Rule'}
          </button>
        </form>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 border-b border-[#30363d] text-[10px] font-mono text-[#8b949e] uppercase tracking-wider">
          <span className="col-span-2">Metric / Condition</span>
          <span>Window</span><span>Channel</span><span>Last Fired</span><span>Action</span>
        </div>
        {isLoading
          ? [...Array(3)].map((_, i) => <div key={i} className="h-12 mx-4 my-2 rounded bg-[#21262d] animate-pulse" />)
          : (rules ?? []).map((rule: any) => (
              <div key={rule.id} className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-[#21262d] text-xs font-mono hover:bg-[#21262d] transition-colors items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <Badge label={rule.active ? 'active' : 'paused'} variant={rule.active ? 'success' : 'default'} />
                  <span className="text-[#e6edf3]">{rule.metric}</span>
                  <span className="text-[#8b949e]">{rule.operator}</span>
                  <span className="text-[#d29922]">{rule.threshold}</span>
                </div>
                <span className="text-[#8b949e]">{rule.window_seconds}s</span>
                <span className="text-[#8b949e] capitalize">{rule.notify_channel}</span>
                <span className="text-[#8b949e]">
                  {rule.last_fired_at ? format(new Date(rule.last_fired_at), 'MMM d HH:mm') : 'Never'}
                </span>
                <button onClick={() => handleDelete(rule.id)}
                  className="text-[#f85149] hover:text-[#ff6b6b] transition-colors text-left">
                  Revoke
                </button>
              </div>
            ))}
        {!rules?.length && !isLoading && (
          <p className="px-4 py-6 text-xs font-mono text-[#8b949e] text-center">No alert rules configured</p>
        )}
      </div>
    </div>
  );
}
