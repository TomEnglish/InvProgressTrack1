import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://juuysbvhauyuarbjlxmj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1dXlzYnZoYXV5dWFyYmpseG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTkyMTYsImV4cCI6MjA5MjUzNTIxNn0.iukXgy52gagjVwhQ6Tnb9-eU1CSXGlO9L2KLbv4VvDM'
);

async function register() {
  console.log("Registering live@invenio.com directly through the GoTrue API...");
  const { data, error } = await supabase.auth.signUp({
    email: 'live@invenio.com',
    password: 'password123',
  });
  if (error) {
    console.error("Signup error:", error);
  } else {
    console.log("Success! Authenticated GoTrue UUID:", data.user?.id);
    console.log("Trigger automatically bound user to Dummy Tenant.");
  }
}

register();
