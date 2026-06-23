
/**
 * Arquivo central de configuração do ambiente.
 * Valida a presença de variáveis obrigatórias e fornece acesso unificado.
 */

interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'vite' | 'inject' | 'api' | 'none';
  debug: any;
}

function getInitialEnv(): SupabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const injectEnv = (window as any).ENV_CONFIG || {};

  const rawUrl = injectEnv.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL || '';
  const rawKey = injectEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const url = (rawUrl && rawUrl !== 'null' && rawUrl !== 'undefined') ? rawUrl : '';
  const anonKey = (rawKey && rawKey !== 'null' && rawKey !== 'undefined') ? rawKey : '';

  let source: 'vite' | 'inject' | 'api' | 'none' = 'none';
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
      injectEnvPresent: !!(window as any).ENV_CONFIG,
      metaEnvPresent: !!(import.meta as any).env?.VITE_SUPABASE_URL
    }
  };
}

export let SUPABASE_CONFIG = getInitialEnv();

/**
 * Tenta carregar a configuração via API se não estiver disponível localmente.
 * Isso resolve problemas de chaves configuradas após o build do cliente.
 */
export async function refreshSupabaseConfig(): Promise<SupabaseConfig> {
  if (SUPABASE_CONFIG.isConfigured) return SUPABASE_CONFIG;

  try {
    console.log('[SUPABASE CONFIG] Tentando carregar chaves via API do servidor...');
    const response = await fetch('/api/config/supabase');
    const data = await response.json();
    
    if (data.isConfigured) {
      SUPABASE_CONFIG = {
        url: data.url,
        anonKey: data.anonKey,
        isConfigured: true,
        source: 'api',
        debug: { ...SUPABASE_CONFIG.debug, loadedViaApi: true }
      };
      console.log('[SUPABASE CONFIG] Chaves carregadas com sucesso via API.');
    }
  } catch (err) {
    console.warn('[SUPABASE CONFIG] Falha ao buscar chaves via API:', err);
  }

  return SUPABASE_CONFIG;
}

if (!SUPABASE_CONFIG.isConfigured) {
  console.error(
    ' [SUPABASE CONFIG ERROR] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas. ' +
    'Certifique-se de adicioná-las no menu "Settings > Secrets" do AI Studio ou no seu arquivo .env.'
  );
  console.log('Diagnostic info:', SUPABASE_CONFIG.debug);
} else {
  console.log(`[Supabase Config] Carregado via: ${SUPABASE_CONFIG.source}`);
}
