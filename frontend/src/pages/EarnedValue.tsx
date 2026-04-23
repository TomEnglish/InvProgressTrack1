import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Snapshot {
  id: string;
  snapshot_date: string;
  label: string;
  total_budget: number;
  total_earned: number;
  total_actual: number;
  spi: number;
  cpi: number;
}

export default function EarnedValue() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const { data, error } = await supabase
          .from('period_snapshots')
          .select('*')
          .order('snapshot_date', { ascending: true });

        if (error) throw error;
        setSnapshots(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, []);

  if (loading) return <div className="p-4 text-text-muted">Loading Earned Value Data...</div>;
  if (error) return <div className="p-4 text-red-500 font-semibold">Error: {error}</div>;

  return (
    <div className="space-y-6 animate-fade-in transition-all">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Earned Value Management</h2>
          <p className="text-sm text-text-muted mt-1">Period-over-period tracking of schedule and cost performance.</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#F8FAFC] dark:bg-[#1E293B] text-text border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wide">Period</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Planned Value (PV)</th>
                <th className="px-6 py-4 font-semibold text-right">Earned Value (EV)</th>
                <th className="px-6 py-4 font-semibold text-right">Actual Cost (AC)</th>
                <th className="px-6 py-4 font-semibold text-right">Schedule Var (SV)</th>
                <th className="px-6 py-4 font-semibold text-right">Cost Var (CV)</th>
                <th className="px-6 py-4 font-semibold text-center">SPI</th>
                <th className="px-6 py-4 font-semibold text-center">CPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-text-muted">
                    No earned value snapshots recorded.
                  </td>
                </tr>
              ) : (
                snapshots.map((snap) => {
                  const sv = snap.total_earned - snap.total_budget;
                  const cv = snap.total_earned - snap.total_actual;
                  
                  return (
                    <tr key={snap.id} className="hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors">
                      <td className="px-6 py-4 font-medium text-text">{snap.label}</td>
                      <td className="px-6 py-4 text-text-muted">{new Date(snap.snapshot_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-text">{snap.total_budget.toLocaleString()} hrs</td>
                      <td className="px-6 py-4 text-right tabular-nums text-text font-medium">{snap.total_earned.toLocaleString()} hrs</td>
                      <td className="px-6 py-4 text-right tabular-nums text-text">{snap.total_actual.toLocaleString()} hrs</td>
                      <td className={`px-6 py-4 text-right tabular-nums font-semibold ${sv < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {sv > 0 ? '+' : ''}{sv.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-right tabular-nums font-semibold ${cv < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {cv > 0 ? '+' : ''}{cv.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-md tracking-wider ${snap.spi < 1.0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          {snap.spi.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-md tracking-wider ${snap.cpi < 1.0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          {snap.cpi.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
