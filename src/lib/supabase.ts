import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client to prevent application crashes on startup if env keys are not yet provided
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const metaEnv = (import.meta as any).env || {};
    // Em produção, as chaves VITE_ do .env podem não ser injetadas no bundle se não estiverem presentes no build.
    // Por isso, tentamos carregar de um objeto global que o servidor pode injetar no index.html.
    const envConfig = (window as any).ENV_CONFIG || {};

    const supabaseUrl = envConfig.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL;
    const supabaseAnonKey = envConfig.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        '[Supabase] URL or Anon Key is missing. Falling back to local/mock mode.',
        { url: !!supabaseUrl, key: !!supabaseAnonKey, env: metaEnv, hasGlobal: !!(window as any).ENV_CONFIG }
      );
      return null;
    }

    console.log('[Supabase] Initializing client with URL:', supabaseUrl);
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[Supabase] Client initialized successfully.');
  }
  return supabaseInstance;
}

export const supabase = getSupabase();
