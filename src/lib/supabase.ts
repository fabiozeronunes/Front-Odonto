import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client to prevent application crashes on startup if env keys are not yet provided
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const metaEnv = (import.meta as any).env || {};
    const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
    const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        'Supabase URL or Anon Key is missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
      );
      return null;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export const supabase = getSupabase();
