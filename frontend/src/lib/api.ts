import { supabase } from './supabase';

export async function uploadProgressData(projectId: string, items: any[]) {
  const { data, error } = await supabase.functions.invoke('import-progress-data', {
    body: { projectId, items }
  });

  if (error) {
    throw new Error(error.message || 'Error occurred while contacting Edge Function');
  }
  
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}
