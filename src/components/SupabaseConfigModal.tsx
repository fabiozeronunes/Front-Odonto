import React, { useState } from 'react';
import { X, Save, AlertCircle, CheckCircle, Database } from 'lucide-react';
import { SUPABASE_CONFIG, saveManualSupabaseConfig, clearManualSupabaseConfig } from '../lib/config';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [url, setUrl] = useState(SUPABASE_CONFIG.url || '');
  const [key, setKey] = useState(SUPABASE_CONFIG.anonKey || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);
    if (!url || !key) {
      setError('A URL e a Chave Anon são obrigatórias.');
      return;
    }

    if (!url.startsWith('http')) {
      setError('A URL deve começar com http:// ou https://');
      return;
    }

    setLoading(true);
    try {
      saveManualSupabaseConfig(url.trim(), key.trim());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSaved();
        onClose();
        // Recarregar para garantir inicialização limpa (opcional, mas recomendado)
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm('Deseja remover as configurações manuais e voltar ao padrão do sistema?')) {
      clearManualSupabaseConfig();
      setUrl('');
      setKey('');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Configuração Supabase</h3>
              <p className="text-xs text-neutral-500">Ajuste manual das chaves de conexão</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-red-700 text-sm animate-in slide-in-from-top-1">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-2 text-emerald-700 text-sm animate-in slide-in-from-top-1">
              <CheckCircle size={18} className="shrink-0" />
              <p>Configurações salvas! Reiniciando aplicativo...</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase">Supabase URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase">Supabase Anon Key</label>
            <textarea
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              rows={4}
              className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono resize-none"
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 italic text-[10px] text-amber-800 leading-relaxed">
            Nota: Estas chaves serão salvas apenas no seu navegador atual (localStorage). 
            Se você limpar o cache do navegador, precisará informá-las novamente.
          </div>
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-3">
          <button
            onClick={handleClear}
            className="text-xs font-semibold text-neutral-400 hover:text-red-500 transition-colors"
          >
            Limpar Padrões
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || success}
              className="flex items-center gap-2 px-6 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
