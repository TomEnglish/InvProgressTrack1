import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProgressItem {
  id: string;
  dwg: string | null;
  name: string | null;
  budget_hrs: number;
  actual_hrs: number;
  earned_hrs: number;
  percent_complete: number;
  unit: string;
  budget_qty: number | null;
  earned_qty: number | null;
  actual_qty: number | null;
  foreman_name: string | null;
  discipline_id: string;
  iwp_id: string | null;
  disciplines: { name: string } | null;
  iwps: { name: string } | null;
}

interface DisciplineGroup {
  id: string;
  name: string;
  unit: string | null;
  items: ProgressItem[];
  budgetHrs: number;
  earnedHrs: number;
  pct: number;
}

export default function Audits() {
  const { projectId } = useParams<{ projectId: string }>();
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: items, isLoading } = useQuery({
    queryKey: ['progress_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_items')
        .select(`*, disciplines(name), iwps(name)`)
        .eq('project_id', projectId)
        .order('dwg');
      if (error) throw error;
      return (data || []) as ProgressItem[];
    },
    enabled: !!projectId
  });

  const groups = useMemo<DisciplineGroup[]>(() => {
    if (!items) return [];
    const buckets = new Map<string, ProgressItem[]>();
    for (const item of items) {
      const key = item.discipline_id ?? '__none__';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    const groups: DisciplineGroup[] = [];
    for (const [id, gItems] of buckets) {
      const budgetHrs = gItems.reduce((acc, i) => acc + Number(i.budget_hrs ?? 0), 0);
      const earnedHrs = gItems.reduce((acc, i) => acc + Number(i.earned_hrs ?? 0), 0);
      groups.push({
        id,
        name: gItems[0]?.disciplines?.name ?? 'Unassigned',
        unit: gItems.find(i => i.unit && i.unit !== 'HRS')?.unit ?? null,
        items: gItems,
        budgetHrs,
        earnedHrs,
        pct: budgetHrs > 0 ? (earnedHrs / budgetHrs) * 100 : 0,
      });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const matchedFilter = (i: ProgressItem) => {
    if (!filterText.trim()) return true;
    const t = filterText.toLowerCase();
    return (i.dwg ?? '').toLowerCase().includes(t)
        || (i.name ?? '').toLowerCase().includes(t)
        || (i.iwps?.name ?? '').toLowerCase().includes(t)
        || (i.foreman_name ?? '').toLowerCase().includes(t);
  };

  const filteredGroups = useMemo(() => {
    return groups
      .map(g => ({ ...g, items: g.items.filter(matchedFilter) }))
      .filter(g => g.items.length > 0);
  }, [groups, filterText]);

  // Auto-expand groups that match filter
  useEffect(() => {
    if (filterText.trim()) {
      setExpanded(new Set(filteredGroups.map(g => g.id)));
    }
  }, [filterText, filteredGroups]);

  if (!projectId) return null;

  const expandAll   = () => setExpanded(new Set(filteredGroups.map(g => g.id)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Progress Audits</h2>
          <p className="text-sm text-text-muted mt-1">Drill into line items by discipline.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-semibold bg-canvas border border-border text-text rounded hover:bg-raised transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-semibold bg-canvas border border-border text-text rounded hover:bg-raised transition-colors"
          >
            Collapse All
          </button>
          <input
            type="text"
            placeholder="Filter IWP, DWG, foreman..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="p-2.5 text-sm bg-surface border border-border rounded-md focus:border-primary outline-none focus:ring-1 focus:ring-primary-soft w-72"
          />
        </div>
      </div>

      {isLoading && (
        <div className="p-6 text-center text-text-muted">Loading items...</div>
      )}
      {!isLoading && filteredGroups.length === 0 && (
        <div className="p-10 text-center text-sm border-2 border-dashed border-border rounded-md text-text-muted">
          {filterText ? 'No items match the filter.' : 'No progress items recorded yet.'}
        </div>
      )}

      <div className="space-y-3">
        {filteredGroups.map(g => (
          <DisciplineAccordion key={g.id} group={g} isOpen={expanded.has(g.id)} onToggle={() => toggle(g.id)} />
        ))}
      </div>
    </div>
  );
}

function DisciplineAccordion({ group, isOpen, onToggle }: { group: DisciplineGroup; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="bg-surface border border-border rounded-md shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
      >
        <ChevronRight size={16} className={`text-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <div className="flex-1 flex items-center justify-between gap-4">
          <div className="text-left">
            <div className="text-sm font-semibold text-text">{group.name} Audit</div>
            <div className="text-xs text-text-muted">{group.items.length} item{group.items.length === 1 ? '' : 's'}</div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-xs tabular-nums">
            <span className="text-text-muted">Budget: <span className="text-text font-medium">{group.budgetHrs.toLocaleString()} hrs</span></span>
            <span className="text-text-muted">Earned: <span className="text-text font-medium">{group.earnedHrs.toLocaleString()} hrs</span></span>
            <span className={`px-2 py-1 rounded text-[11px] font-bold ${group.pct >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : group.pct >= 40 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-canvas text-text-muted'}`}>
              {group.pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-canvas border-b border-border">
              <tr>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">DWG</th>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">Description</th>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">IWP</th>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">Foreman</th>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold text-right">Budget Hrs</th>
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold text-right">Earned Hrs</th>
                {group.unit && (
                  <>
                    <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold text-right">Budget {group.unit}</th>
                    <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold text-right">Earned {group.unit}</th>
                  </>
                )}
                <th className="p-2.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold text-right">% Complete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {group.items.map(i => (
                <tr key={i.id} className="hover:bg-raised transition-colors">
                  <td className="p-2.5 text-xs font-mono text-primary font-semibold">{i.dwg ?? '—'}</td>
                  <td className="p-2.5 text-sm text-text-muted">{i.name ?? '—'}</td>
                  <td className="p-2.5 text-sm text-text-muted">{i.iwps?.name ?? '—'}</td>
                  <td className="p-2.5 text-sm text-text-muted">{i.foreman_name ?? '—'}</td>
                  <td className="p-2.5 text-sm text-text tabular-nums text-right">{Number(i.budget_hrs).toLocaleString()}</td>
                  <td className="p-2.5 text-sm text-text font-medium tabular-nums text-right">{Number(i.earned_hrs).toLocaleString()}</td>
                  {group.unit && (
                    <>
                      <td className="p-2.5 text-sm text-text tabular-nums text-right">{i.budget_qty == null ? '—' : Number(i.budget_qty).toLocaleString()}</td>
                      <td className="p-2.5 text-sm text-text font-medium tabular-nums text-right">{i.earned_qty == null ? '—' : Number(i.earned_qty).toLocaleString()}</td>
                    </>
                  )}
                  <td className="p-2.5 text-sm font-semibold text-right tabular-nums">
                    <span className={Number(i.percent_complete) >= 100 ? 'text-emerald-500' : 'text-text'}>
                      {Number(i.percent_complete).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
