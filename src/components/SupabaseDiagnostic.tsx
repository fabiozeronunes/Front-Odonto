import React, { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Database, Shield, Signal, Terminal } from 'lucide-react';

export const SupabaseDiagnostic: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking');
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastMessage, setLastMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get config info
    const metaEnv = (import.meta as any).env || {};
    setSupabaseUrl(metaEnv.VITE_SUPABASE_URL || 'NÃO CONFIGURADO');

    const checkAuth = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setAuthStatus('error');
        setLastMessage('Cliente Supabase não inicializado (VITE_SUPABASE_URL está faltando?)');
        return;
      }

      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
          setAuthStatus('authenticated');
          setUserEmail(user.email || 'Usuário sem e-mail');
          setLastMessage('Autenticado com sucesso via Supabase Auth.');
        } else {
          setAuthStatus('unauthenticated');
          setLastMessage('Nenhum usuário logado no Supabase.');
        }
      } catch (err: any) {
        setAuthStatus('error');
        setLastMessage(`Erro de Auth: ${err.message || 'Erro desconhecido'}`);
      }
    };

    checkAuth();
  }, []);

  const runHealthCheck = async () => {
    setHealthCheckStatus('loading');
    setLastMessage('Iniciando teste de conectividade com a tabela health_check...');
    
    const supabase = getSupabase();
    if (!supabase) {
      setHealthCheckStatus('error');
      setLastMessage('Erro: Supabase não inicializado.');
      return;
    }

    try {
      // Tenta buscar na tabela health_check (ou pacientes se health_check não existir, como fallback comum)
      const { data, error, count } = await supabase
        .from('health_check')
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Se a tabela health_check não existir, tenta listar tabelas ou pacients para ver se o DB responde
        setLastMessage(`Erro na tabela health_check: ${error.message}. Tentando fallback...`);
        const { error: patientError } = await supabase.from('pacientes').select('*', { count: 'exact', head: true }).limit(1);
        
        if (patientError) {
          throw new Error(`Falha geral de acesso: ${patientError.message}`);
        } else {
          setHealthCheckStatus('success');
          setLastMessage('Sucesso: Conexão direta com o banco estabelecida através da tabela "pacientes".');
        }
      } else {
        setHealthCheckStatus('success');
        setLastMessage(`Sucesso: Tabela "health_check" acessível. Registros: ${count || 0}`);
      }
    } catch (err: any) {
      setHealthCheckStatus('error');
      setLastMessage(`Erro de Dados: ${err.message}`);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-white shadow-2xl rounded-xl border border-neutral-200 overflow-hidden font-sans text-sm">
      <div className="bg-neutral-900 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 font-medium tracking-tight">
          <Terminal size={16} className="text-emerald-400" />
          <span>Supabase Diagnostics</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${authStatus === 'authenticated' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
      </div>

      <div className="p-4 space-y-4">
        {/* Config Status */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Database size={10} /> Projeto URL
          </label>
          <code className="block bg-neutral-50 p-2 rounded text-[11px] text-neutral-600 break-all border border-neutral-100">
            {supabaseUrl}
          </code>
        </div>

        {/* Auth Status */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Shield size={10} /> Autenticação
          </label>
          <div className="flex items-center gap-2 py-1">
            {authStatus === 'authenticated' ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <AlertCircle size={16} className={authStatus === 'error' ? 'text-red-500' : 'text-neutral-300'} />
            )}
            <span className={`font-medium ${authStatus === 'authenticated' ? 'text-emerald-700' : 'text-neutral-700'}`}>
              {authStatus === 'authenticated' ? `Logado: ${userEmail}` : authStatus === 'checking' ? 'Verificando...' : 'Não autenticado'}
            </span>
          </div>
        </div>

        {/* Connectivity Test */}
        <div className="pt-2">
          <button
            onClick={runHealthCheck}
            disabled={healthCheckStatus === 'loading'}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Signal size={16} />
            {healthCheckStatus === 'loading' ? 'Testando...' : 'Testar Conectividade'}
          </button>
        </div>

        {/* Info/Error Message Log */}
        {lastMessage && (
          <div className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed transition-all ${
            healthCheckStatus === 'error' || authStatus === 'error' 
              ? 'bg-red-50 text-red-700 border-red-100' 
              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
          }`}>
            <p>{lastMessage}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 text-[10px] text-neutral-400 text-center uppercase tracking-widest font-bold">
        Production Connection Tool
      </div>
    </div>
  );
};
