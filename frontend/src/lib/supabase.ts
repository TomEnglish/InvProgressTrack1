import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpveHhsYmFxcnZtdm5obXF0YXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ1ODEyMjd9.some_long_key_mock_for_local_dev';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
