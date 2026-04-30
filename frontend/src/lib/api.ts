import { supabase } from './supabase';

export interface UploadSnapshotPayload {
  projectId: string;
  weekEnding: string;
  label?: string;
  sourceFilename?: string;
  items: Record<string, unknown>[];
}

export async function uploadProgressData(payload: UploadSnapshotPayload) {
  const { data, error } = await supabase.functions.invoke('import-progress-data', {
    body: payload
  });

  if (error) {
    throw new Error(error.message || 'Error occurred while contacting Edge Function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
