
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

  const url = injectEnv.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL || '';
  const anonKey = injectEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_ANON_KEY || '';

  let source: 'vite' | 'inject' | 'none' = 'none';
  if (injectEnv.VITE_SUPABASE_URL) source = 'inject';
  else if (metaEnv.VITE_SUPABASE_URL) source = 'vite';

  return {
    url,
    anonKey,
    isConfigured: !!(url && anonKey),
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
