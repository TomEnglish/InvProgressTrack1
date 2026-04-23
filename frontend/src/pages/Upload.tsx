import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { uploadProgressData } from '../lib/api';

export default function Upload() {
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (items: any[]) => uploadProgressData(projectId, items),
    onSuccess: () => {
      alert("Successfully processed and imported project data.");
      setFile(null);
    },
    onError: (error: Error) => {
      alert(`Upload failed: ${error.message}`);
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file || !projectId) return;

    // Simulate basic CSV to JSON parsing in the browser 
    // Usually we would use Papaparse or XLSX here.
    const text = await file.text();
    const rows = text.split('\n').filter(r => r.trim().length > 0);
    const headers = rows[0].split(',').map(h => h.trim());
    
    // Safety check
    if (headers.length < 2) {
      alert('Invalid CSV: Columns not detected.');
      return;
    }

    const items = rows.slice(1).map(row => {
      const values = row.split(',');
      const obj: any = {};
      headers.forEach((h, i) => obj[h] = values[i]?.trim() || "");
      return obj;
    });

    mutation.mutate(items);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Data Upload</h2>
        <p className="text-sm text-text-muted mt-1">Select your project and upload the latest Earned Value tracking CSV.</p>
      </div>

      <div className="bg-surface border border-border p-6 rounded-md shadow-sm space-y-6">
        <div>
          <label className="block text-[13px] font-semibold text-text mb-1.5 tracking-wide">Target Project UUID</label>
          <input 
            type="text" 
            placeholder="copy-paste UUID here..."
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="w-full max-w-sm p-2.5 text-sm bg-canvas border border-border rounded-md focus:border-primary outline-none focus:ring-1 focus:ring-primary-soft"
          />
          <p className="text-xs text-text-muted mt-1">Currently hardcoded to strict UUID while we attach standard project lookup dropdowns.</p>
        </div>

        <div>
           <label className="block text-[13px] font-semibold text-text mb-1.5 tracking-wide">CSV Data Payload</label>
           
           <div 
            className={`border-2 border-dashed rounded-md p-10 text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary-soft' : 'border-border bg-canvas hover:bg-raised'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
           >
             <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} />
             {file ? (
               <p className="text-sm font-semibold text-primary">{file.name}</p>
             ) : (
               <div>
                  <p className="text-sm text-text-muted font-medium mb-1">Drag and drop your spreadsheet here</p>
                  <p className="text-xs text-text-subtle">Supports strictly formatted CSV pipelines matching Edge function constraints</p>
               </div>
             )}
           </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            disabled={!file || !projectId || mutation.isPending}
            onClick={processFile}
            className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Validating Payload...' : 'Submit to Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}
