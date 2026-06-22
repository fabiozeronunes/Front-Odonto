
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
    source,
    debug: {
      hasUrl: !!url,
      hasKey: !!anonKey,
      urlLength: url.length,
      injectEnvPresent: !!(window as any).ENV_CONFIG,
      metaEnvPresent: !!(import.meta as any).env?.VITE_SUPABASE_URL
    }
  };
}

export const SUPABASE_CONFIG = getSafeEnv();

if (!SUPABASE_CONFIG.isConfigured) {
  console.error(
    ' [SUPABASE CONFIG ERROR] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas. ' +
    'Certifique-se de adicioná-las no menu "Settings > Secrets" do AI Studio ou no seu arquivo .env.'
  );
  console.log('Diagnostic info:', SUPABASE_CONFIG.debug);
} else {
  console.log(`[Supabase Config] Carregado via: ${SUPABASE_CONFIG.source}`);
}
