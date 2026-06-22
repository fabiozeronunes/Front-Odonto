import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, resetSupabase } from '../lib/supabase';
import { SUPABASE_CONFIG } from '../lib/config';
import { AlertCircle, CheckCircle2, Database, Shield, Signal, Terminal, RefreshCw, Info } from 'lucide-react';

export const SupabaseDiagnostic: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking');
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastMessage, setLastMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [technicalDetails, setTechnicalDetails] = useState<string | null>(null);

  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRetrying(true);
      resetSupabase();
    }
    
    setAuthStatus('checking');
    setTechnicalDetails(null);
    
    const supabase = getSupabase();
    if (!supabase) {
      setAuthStatus('error');
      const msg = !SUPABASE_CONFIG.isConfigured 
        ? 'Credenciais faltando em Settings > Secrets.' 
        : 'Falha ao inicializar cliente principal.';
      setLastMessage(msg);
      setTechnicalDetails(`Config Source: ${SUPABASE_CONFIG.source}\nConfigured: ${SUPABASE_CONFIG.isConfigured}`);
      setIsRetrying(false);
      return;
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      // AuthSessionMissingError (400) é comum quando o usuário não está logado
      if (error) {
        if (error.name === 'AuthSessionMissingError' || error.status === 400) {
          setAuthStatus('unauthenticated');
          setLastMessage('Sessão não encontrada. O usuário está deslogado.');
          return;
        }
        throw error;
      }
      
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
      const errMsg = err.message || 'Erro desconhecido de autenticação';
      setLastMessage(`Erro de Conectividade Auth: ${errMsg}`);
      setTechnicalDetails(JSON.stringify(err, null, 2));
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    setSupabaseUrl(SUPABASE_CONFIG.url || 'NÃO CONFIGURADO');
    checkStatus();
  }, [checkStatus]);

  const runHealthCheck = async () => {
    setHealthCheckStatus('loading');
    setLastMessage('Iniciando teste de conectividade...');
    setTechnicalDetails(null);
    
    const supabase = getSupabase();
    if (!supabase) {
      setHealthCheckStatus('error');
      setLastMessage('Erro: Supabase não inicializado.');
      return;
    }

    try {
      // Tenta buscar na tabela health_check
      const { error, count } = await supabase
        .from('health_check')
        .select('*', { count: 'exact', head: true });

      if (error) {
        setLastMessage(`Aviso health_check: ${error.message}. Tentando fallback em "pacientes"...`);
        const { error: patientError, count: patientCount } = await supabase.from('pacientes').select('*', { count: 'exact', head: true }).limit(1);
        
        if (patientError) {
          throw patientError;
        } else {
          setHealthCheckStatus('success');
          setLastMessage(`Sucesso via fallback! Banco respondeu. Registros em "pacientes": ${patientCount ?? 0}`);
        }
      } else {
        setHealthCheckStatus('success');
        setLastMessage(`Sucesso: Tabela "health_check" acessível. Registros: ${count || 0}`);
      }
    } catch (err: any) {
      setHealthCheckStatus('error');
      setLastMessage(`Erro de Conectividade: ${err.message || 'Falha de rede'}`);
      setTechnicalDetails(JSON.stringify(err, null, 2));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-white shadow-2xl rounded-xl border border-neutral-200 overflow-hidden font-sans text-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-neutral-900 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 font-medium tracking-tight">
          <Terminal size={14} className="text-emerald-400" />
          <span>Diagnóstico Supabase</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => checkStatus(true)}
            disabled={isRetrying}
            className="hover:text-indigo-400 transition-colors disabled:opacity-30"
            title="Recarregar conexão"
          >
            <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
          </button>
          <div className={`w-2 h-2 rounded-full ${authStatus === 'authenticated' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden">
        {/* Config Status */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
              <Database size={10} /> Endpoint URL
            </label>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-mono">
              source: {SUPABASE_CONFIG.source}
            </span>
          </div>
          <code className="block bg-neutral-50 p-2 rounded text-[10px] font-mono text-neutral-600 break-all border border-neutral-100 leading-normal">
            {supabaseUrl}
          </code>
        </div>

        {/* Auth Status */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Shield size={10} /> Status da Sessão
          </label>
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-neutral-100 bg-neutral-50/50">
            {authStatus === 'authenticated' ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : authStatus === 'checking' ? (
              <RefreshCw size={18} className="text-neutral-300 shrink-0 mt-0.5 animate-spin" />
            ) : (
              <AlertCircle size={18} className={authStatus === 'error' ? 'text-red-500 shrink-0 mt-0.5' : 'text-neutral-400 shrink-0 mt-0.5'} />
            )}
            <div className="flex flex-col">
              <span className={`font-semibold text-[13px] ${authStatus === 'authenticated' ? 'text-emerald-700' : 'text-neutral-800'}`}>
                {authStatus === 'authenticated' ? 'Conectado' : authStatus === 'checking' ? 'Verificando...' : 'Desconectado'}
              </span>
              <span className="text-[11px] text-neutral-500 leading-tight">
                {authStatus === 'authenticated' ? userEmail : (authStatus === 'error' ? 'Falha na comunicação' : 'Aguardando login oficial')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          <button
            onClick={runHealthCheck}
            disabled={healthCheckStatus === 'loading'}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-[0.98] transition-all text-white text-[12px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {healthCheckStatus === 'loading' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Signal size={14} />
            )}
            {healthCheckStatus === 'loading' ? 'Verificando Tabela...' : 'Ping Database'}
          </button>
        </div>

        {/* Message Log */}
        {lastMessage && (
          <div className={`p-3 rounded-lg border flex gap-2.5 ${
            healthCheckStatus === 'error' || authStatus === 'error' 
              ? 'bg-red-50 text-red-700 border-red-100' 
              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
          }`}>
            <Info size={14} className="shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <p className="text-[11px] leading-relaxed font-medium">{lastMessage}</p>
              
              {technicalDetails && (
                <div className="mt-2 text-[9px] font-mono bg-white/50 p-2 rounded border border-current/10 max-h-32 overflow-y-auto whitespace-pre-wrap break-all opacity-80 shadow-inner">
                  {technicalDetails}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-center gap-2">
        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">v1.2 Diagnostic Engine</span>
      </div>
    </div>
  );
};
