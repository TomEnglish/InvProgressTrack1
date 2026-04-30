import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface DisciplineMetrics {
  discipline_id: string;
  discipline_name: string;
  unit: string | null;
  total_budget: number;
  total_earned: number;
  total_actual: number;
  total_budget_qty: number;
  total_earned_qty: number;
  total_actual_qty: number;
  percent_complete: number;
  percent_complete_qty: number | null;
  total_items: number;
}

export default function DisciplineProgress() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: disciplines, isLoading } = useQuery({
    queryKey: ['discipline_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_discipline_metrics', { p_id: projectId });
      if (error) throw error;
      return (data || []) as DisciplineMetrics[];
    },
    enabled: !!projectId
  });

  if (!projectId) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text">Discipline Progress</h2>
        <p className="text-sm text-text-muted mt-1">Per-discipline budget, earned, and quantity completion.</p>
      </div>

      {isLoading && <div className="p-6 text-center text-text-muted">Loading...</div>}

      {!isLoading && (!disciplines || disciplines.length === 0) && (
        <div className="p-10 text-center text-sm border-2 border-dashed border-border rounded-md text-text-muted">
          No disciplines configured.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {disciplines?.map(d => <DisciplineCard key={d.discipline_id} d={d} />)}
      </div>
    </div>
  );
}

function DisciplineCard({ d }: { d: DisciplineMetrics }) {
  const hrsPct = Number(d.percent_complete ?? 0);
  const qtyPct = d.percent_complete_qty == null ? null : Number(d.percent_complete_qty);
  const hasQty = d.unit && d.unit !== 'HRS' && Number(d.total_budget_qty ?? 0) > 0;

  const variantClass = hrsPct >= 80 ? 'text-emerald-500'
    : hrsPct >= 40 ? 'text-amber-500'
    : 'text-text-muted';

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-text truncate">{d.discipline_name}</h3>
          <div className="text-xs text-text-muted mt-0.5">{d.total_items} item{d.total_items === 1 ? '' : 's'}{hasQty && d.unit ? ` · unit ${d.unit}` : ''}</div>
        </div>
        <div className={`text-3xl font-bold tabular-nums ${variantClass}`}>{hrsPct.toFixed(1)}%</div>
      </div>

      <div className="space-y-2">
        <ProgressBar label="Hours" earned={Number(d.total_earned)} budget={Number(d.total_budget)} pct={hrsPct} />
        {hasQty && qtyPct != null && (
          <ProgressBar
            label={`Qty (${d.unit})`}
            earned={Number(d.total_earned_qty)}
            budget={Number(d.total_budget_qty)}
            pct={qtyPct}
            color="qty"
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
        <Stat label="Budget hrs" value={Number(d.total_budget).toLocaleString()} />
        <Stat label="Earned hrs" value={Number(d.total_earned).toLocaleString()} />
        <Stat label="Actual hrs" value={Number(d.total_actual).toLocaleString()} />
      </div>

      {hasQty && (
        <div className="grid grid-cols-3 gap-2 pt-2 text-center">
          <Stat label={`Budget ${d.unit}`} value={Number(d.total_budget_qty).toLocaleString()} />
          <Stat label={`Earned ${d.unit}`} value={Number(d.total_earned_qty).toLocaleString()} />
          <Stat label={`Actual ${d.unit}`} value={Number(d.total_actual_qty).toLocaleString()} />
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, earned, budget, pct, color }: { label: string; earned: number; budget: number; pct: number; color?: 'qty' }) {
  const fill = Math.min(100, Math.max(0, pct));
  const barColor = color === 'qty' ? 'bg-amber-500' : 'bg-primary';
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="text-text-muted font-semibold">{label}</span>
        <span className="text-text-muted tabular-nums">{earned.toLocaleString()} / {budget.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-canvas border border-border rounded overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">{label}</div>
      <div className="text-sm text-text tabular-nums font-medium mt-0.5">{value}</div>
    </div>
  );
}
