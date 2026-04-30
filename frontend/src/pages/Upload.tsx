import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Upload as UploadIcon, FileSpreadsheet, X, History, AlertTriangle, CheckCircle } from 'lucide-react';
import { uploadProgressData } from '../lib/api';
import { supabase } from '../lib/supabase';
import { parseAuditFile, detectAuditDiscipline, recentSundayISO, type ParsedRow } from '../lib/auditParser';

interface Discipline { id: string; name: string }
interface SnapshotRow {
  id: string;
  kind: string;
  label: string;
  week_ending: string | null;
  snapshot_date: string;
  source_filename: string | null;
  uploaded_by_email: string | null;
  uploaded_at: string;
  total_budget: number;
  total_earned: number;
  items_count: number;
}

type FileStatus = 'parsing' | 'parsed' | 'error';
interface StagedFile {
  id: string;
  file: File;
  auditTypeId?: string;
  status: FileStatus;
  rows: ParsedRow[];
  error?: string;
  unmapped: string[];
}

export default function Upload() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const [weekEnding, setWeekEnding] = useState(recentSundayISO());
  const [label, setLabel] = useState('');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: disciplines } = useQuery({
    queryKey: ['disciplines', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('disciplines').select('id, name').eq('project_id', projectId).order('name');
      if (error) throw error;
      return (data || []) as Discipline[];
    },
    enabled: !!projectId
  });

  const { data: snapshots } = useQuery({
    queryKey: ['snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_snapshots', { p_id: projectId });
      if (error) throw error;
      return (data || []) as SnapshotRow[];
    },
    enabled: !!projectId
  });

  const baselineSnap = snapshots?.find(s => s.kind === 'baseline_first_audit');
  const baselineItemsCount = baselineSnap?.items_count ?? 0;
  const baselineDisciplineCount = disciplines?.length ?? 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project');
      const allItems = files.flatMap(f => f.rows.map(r => ({ ...r, discipline_id: f.auditTypeId })));
      const sourceFilename = files.length === 1
        ? files[0].file.name
        : `${files[0].file.name} +${files.length - 1} more`;
      return uploadProgressData({
        projectId,
        weekEnding,
        label: label.trim() || undefined,
        sourceFilename,
        items: allItems
      });
    },
    onSuccess: () => {
      setSuccessMsg(`Snapshot saved (${files.reduce((acc, f) => acc + f.rows.length, 0)} items across ${files.length} file${files.length === 1 ? '' : 's'}).`);
      setFiles([]);
      setLabel('');
      qc.invalidateQueries({ queryKey: ['snapshots', projectId] });
      qc.invalidateQueries({ queryKey: ['project_metrics', projectId] });
      qc.invalidateQueries({ queryKey: ['discipline_metrics', projectId] });
      qc.invalidateQueries({ queryKey: ['period_snapshots_curve', projectId] });
    },
    onError: (e: Error) => setErrMsg(e.message)
  });

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  if (!projectId) return null;

  const addFiles = async (incoming: FileList | File[]) => {
    setErrMsg('');
    setSuccessMsg('');
    const arr = Array.from(incoming);
    const staged: StagedFile[] = arr.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      auditTypeId: detectAuditDiscipline(file.name, disciplines ?? []),
      status: 'parsing',
      rows: [],
      unmapped: []
    }));
    setFiles(prev => [...prev, ...staged]);
    for (const sf of staged) {
      try {
        const result = await parseAuditFile(sf.file);
        setFiles(prev => prev.map(f => f.id === sf.id
          ? { ...f, status: 'parsed', rows: result.rows, unmapped: result.unmappedHeaders }
          : f));
      } catch (e) {
        setFiles(prev => prev.map(f => f.id === sf.id
          ? { ...f, status: 'error', error: (e as Error).message }
          : f));
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.length) addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const setAuditType = (id: string, auditTypeId: string) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, auditTypeId } : f));

  const allReady = files.length > 0
    && files.every(f => f.status === 'parsed' && f.auditTypeId)
    && !!weekEnding;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">Weekly Snapshot</h2>
          <p className="text-sm text-text-muted mt-1">Upload one or more audit files to record the week's progress.</p>
        </div>
        <div className="flex gap-3">
          <a href="/progress-template.csv" download className="px-3 py-1.5 text-xs font-semibold border border-primary text-primary hover:bg-primary-soft outline-none rounded transition-colors bg-surface inline-flex items-center">
            Blank Template
          </a>
          <a href="/mock-upload-data.csv" download className="px-3 py-1.5 text-xs font-semibold border border-border text-text hover:bg-raised outline-none rounded transition-colors bg-surface inline-flex items-center">
            Mock Data
          </a>
        </div>
      </div>

      {errMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">
          {errMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-md font-semibold border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Week Ending (Sunday)</label>
            <input type="date" value={weekEnding} onChange={e => setWeekEnding(e.target.value)}
              className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Snapshot Label (optional)</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Q2 Week 4"
              className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Audit Files</label>
          <div
            className={`border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary-soft' : 'border-border bg-canvas hover:bg-raised'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.csv" multiple className="hidden" onChange={handleChange} />
            <UploadIcon size={28} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm text-text-muted font-medium">Drop audit files here or click to browse</p>
            <p className="text-xs text-text-subtle mt-1">.xlsx or .csv · pick the audit type per file after adding</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Staged files</div>
            <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
              {files.map(f => (
                <li key={f.id} className="px-3 py-3 flex items-center gap-3">
                  <FileSpreadsheet size={16} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{f.file.name}</div>
                    <div className="text-xs text-text-muted">
                      {f.status === 'parsing' && 'Parsing...'}
                      {f.status === 'parsed' && (
                        <>
                          {f.rows.length} row{f.rows.length === 1 ? '' : 's'}
                          {f.unmapped.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-2" title={f.unmapped.join(', ')}>
                              · {f.unmapped.length} unmapped column{f.unmapped.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </>
                      )}
                      {f.status === 'error' && <span className="text-red-500">Error: {f.error}</span>}
                    </div>
                  </div>
                  <select
                    value={f.auditTypeId ?? ''}
                    onChange={e => setAuditType(f.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1.5 bg-canvas border rounded text-text focus:border-primary outline-none ${!f.auditTypeId ? 'border-amber-500' : 'border-border'}`}
                  >
                    <option value="">Audit type...</option>
                    {disciplines?.map(d => <option key={d.id} value={d.id}>{d.name} Audit</option>)}
                  </select>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="p-1.5 text-text-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            disabled={!allReady || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Snapshot'}
          </button>
        </div>
      </div>

      {/* Baseline + history */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <History size={14} className="text-text-muted" />
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Saved snapshots</span>
        </div>

        <div className="px-4 py-3 bg-canvas border-b border-border text-sm text-text-muted flex items-start gap-2">
          {baselineSnap ? (
            <span>
              <span className="font-semibold text-text">Baseline – 1st Audit:</span> {baselineItemsCount} record{baselineItemsCount === 1 ? '' : 's'} across {baselineDisciplineCount} disciplines
              {baselineSnap.week_ending && <> · captured for week ending {new Date(baselineSnap.week_ending).toLocaleDateString()}</>}
            </span>
          ) : (
            <>
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <span>No 1st-audit baseline set — your next upload will become the baseline.</span>
            </>
          )}
        </div>

        {snapshots && snapshots.length > 0 ? (
          <ul className="divide-y divide-border">
            {snapshots.map(s => (
              <li key={s.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-12 sm:col-span-3 font-medium text-text">
                  {s.kind === 'baseline_first_audit' && <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-info-soft text-info border border-info/30 mr-2">Baseline</span>}
                  {s.label}
                </div>
                <div className="col-span-6 sm:col-span-2 text-text-muted text-xs">
                  {s.week_ending ? new Date(s.week_ending).toLocaleDateString() : new Date(s.snapshot_date).toLocaleDateString()}
                </div>
                <div className="col-span-6 sm:col-span-2 text-text-muted text-xs tabular-nums">
                  {s.items_count} items
                </div>
                <div className="col-span-12 sm:col-span-3 text-text-muted text-xs truncate">
                  {s.source_filename ?? '—'}
                </div>
                <div className="col-span-12 sm:col-span-2 text-text-muted text-xs truncate text-right">
                  {s.uploaded_by_email ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-text-muted">No snapshots yet.</div>
        )}
      </div>
    </div>
  );
}
