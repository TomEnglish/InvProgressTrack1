import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://juuysbvhauyuarbjlxmj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1dXlzYnZoYXV5dWFyYmpseG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTkyMTYsImV4cCI6MjA5MjUzNTIxNn0.iukXgy52gagjVwhQ6Tnb9-eU1CSXGlO9L2KLbv4VvDM');

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'live@invenio.com', password: 'password123' });
  console.log(error ? error.message : "SUCCESS_LOGIN");
}
testLogin();
