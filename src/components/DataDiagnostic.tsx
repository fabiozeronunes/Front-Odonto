import React, { useState } from 'react';
import { Database, Search, RefreshCw, AlertTriangle, CheckCircle, CloudDownload, Info } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, syncLegacyData, syncCloudToLocal } from '../lib/supabaseAdapter';
import { SUPABASE_CONFIG, refreshSupabaseConfig } from '../lib/config';

export const DataDiagnostic: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState(SUPABASE_CONFIG);

  const handleOpenToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    
    if (nextState) {
      // Ao abrir, tenta buscar as chaves dinamicamente do servidor se necessário
      const updatedConfig = await refreshSupabaseConfig();
      setSupabaseStatus(updatedConfig);
    }
  };

  const runDiagnostic = async () => {
    setLoading(true);
    console.log('%c --- SUPABASE DATA DIAGNOSTIC --- ', 'background: #222; color: #bada55; font-size: 16px;');
    
    try {
      const user = auth.currentUser;
      console.log('1. Auth Status:', user ? `Logged in as ${user.email} (${user.uid})` : 'NOT LOGGED IN');

      if (!user) {
        console.error('Diagnostic failed: No user found. Please login.');
        setLoading(false);
        return;
      }

      // 2. Check LocalStorage State
      const tables = ['pacientes', 'appointments', 'clinics', 'dentists', 'wa_crm_funnel_stages', 'ai_connections_v1'];
      console.log('2. LocalStorage Check:');
      const localResults: Record<string, string> = {};
      tables.forEach(table => {
        const val = localStorage.getItem(table);
        const mockVal = localStorage.getItem(`sb_mock_${table}`);
        localResults[table] = val ? `${val.length} chars` : 'EMPTY';
        
        if (val) {
          try {
            const parsed = JSON.parse(val);
            console.log(`   - ${table}: Found ${Array.isArray(parsed) ? parsed.length : '1'} items in RAW storage`);
          } catch(e) {
            console.log(`   - ${table}: Found RAW value but not valid JSON (could be "${val}")`);
          }
        }
        if (mockVal) {
          try {
            const parsed = JSON.parse(mockVal);
             console.log(`   - sb_mock_${table}: Found ${Array.isArray(parsed) ? parsed.length : '1'} items in MOCK storage`);
          } catch(e) {}
        }
      });

      // 3. Check Remote Supabase State
      console.log('3. Remote Supabase Check (Sample Tables):');
      const remoteTables = ['pacientes', 'agendamentos', 'funnel_stages', 'ai_connections', 'users'];
      
      for (const table of remoteTables) {
        try {
          const snap = await getDocs(collection(db, table));
          console.log(`   - Remote ${table}: Found ${snap.docs.length} items`);
          if (snap.docs.length > 0) {
            const first = snap.docs[0].data();
            console.log(`     (Sample from ${table}: ownerId=${first.ownerId || first.id || 'MISSING'})`);
          }
        } catch (err: any) {
          console.error(`   - Remote ${table}: Error fetching: ${err.message}`);
        }
      }

      console.log('4. Manual Sync Trigger (Optional):');
      console.log('   Run syncLegacyData() in console to retry migration manually.');
      
      alert('Diagnóstico concluído! Verifique o console do navegador (F12) para os detalhes.');
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (confirm('Deseja forçar a sincronização dos dados locais para a nuvem agora?')) {
      setLoading(true);
      try {
        await syncLegacyData();
        alert('Sincronização concluída! Recarregue a página se os dados não aparecerem.');
      } catch (err: any) {
        alert('Erro na sincronização: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePullFromCloud = async () => {
    if (confirm('Deseja baixar todos os dados da nuvem para atualizar seu ambiente local? Isso sobrescreverá dados locais com os dados online.')) {
      setLoading(true);
      try {
        await syncCloudToLocal();
        alert('Dados da nuvem baixados com sucesso! A página será recarregada para aplicar as mudanças.');
        window.location.reload();
      } catch (err: any) {
        alert('Erro ao baixar dados: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg transition-all transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
        <div className="p-4 w-64 space-y-3">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Painel de Dados</p>

          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500 font-medium">Supabase Status:</span>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${supabaseStatus.isConfigured ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-bold ${supabaseStatus.isConfigured ? 'text-emerald-700' : 'text-red-700'}`}>
                  {supabaseStatus.isConfigured ? 'Conectado' : 'Offline'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-1 mt-1">
              <div className="p-1 px-2 border border-neutral-200 rounded text-[9px] text-neutral-500 bg-white">
                URL: <span className={supabaseStatus.url ? 'text-emerald-600 font-bold' : 'text-red-500'}>{supabaseStatus.url ? 'Presente' : 'Ausente'}</span>
              </div>
              <div className="p-1 px-2 border border-neutral-200 rounded text-[9px] text-neutral-500 bg-white">
                Key: <span className={supabaseStatus.anonKey ? 'text-emerald-600 font-bold' : 'text-red-500'}>{supabaseStatus.anonKey ? 'Presente' : 'Ausente'}</span>
              </div>
            </div>

            {supabaseStatus.isConfigured && (
              <div className="text-[9px] text-neutral-400 italic flex items-center gap-1">
                <Info size={10} />
                Origem: {supabaseStatus.source === 'inject' ? 'Secrets' : (supabaseStatus.source === 'api' ? 'Servidor' : 'Bundle')}
              </div>
            )}
            
            {!supabaseStatus.isConfigured && (
              <div className="p-2 bg-amber-50 rounded border border-amber-100 flex gap-2">
                <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-800 leading-tight">
                  Chaves ausentes no bundle. Tentando buscar do servidor...
                </p>
              </div>
            )}
          </div>
          
          <button 
            onClick={runDiagnostic}
            disabled={loading}
            className="w-full flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg text-sm text-neutral-600 transition-colors"
          >
            <Search size={14} className="text-blue-500" />
            <span>Diagnosticar Dados</span>
          </button>

          <button 
            onClick={handleManualSync}
            disabled={loading}
            className="w-full flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg text-sm text-neutral-600 transition-colors"
          >
            <RefreshCw size={14} className={`text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Subir dados para Nuvem</span>
          </button>

          <button 
            onClick={handlePullFromCloud}
            disabled={loading}
            className="w-full flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg text-sm text-neutral-600 transition-colors"
          >
            <CloudDownload size={14} className={`text-blue-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Baixar dados da Nuvem</span>
          </button>

          <div className="pt-2 border-t border-neutral-100">
            <p className="text-[10px] text-neutral-400 italic">Abra o console (F12) após clicar em diagnosticar.</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleOpenToggle}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 shadow-xl rounded-full text-white text-xs font-semibold hover:bg-neutral-800 transition-all border border-neutral-700 active:scale-95"
      >
        <Database size={14} />
        <span>Gestão de Dados</span>
      </button>
    </div>
  );
};
