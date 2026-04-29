import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Badge from '../components/ui/Badge';

export default function Audits() {
  const { projectId } = useParams<{ projectId: string }>();
  const [filterText, setFilterText] = useState('');
  if (!projectId) return null;

  const { data: items, isLoading } = useQuery({
    queryKey: ['progress_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_items')
        .select(`*, disciplines(name), iwps(name)`)
        .eq('project_id', projectId)
        .order('dwg');
      if (error) throw error;
      return data;
    }
  });

  const filteredItems = items?.filter((item: any) => 
    (item.dwg && item.dwg.toLowerCase().includes(filterText.toLowerCase())) ||
    (item.iwps?.name && item.iwps.name.toLowerCase().includes(filterText.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-text">Progress Audits</h2>
          <p className="text-sm text-text-muted mt-1">Line-item drill down for budget vs earned execution.</p>
        </div>
        <input 
          type="text" 
          placeholder="Filter IWP, DWG, ISO..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="p-2.5 text-sm bg-surface border border-border rounded-md focus:border-primary outline-none focus:ring-1 focus:ring-primary-soft w-72"
        />
      </div>

      <div className="bg-surface rounded-md shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
             <thead className="bg-raised border-b border-border sticky top-0 z-10 shadow-sm">
               <tr>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">ISO / DWG</th>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">Discipline</th>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">IWP</th>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">Budget (hrs)</th>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">Earned (hrs)</th>
                 <th className="p-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold">% Complete</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-border">
               {isLoading && <tr><td colSpan={6} className="p-6 text-center text-sm font-medium text-text-muted tracking-wide">Fetching Secure Line Items...</td></tr>}
               {!isLoading && filteredItems.length === 0 && (
                 <tr><td colSpan={6} className="p-8 text-center text-sm text-text-muted">No line items match criteria.</td></tr>
               )}
               {filteredItems.map((item: any) => (
                 <tr key={item.id} className="hover:bg-raised transition-colors">
                   <td className="p-3 text-sm font-mono text-primary font-semibold">{item.dwg ?? 'N/A'}</td>
                   <td className="p-3 text-sm text-text"><Badge variant="info">{item.disciplines?.name || 'Unassigned'}</Badge></td>
                   <td className="p-3 text-sm text-text font-medium">{item.iwps?.name || '--'}</td>
                   <td className="p-3 text-sm text-text font-medium">{Number(item.budget_hrs).toLocaleString()}</td>
                   <td className="p-3 text-sm text-text font-medium">{Number(item.earned_hrs).toLocaleString()}</td>
                   <td className="p-3 text-sm font-semibold">
                      <span className={item.percent_complete >= 100 ? 'text-success' : 'text-text'}>{Number(item.percent_complete).toFixed(1)}%</span>
                   </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
