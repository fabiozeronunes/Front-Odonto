import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// Lazy initialization of Supabase client to prevent application crashes on startup if env keys are not yet provided
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    if (!SUPABASE_CONFIG.isConfigured) {
      console.warn(
        '[Supabase] URL ou Chave Anon estão faltando no arquivo de configuração.',
        { url: !!SUPABASE_CONFIG.url, key: !!SUPABASE_CONFIG.anonKey, source: SUPABASE_CONFIG.source }
      );
      return null;
    }

    console.log('[Supabase] Inicializando cliente com as chaves de:', SUPABASE_CONFIG.source);
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('[Supabase] Cliente inicializado com sucesso.');
  }
  return supabaseInstance;
}

export const supabase = getSupabase();
