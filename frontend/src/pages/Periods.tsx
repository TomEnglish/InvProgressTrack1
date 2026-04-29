import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import KpiCard from '../components/ui/KpiCard';

export default function Periods() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['period_snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('period_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const latest = snapshots?.[0];
  const previous = snapshots?.[1];

  const calculateDelta = (current: number, past: number) => {
    if (!past) return 0;
    return current - past;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Period Tracking</h2>
        <p className="text-sm text-text-muted mt-1">Snapshot variance mapping indicating historical earned trending across periods.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted font-medium">Resolving historical snapshots...</div>
      ) : snapshots && snapshots.length >= 2 ? (
        <div className="space-y-6">
          <div className="flex gap-4 p-4 border border-border bg-surface shadow-sm rounded-md items-center">
             <div className="text-sm">
                <span className="font-semibold tracking-wide uppercase text-[12px] opacity-70 mr-2">Comparing Pipeline:</span> 
                <span className="text-primary font-semibold">{latest.label}</span> 
                <span className="mx-2 text-text-muted">vs</span> 
                <span className="text-primary font-semibold opacity-75">{previous.label}</span>
             </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
             <KpiCard 
               label="Earned Delta" 
               value={`${calculateDelta(latest.total_earned, previous.total_earned) >= 0 ? '+' : ''}${calculateDelta(latest.total_earned, previous.total_earned).toLocaleString()} hrs`} 
               variant={calculateDelta(latest.total_earned, previous.total_earned) >= 0 ? 'success' : 'danger'} 
               subValue="Movement between snapshots"
             />
             <KpiCard 
               label="CPI Variance" 
               value={`${calculateDelta(latest.cpi, previous.cpi) >= 0 ? '+' : ''}${calculateDelta(latest.cpi, previous.cpi).toFixed(2)}`} 
               variant={calculateDelta(latest.cpi, previous.cpi) >= 0 ? 'success' : 'danger'} 
               subValue={`Current CPI is ${latest.cpi}`}
             />
             <KpiCard 
               label="SPI Variance" 
               value={`${calculateDelta(latest.spi, previous.spi) >= 0 ? '+' : ''}${calculateDelta(latest.spi, previous.spi).toFixed(2)}`} 
               variant={calculateDelta(latest.spi, previous.spi) >= 0 ? 'success' : 'danger'} 
               subValue={`Current SPI is ${latest.spi}`}
             />
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-sm border-2 border-dashed border-border rounded-md text-text-muted font-medium">
           Not enough historical period snapshots exist in the database to compare variant trending.
           <br/>
           <span className="text-xs opacity-75 mt-2 block">Upload more pipeline phases via the Data Upload utility.</span>
        </div>
      )}
    </div>
  );
}
