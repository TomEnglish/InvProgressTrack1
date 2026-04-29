import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { uploadProgressData } from '../lib/api';

export default function Upload() {
  const { projectId } = useParams<{ projectId: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!projectId) return null;

  const mutation = useMutation({
    mutationFn: (items: any[]) => uploadProgressData(projectId, items),
    onSuccess: () => {
      alert("CSV imported successfully.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Data Upload</h2>
          <p className="text-sm text-text-muted mt-1">Select your project and upload the latest Earned Value tracking CSV.</p>
        </div>
        <div className="flex gap-3">
          <a href="/progress-template.csv" download className="px-3 py-1.5 text-xs font-semibold border border-primary text-primary hover:bg-primary-soft outline-none rounded transition-colors bg-surface inline-flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Blank Template
          </a>
          <a href="/mock-upload-data.csv" download className="px-3 py-1.5 text-xs font-semibold border border-border text-text hover:bg-raised outline-none rounded transition-colors bg-surface inline-flex items-center">
             <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002 2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
             Mock Data
          </a>
        </div>
      </div>

      <div className="bg-surface border border-border p-6 rounded-md shadow-sm space-y-6">
        <div>
           <label className="block text-[13px] font-semibold text-text mb-1.5 tracking-wide">CSV File</label>
           
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
                  <p className="text-sm text-text-muted font-medium mb-1">Drag and drop your CSV here, or click to select</p>
                  <p className="text-xs text-text-subtle">Headers must match the Blank Template</p>
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
            {mutation.isPending ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
