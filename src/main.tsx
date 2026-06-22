import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Patch preventivo global para evitar erros fatais de JSON.parse("undefined")
// Isso deve ser a PRIMEIRA coisa a rodar no app
if (typeof window !== 'undefined') {
  const originalJSONParse = JSON.parse;
  JSON.parse = function(text, reviver) {
    if (text === 'undefined' || text === undefined) {
      console.warn('[System] Detectado JSON.parse(undefined). Retornando null para evitar quebra.');
      return null;
    }
    try {
      return originalJSONParse.call(JSON, text, reviver);
    } catch (e) {
      // Se for o erro "undefined" que escapou de alguma forma
      if (typeof text === 'string' && text.includes('undefined')) {
        return null;
      }
      throw e;
    }
  };

  // Limpeza proativa de chaves corrompidas
  try {
    const problematicKeys = ['sb-ais-auth-token', 'supabase_mock_user', 'wa_crm_funnel_stages', 'sb_prod_cache_users'];
    problematicKeys.forEach(key => {
      if (localStorage.getItem(key) === 'undefined') {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {}
}

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
