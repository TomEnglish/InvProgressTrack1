import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import KpiCard from '../components/ui/KpiCard';
import DisciplineChart from '../components/ui/DisciplineChart';
import SCurveChart from '../components/ui/SCurveChart';

export default function Overview() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;

  // Fetch KPI Summaries
  const { data: projectMetrics, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_metrics', { p_id: projectId });
      if (error) throw error;
      return data?.[0] || null;
    }
  });

  // Fetch Discipline array
  const { data: disciplines, isLoading: isDisciplineLoading } = useQuery({
    queryKey: ['discipline_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_discipline_metrics', { p_id: projectId });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch historic S-Curve traces
  const { data: snapshots, isLoading: isSnapshotsLoading } = useQuery({
    queryKey: ['period_snapshots_curve', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('period_snapshots').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: qtyRollup } = useQuery({
    queryKey: ['project_qty_rollup', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_qty_rollup', { p_id: projectId });
      if (error) throw error;
      return data?.[0] ?? null;
    }
  });

  if (isProjectLoading || isDisciplineLoading || isSnapshotsLoading) {
    return <div className="p-8 text-center text-text-muted font-medium">Resolving Supabase Analytics Dashboard...</div>;
  }

  const kpis = projectMetrics || {
     percent_complete: 0, total_earned: 0, total_budget: 0, cpi: 0, spi: 0, sv: 0, total_items: 0
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap lg:flex-nowrap gap-3">
        <KpiCard 
          label="Overall Progress" 
          value={`${kpis.percent_complete}%`} 
          subValue={`${Number(kpis.total_earned).toLocaleString()} / ${Number(kpis.total_budget).toLocaleString()} hrs`} 
        />
        <KpiCard 
          label="CPI" 
          value={kpis.cpi} 
          subValue={kpis.cpi >= 1 ? 'Under budget' : 'Over budget'} 
          variant={kpis.cpi >= 1 ? 'success' : 'warn'} 
        />
        <KpiCard 
          label="SPI" 
          value={kpis.spi} 
          subValue={kpis.spi >= 1 ? 'Ahead of schedule' : 'Behind schedule'} 
          variant={kpis.spi >= 1 ? 'success' : 'danger'} 
        />
        <KpiCard 
          label="Schedule Var" 
          value={`${Number(kpis.sv).toLocaleString()} hrs`} 
          subValue="SV = EV - PV" 
          variant={kpis.sv >= 0 ? 'success' : 'danger'} 
        />
        <KpiCard
          label="Total Tracked Items"
          value={kpis.total_items}
          subValue={`${disciplines.length} Disciplines`}
        />
        {qtyRollup && (
          <KpiCard
            label="Composite % (qty)"
            value={`${Number(qtyRollup.composite_pct).toFixed(1)}%`}
            subValue={qtyRollup.mode === 'hours_weighted' ? 'Hours-weighted' : qtyRollup.mode === 'equal' ? 'Equal-weighted' : 'Custom weights'}
          />
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Discipline Analytics rendered via dynamic RPC */}
        <div className="bg-surface rounded-md shadow-sm overflow-hidden border border-border">
          <div className="px-4 py-3 border-b border-border text-[13px] font-semibold text-text">Discipline Completion Variance</div>
          <div className="p-4 h-[350px] w-full">
               <DisciplineChart data={disciplines || []} />
          </div>
        </div>

        {/* Temporal Graphic parsed via direct React Query mapping */}
        <div className="bg-surface rounded-md shadow-sm overflow-hidden border border-border">
          <div className="px-4 py-3 border-b border-border text-[13px] font-semibold text-text">Cumulative Project S-Curve</div>
          <div className="p-4 h-[350px] w-full">
               <SCurveChart snapshots={snapshots || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
