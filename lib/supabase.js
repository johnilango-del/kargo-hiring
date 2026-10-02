import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

let client;

// Server-only Supabase client using the secret key (bypasses RLS). Never expose to the browser.
export function db() {
  if (!client) {
    client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function getRubricText() {
  const { data, error } = await db().from('rubric').select('content').eq('id', 1).maybeSingle();
  if (error) throw new Error(`Could not load rubric from Supabase: ${error.message}`);
  if (!data?.content) throw new Error('The rubric table is empty. Run supabase/schema.sql in the Supabase SQL Editor.');
  return data.content;
}

export async function getCandidate(id) {
  const { data, error } = await db().from('candidates').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not load candidate: ${error.message}`);
  return data;
}
