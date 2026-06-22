
/**
 * Arquivo central de configuração do ambiente.
 * Valida a presença de variáveis obrigatórias e fornece acesso unificado.
 */

interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'vite' | 'inject' | 'none';
}

function getSafeEnv() {
  const metaEnv = (import.meta as any).env || {};
  const injectEnv = (window as any).ENV_CONFIG || {};

  const rawUrl = injectEnv.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL || '';
  const rawKey = injectEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_ANON_KEY || '';

  // Limpeza de valores que podem vir como string "null" ou "undefined"
  const url = (rawUrl && rawUrl !== 'null' && rawUrl !== 'undefined') ? rawUrl : '';
  const anonKey = (rawKey && rawKey !== 'null' && rawKey !== 'undefined') ? rawKey : '';

  let source: 'vite' | 'inject' | 'none' = 'none';
  if (injectEnv.VITE_SUPABASE_URL && injectEnv.VITE_SUPABASE_URL !== 'null') source = 'inject';
  else if (metaEnv.VITE_SUPABASE_URL) source = 'vite';

  return {
    url,
    anonKey,
    isConfigured: !!(url && anonKey && url.startsWith('http')),
    source
  };
}

export const SUPABASE_CONFIG: SupabaseConfig = getSafeEnv();

if (!SUPABASE_CONFIG.isConfigured) {
  console.error(
    ' [CONFIG ERROR] Supabase credentials not found. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  );
}
