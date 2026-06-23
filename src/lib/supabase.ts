import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// Lazy initialization of Supabase client to prevent application crashes on startup if env keys are not yet provided
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  // Se não houver instância ou se a URL for inválida, tentamos inicializar
  if (!supabaseInstance || (supabaseInstance as any).restUrl === '') {
    if (!SUPABASE_CONFIG.isConfigured) {
      return null;
    }

    console.log('[Supabase] Inicializando cliente com as chaves de:', SUPABASE_CONFIG.source);
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-ais-auth-token'
      }
    });
    console.log('[Supabase] Cliente inicializado com sucesso.');
  }
  return supabaseInstance;
}

/**
 * Reseta a instância do cliente Supabase. 
 * Útil para forçar a reconexão quando as variáveis de ambiente são alteradas.
 */
export function resetSupabase() {
  console.log('[Supabase] Resetando instância do cliente para nova tentativa...');
  supabaseInstance = null;
}

export const supabase = getSupabase();
