import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ArrowUpRight, Minus, ArrowDownRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

type GroupBy = 'none' | 'iwp' | 'foreman';

interface Snapshot {
  id: string;
  kind: string;
  label: string;
  week_ending: string | null;
  snapshot_date: string;
  items_count: number;
}

interface ComparisonRow {
  progress_item_id: string;
  discipline_id: string;
  discipline_name: string;
  iwp_id: string | null;
  iwp_name: string | null;
  dwg: string | null;
  description: string | null;
  foreman_user_id: string | null;
  foreman_name: string | null;
  prev_pct: number | null;
  curr_pct: number | null;
  delta_pct: number | null;
  prev_hrs: number | null;
  curr_hrs: number | null;
  delta_hrs: number | null;
  prev_qty: number | null;
  curr_qty: number | null;
  delta_qty: number | null;
  movement: 'up' | 'flat' | 'down';
}

interface Discipline { id: string; name: string }

function fmtSnap(s: Snapshot) {
  const d = s.week_ending ?? s.snapshot_date;
  const date = new Date(d).toLocaleDateString();
  return `${s.label} · ${date}`;
}

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${num.toFixed(1)}%`;
}

function fmtDelta(n: number | null | undefined, suffix = ''): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${suffix}`;
}

export default function Periods() {
  const { projectId } = useParams<{ projectId: string }>();
  const [prevId, setPrevId] = useState<string>('');
  const [currId, setCurrId] = useState<string>('');
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  const { data: snapshots } = useQuery({
    queryKey: ['snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_snapshots', { p_id: projectId });
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: !!projectId
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

  // Default snapshot selection: curr = most recent weekly, prev = second most recent (or baseline)
  useEffect(() => {
    if (!snapshots || snapshots.length === 0) return;
    if (currId && prevId) return;
    const weekly = snapshots.filter(s => s.kind === 'weekly');
    const baseline = snapshots.find(s => s.kind === 'baseline_first_audit');
    const defaultCurr = weekly[0]?.id ?? snapshots[0].id;
    const defaultPrev = weekly[1]?.id ?? baseline?.id ?? defaultCurr;
    if (!currId) setCurrId(defaultCurr);
    if (!prevId) setPrevId(defaultPrev);
  }, [snapshots, currId, prevId]);

  const { data: comparison, isLoading: isCompareLoading } = useQuery({
    queryKey: ['period_comparison', projectId, prevId, currId, disciplineFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_period_comparison', {
        p_id: projectId,
        prev_snap_id: prevId,
        curr_snap_id: currId,
        filter_discipline_id: disciplineFilter
      });
      if (error) throw error;
      return (data || []) as ComparisonRow[];
    },
    enabled: !!projectId && !!prevId && !!currId
  });

  const grouped = useMemo(() => {
    if (!comparison) return [] as { key: string; label: string; rows: ComparisonRow[] }[];
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', rows: comparison }];
    }
    const buckets = new Map<string, { key: string; label: string; rows: ComparisonRow[] }>();
    for (const r of comparison) {
      const key = groupBy === 'iwp'
        ? (r.iwp_name ?? '__no_iwp__')
        : (r.foreman_name ?? '__no_foreman__');
      const label = groupBy === 'iwp'
        ? (r.iwp_name ?? '(No IWP)')
        : (r.foreman_name ?? '(No foreman)');
      if (!buckets.has(key)) buckets.set(key, { key, label, rows: [] });
      buckets.get(key)!.rows.push(r);
    }
    return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [comparison, groupBy]);

  const summary = useMemo(() => {
    if (!comparison) return { progressed: 0, flat: 0, regressed: 0, totalDeltaHrs: 0 };
    let progressed = 0, flat = 0, regressed = 0, totalDeltaHrs = 0;
    for (const r of comparison) {
      if (r.movement === 'up') progressed++;
      else if (r.movement === 'down') regressed++;
      else flat++;
      totalDeltaHrs += Number(r.delta_hrs ?? 0);
    }
    return { progressed, flat, regressed, totalDeltaHrs };
  }, [comparison]);

  if (!projectId) return null;

  if (snapshots && snapshots.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text">Period Tracking</h2>
          <p className="text-sm text-text-muted mt-1">Compare progress across two snapshots.</p>
        </div>
        <div className="p-10 text-center text-sm border-2 border-dashed border-border rounded-md text-text-muted font-medium">
          Need at least two snapshots to compare. Upload more weekly snapshots from the Data Upload page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text">Period Tracking</h2>
        <p className="text-sm text-text-muted mt-1">Compare progress across two snapshots, by discipline / IWP / foreman.</p>
      </div>

      {/* Controls */}
      <div className="bg-surface border border-border rounded-xl shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Previous</label>
            <select value={prevId} onChange={e => setPrevId(e.target.value)}
              className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text">
              {snapshots?.map(s => <option key={s.id} value={s.id}>{fmtSnap(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Current</label>
            <select value={currId} onChange={e => setCurrId(e.target.value)}
              className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text">
              {snapshots?.map(s => <option key={s.id} value={s.id}>{fmtSnap(s)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDisciplineFilter(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${disciplineFilter === null ? 'bg-primary text-white border-primary' : 'bg-canvas text-text-muted border-border hover:border-primary'}`}
          >
            All
          </button>
          {disciplines?.map(d => (
            <button
              key={d.id}
              onClick={() => setDisciplineFilter(d.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${disciplineFilter === d.id ? 'bg-primary text-white border-primary' : 'bg-canvas text-text-muted border-border hover:border-primary'}`}
            >
              {d.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Group by</span>
          {(['none', 'iwp', 'foreman'] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 font-semibold rounded border transition-colors ${groupBy === g ? 'bg-primary-soft text-primary border-primary' : 'bg-canvas text-text-muted border-border hover:border-primary'}`}
            >
              {g === 'none' ? 'No Grouping' : g === 'iwp' ? 'By IWP' : 'By Foreman'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <SummaryBadge icon={<ArrowUpRight size={14} />} label="Items That Progressed" count={summary.progressed} variant="success" />
        <SummaryBadge icon={<Minus size={14} />} label="Items With No Movement" count={summary.flat} variant="muted" />
        {summary.regressed > 0 && (
          <SummaryBadge icon={<ArrowDownRight size={14} />} label="Items That Regressed" count={summary.regressed} variant="danger" />
        )}
        <SummaryBadge
          label="Total ΔHours"
          count={summary.totalDeltaHrs}
          variant={summary.totalDeltaHrs >= 0 ? 'success' : 'danger'}
          formatter={n => fmtDelta(n, ' hrs')}
        />
      </div>

      {/* Comparison table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F8FAFC] dark:bg-raised text-text border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">Discipline</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">IWP</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">DWG</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">Description</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Prev %</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Curr %</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Δ %</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Prev Hrs</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Curr Hrs</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Δ Hrs</th>
                <th className="px-4 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-center">Move</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isCompareLoading && (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-text-muted">Computing comparison...</td></tr>
              )}
              {!isCompareLoading && (!comparison || comparison.length === 0) && (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-text-muted">No items to compare.</td></tr>
              )}
              {!isCompareLoading && grouped.map(group => (
                <GroupRows key={group.key} group={group} groupBy={groupBy} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupRows({ group, groupBy }: { group: { key: string; label: string; rows: ComparisonRow[] }; groupBy: GroupBy }) {
  const subtotal = useMemo(() => {
    let prevHrs = 0, currHrs = 0, deltaHrs = 0;
    for (const r of group.rows) {
      prevHrs  += Number(r.prev_hrs  ?? 0);
      currHrs  += Number(r.curr_hrs  ?? 0);
      deltaHrs += Number(r.delta_hrs ?? 0);
    }
    return { prevHrs, currHrs, deltaHrs };
  }, [group.rows]);

  return (
    <>
      {groupBy !== 'none' && (
        <tr className="bg-canvas">
          <td colSpan={4} className="px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-text-muted">
            {groupBy === 'iwp' ? 'IWP: ' : 'Foreman: '}{group.label} <span className="text-text-subtle">({group.rows.length})</span>
          </td>
          <td colSpan={3}></td>
          <td className="px-4 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{fmtNum(subtotal.prevHrs, 0)}</td>
          <td className="px-4 py-2 text-right text-xs font-semibold text-text-muted tabular-nums">{fmtNum(subtotal.currHrs, 0)}</td>
          <td className={`px-4 py-2 text-right text-xs font-semibold tabular-nums ${subtotal.deltaHrs > 0 ? 'text-emerald-500' : subtotal.deltaHrs < 0 ? 'text-red-500' : 'text-text-muted'}`}>
            {fmtDelta(subtotal.deltaHrs)}
          </td>
          <td></td>
        </tr>
      )}
      {group.rows.map(r => <ItemRow key={r.progress_item_id} r={r} />)}
    </>
  );
}

function ItemRow({ r }: { r: ComparisonRow }) {
  const movement =
    r.movement === 'up'   ? <span className="text-emerald-500" title="Progressed"><ArrowUpRight size={14} /></span> :
    r.movement === 'down' ? <span className="text-red-500" title="Regressed"><ArrowDownRight size={14} /></span> :
                            <span className="text-text-subtle" title="No movement"><Minus size={14} /></span>;

  const deltaPctClass = r.delta_pct == null ? 'text-text-muted'
    : Number(r.delta_pct) > 0 ? 'text-emerald-500'
    : Number(r.delta_pct) < 0 ? 'text-red-500'
    : 'text-text-muted';
  const deltaHrsClass = r.delta_hrs == null ? 'text-text-muted'
    : Number(r.delta_hrs) > 0 ? 'text-emerald-500'
    : Number(r.delta_hrs) < 0 ? 'text-red-500'
    : 'text-text-muted';

  return (
    <tr className="hover:bg-[#F1F5F9] dark:hover:bg-raised transition-colors">
      <td className="px-4 py-2.5 text-text">{r.discipline_name}</td>
      <td className="px-4 py-2.5 text-text-muted">{r.iwp_name ?? '—'}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-primary">{r.dwg ?? '—'}</td>
      <td className="px-4 py-2.5 text-text-muted truncate max-w-[280px]">{r.description ?? '—'}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{fmtPct(r.prev_pct)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-text font-medium">{fmtPct(r.curr_pct)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${deltaPctClass}`}>{r.delta_pct == null ? '—' : fmtDelta(r.delta_pct, '%')}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{fmtNum(r.prev_hrs, 0)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-text font-medium">{fmtNum(r.curr_hrs, 0)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${deltaHrsClass}`}>{fmtDelta(r.delta_hrs)}</td>
      <td className="px-4 py-2.5 text-center">{movement}</td>
    </tr>
  );
}

function SummaryBadge({
  icon, label, count, variant, formatter
}: {
  icon?: React.ReactNode;
  label: string;
  count: number;
  variant: 'success' | 'muted' | 'danger';
  formatter?: (n: number) => string;
}) {
  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
    muted:   'bg-canvas text-text-muted border-border',
    danger:  'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50',
  }[variant];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold ${styles}`}>
      {icon}
      <span>{label}</span>
      <span className="tabular-nums">{formatter ? formatter(count) : count}</span>
    </div>
  );
}
