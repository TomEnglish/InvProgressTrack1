import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import HalfGauge from '../components/ui/HalfGauge';

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

interface Discipline { id: string; name: string }
interface MyProject { id: string; name: string }

const NO_IWP = '__no_iwp__';

export default function Audits() {
  const { projectId } = useParams<{ projectId: string }>();
  const [auditDisciplineId, setAuditDisciplineId] = useState<string>('');
  const [iwpFilter,     setIwpFilter]     = useState<string>('');
  const [dwgFilter,     setDwgFilter]     = useState<string>('');
  const [foremanFilter, setForemanFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: project } = useQuery({
    queryKey: ['my_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_projects');
      if (error) throw error;
      return (data || []) as MyProject[];
    },
    select: rows => rows.find(p => p.id === projectId) ?? null
  });

  const { data: disciplines } = useQuery({
    queryKey: ['disciplines', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('disciplines').select('id, name').eq('project_id', projectId).order('name');
      if (error) throw error;
      return (data || []) as Discipline[];
    },
    enabled: !!projectId
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['progress_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_items')
        .select('*, disciplines(name), iwps(name)')
        .eq('project_id', projectId)
        .order('dwg');
      if (error) throw error;
      return (data || []) as ProgressItem[];
    },
    enabled: !!projectId
  });

  // Default audit discipline = first discipline (or first one with items)
  useEffect(() => {
    if (auditDisciplineId || !disciplines || disciplines.length === 0) return;
    if (!items) return;
    const withItems = disciplines.find(d => items.some(i => i.discipline_id === d.id));
    setAuditDisciplineId((withItems ?? disciplines[0]).id);
  }, [disciplines, items, auditDisciplineId]);

  // Derived sets for filter dropdowns (constrained to active audit-type)
  const itemsForAudit = useMemo(() => {
    if (!items || !auditDisciplineId) return [];
    return items.filter(i => i.discipline_id === auditDisciplineId);
  }, [items, auditDisciplineId]);

  const iwpOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of itemsForAudit) set.add(i.iwps?.name ?? NO_IWP);
    return Array.from(set).sort((a, b) => a === NO_IWP ? 1 : b === NO_IWP ? -1 : a.localeCompare(b));
  }, [itemsForAudit]);

  const dwgOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of itemsForAudit) if (i.dwg) set.add(i.dwg);
    return Array.from(set).sort();
  }, [itemsForAudit]);

  const foremanOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of itemsForAudit) if (i.foreman_name) set.add(i.foreman_name);
    return Array.from(set).sort();
  }, [itemsForAudit]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return itemsForAudit.filter(i => {
      if (iwpFilter && (i.iwps?.name ?? NO_IWP) !== iwpFilter) return false;
      if (dwgFilter && i.dwg !== dwgFilter) return false;
      if (foremanFilter && (i.foreman_name ?? '') !== foremanFilter) return false;
      return true;
    });
  }, [itemsForAudit, iwpFilter, dwgFilter, foremanFilter]);

  // Group by IWP
  const iwpGroups = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; items: ProgressItem[] }>();
    for (const i of filteredItems) {
      const key = i.iwps?.name ?? NO_IWP;
      const label = i.iwps?.name ?? '(No IWP)';
      if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
      buckets.get(key)!.items.push(i);
    }
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.key === NO_IWP) return 1;
      if (b.key === NO_IWP) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredItems]);

  // Sidebar KPIs (filtered totals)
  const totals = useMemo(() => {
    let budgetHrs = 0, earnedHrs = 0, budgetQty = 0, earnedQty = 0;
    for (const i of filteredItems) {
      budgetHrs += Number(i.budget_hrs ?? 0);
      earnedHrs += Number(i.earned_hrs ?? 0);
      budgetQty += Number(i.budget_qty ?? 0);
      earnedQty += Number(i.earned_qty ?? 0);
    }
    return { budgetHrs, earnedHrs, budgetQty, earnedQty };
  }, [filteredItems]);

  const auditUnit = useMemo(() => {
    const u = filteredItems.find(i => i.unit && i.unit !== 'HRS')?.unit;
    return u ?? 'units';
  }, [filteredItems]);

  if (!projectId) return null;

  const expandAll   = () => setExpanded(new Set(iwpGroups.map(g => g.key)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (k: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const activeDisciplineName = disciplines?.find(d => d.id === auditDisciplineId)?.name ?? '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 animate-fade-in">
      {/* Sidebar */}
      <aside className="bg-surface border border-border rounded-xl shadow-sm p-4 space-y-4 self-start">
        <FilterSelect label="Audit Type" value={auditDisciplineId} onChange={setAuditDisciplineId}
          options={disciplines?.map(d => ({ value: d.id, label: `${d.name} Audit` })) ?? []}
          allLabel={null}
        />
        <FilterSelect label="IWP" value={iwpFilter} onChange={setIwpFilter}
          options={iwpOptions.map(v => ({ value: v, label: v === NO_IWP ? '(No IWP)' : v }))}
        />
        <FilterSelect label="DWG" value={dwgFilter} onChange={setDwgFilter}
          options={dwgOptions.map(v => ({ value: v, label: v }))}
        />
        <FilterSelect label="IWP Foreman" value={foremanFilter} onChange={setForemanFilter}
          options={foremanOptions.map(v => ({ value: v, label: v }))}
        />

        <div className="pt-4 border-t border-border space-y-1 text-center">
          <div className="text-3xl font-bold text-text tabular-nums">{Math.round(totals.earnedHrs).toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Earned Hours</div>
        </div>

        {totals.budgetQty > 0 && (
          <div className="space-y-1 text-center">
            <div className="text-3xl font-bold text-text tabular-nums">{Math.round(totals.earnedQty).toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Earned {auditUnit}</div>
          </div>
        )}

        <HalfGauge earned={totals.earnedHrs} total={totals.budgetHrs || totals.earnedHrs || 1} label="Earned Hours" color="#10b981" />
        {totals.budgetQty > 0 && (
          <HalfGauge earned={totals.earnedQty} total={totals.budgetQty || totals.earnedQty || 1} label={`Earned ${auditUnit}`} color="#10b981" />
        )}
      </aside>

      {/* Main panel */}
      <section className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-[#1e293b] dark:bg-[#0f172a] text-white px-5 py-4 flex items-center gap-4">
          <div className="text-sm font-bold tracking-wide uppercase opacity-90">
            {project?.name ?? 'Project'} — Progress Audit:
          </div>
          <div className="text-base font-bold">{activeDisciplineName} Audit</div>
          <div className="ml-auto text-sm opacity-80 tabular-nums">{filteredItems.length} items</div>
        </div>

        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 bg-canvas">
          <div className="flex items-center gap-2">
            <select disabled className="text-xs px-2 py-1.5 bg-surface border border-border rounded text-text-muted">
              <option>Current (Latest)</option>
            </select>
            <button onClick={expandAll} className="px-3 py-1.5 text-xs font-semibold bg-surface border border-border text-text rounded hover:bg-raised transition-colors inline-flex items-center gap-1">
              <ChevronRight size={12} className="rotate-90" /> Expand All
            </button>
            <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-semibold bg-surface border border-border text-text rounded hover:bg-raised transition-colors inline-flex items-center gap-1">
              <ChevronRight size={12} /> Collapse All
            </button>
          </div>
          <div className="text-xs text-text-muted tabular-nums">
            {iwpGroups.length} group{iwpGroups.length === 1 ? '' : 's'} · {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left">
            <thead className="bg-[#1e293b] dark:bg-[#0f172a] text-white text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 font-semibold">IWP / DWG</th>
                <th className="px-3 py-2.5 font-semibold text-right">% Hrs</th>
                <th className="px-3 py-2.5 font-semibold text-right">Ern Hrs</th>
                <th className="px-3 py-2.5 font-semibold text-right">% Qty</th>
                <th className="px-3 py-2.5 font-semibold text-right">Ern Qty</th>
                <th className="px-3 py-2.5 font-semibold text-right">Hours</th>
                <th className="px-3 py-2.5 font-semibold">Foreman</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-text-muted">Loading items...</td></tr>
              )}
              {!isLoading && iwpGroups.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-text-muted">No items match the current filters.</td></tr>
              )}
              {!isLoading && iwpGroups.map(g => (
                <IwpRows key={g.key} group={g} isOpen={expanded.has(g.key)} onToggle={() => toggle(g.key)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel = 'All' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string | null;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full p-2 bg-canvas border border-border rounded text-sm text-text outline-none focus:border-primary">
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function IwpRows({ group, isOpen, onToggle }: { group: { key: string; label: string; items: ProgressItem[] }; isOpen: boolean; onToggle: () => void }) {
  const subtotal = useMemo(() => {
    let budgetHrs = 0, earnedHrs = 0, budgetQty = 0, earnedQty = 0;
    for (const i of group.items) {
      budgetHrs += Number(i.budget_hrs ?? 0);
      earnedHrs += Number(i.earned_hrs ?? 0);
      budgetQty += Number(i.budget_qty ?? 0);
      earnedQty += Number(i.earned_qty ?? 0);
    }
    return {
      budgetHrs, earnedHrs, budgetQty, earnedQty,
      pctHrs: budgetHrs > 0 ? (earnedHrs / budgetHrs) * 100 : 0,
      pctQty: budgetQty > 0 ? (earnedQty / budgetQty) * 100 : null,
    };
  }, [group.items]);

  return (
    <>
      <tr className="bg-canvas hover:bg-raised cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 text-sm font-semibold text-text">
          <span className="inline-flex items-center gap-2">
            <ChevronRight size={14} className={`text-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            <span className="font-mono">{group.label}</span>
            <span className="text-xs text-text-muted font-normal">({group.items.length} items · {subtotal.pctHrs.toFixed(1)}% earned)</span>
          </span>
        </td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{subtotal.pctHrs.toFixed(1)}%</td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{Math.round(subtotal.earnedHrs).toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{subtotal.pctQty == null ? '—' : `${subtotal.pctQty.toFixed(1)}%`}</td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{subtotal.budgetQty > 0 ? Math.round(subtotal.earnedQty).toLocaleString() : '—'}</td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{Math.round(subtotal.budgetHrs).toLocaleString()}</td>
        <td colSpan={2}></td>
      </tr>
      {isOpen && group.items.map(i => <DwgRow key={i.id} i={i} />)}
    </>
  );
}

function DwgRow({ i }: { i: ProgressItem }) {
  const pctHrs = Number(i.percent_complete ?? 0);
  const pctQty = i.budget_qty && Number(i.budget_qty) > 0
    ? (Number(i.earned_qty ?? 0) / Number(i.budget_qty)) * 100
    : null;
  return (
    <tr className="hover:bg-raised transition-colors">
      <td className="px-3 py-2 text-sm font-mono text-primary pl-9">{i.dwg ?? '—'}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{pctHrs.toFixed(1)}%</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums font-medium text-text">{Number(i.earned_hrs ?? 0).toFixed(1)}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{pctQty == null ? '—' : `${pctQty.toFixed(1)}%`}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums font-medium text-text">{i.budget_qty == null ? '—' : Number(i.earned_qty ?? 0).toFixed(0)}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-text-muted">{Number(i.budget_hrs ?? 0).toFixed(1)}</td>
      <td className="px-3 py-2 text-sm text-text-muted">{i.foreman_name ?? '—'}</td>
      <td className="px-3 py-2 text-sm text-text-muted truncate max-w-[260px]">{i.name ?? '—'}</td>
    </tr>
  );
}
