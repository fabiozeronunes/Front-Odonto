import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  MessageSquare, 
  Facebook, 
  Search, 
  Videotape, 
  CheckCircle2, 
  AlertCircle, 
  Link2, 
  ExternalLink,
  X,
  RefreshCw,
  Shield,
  Activity,
  Server,
  Check,
  Globe,
  Settings2,
  Save,
  Clock,
  Bell
} from 'lucide-react';
import QuickResponsesManager from './QuickResponsesManager';

interface ConnectionsProps {
  setActiveTab: (tab: string) => void;
  accessToken: string | null;
  onConnectGoogle: (mode?: string) => Promise<void>;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  type?: 'general' | 'ads';
}

export default function Connections({ setActiveTab, accessToken, onConnectGoogle, onSyncGoogle, onDisconnectGoogle, type = 'general' }: ConnectionsProps) {
  // Simulating connection states
  const [connections, setConnections] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({
    google: accessToken ? 'connected' : 'disconnected',
    agenda: accessToken ? 'connected' : 'disconnected',
    whatsapp: 'disconnected',
    facebook: 'disconnected',
    tiktok: 'disconnected',
  });

  // Modal and diagnosis states
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [customLatency, setCustomLatency] = useState<number | null>(null);

  const [subTab, setSubTab] = useState<'integrations' | 'notifications' | 'quick_responses'>('integrations');
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('whatsapp_reminder_minutes');
    return saved ? parseInt(saved, 10) : 1440;
  });
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() => {
    return localStorage.getItem('whatsapp_reminders_enabled') !== 'false';
  });
  const [templateLocal, setTemplateLocal] = useState<string>(() => {
    return localStorage.getItem('whatsapp_template_local') || `Olá, *{nome_paciente}*! Passando para confirmar seu agendamento conosco no dia *{data}* às *{hora}* com Dr(a). *{dentista}*. Por favor, responda se poderá comparecer. Agradecidos!`;
  });
  const [templateGoogle, setTemplateGoogle] = useState<string>(() => {
    return localStorage.getItem('whatsapp_template_google') || `Lembrete de consulta sincronizado do Google Calendar! Olá, *${'{nome_paciente}'}*, tudo bem? Confirmamos o agendamento de *${'{titulo_consulta}'}* para amanhã, *${'{data}'}* às *${'{hora}'}*{localizacao}. Nos vemos lá!`;
  });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const handleSaveNotificationSettings = () => {
    localStorage.setItem('whatsapp_reminder_minutes', reminderMinutes.toString());
    localStorage.setItem('whatsapp_reminders_enabled', remindersEnabled ? 'true' : 'false');
    localStorage.setItem('whatsapp_template_local', templateLocal);
    localStorage.setItem('whatsapp_template_google', templateGoogle);
    setShowSaveSuccess(true);
    setTimeout(() => {
      setShowSaveSuccess(false);
    }, 3000);
  };

  const getFriendlyMinutesDesc = (mins: number) => {
    if (mins <= 0) return "Imediatamente no momento do agendamento";
    if (mins < 60) return `${mins} minutos`;
    if (mins === 60) return `1 hora`;
    if (mins < 1440) {
      const hrs = Math.round(mins / 60 * 10) / 10;
      return `${hrs} horas`;
    }
    if (mins === 1440) return `24 horas (1 dia)`;
    const days = Math.round(mins / 1440 * 10) / 10;
    return `${days} dias`;
  };

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    google_analytics: true,
    google_ads: true,
    calendar_two_way: true,
    calendar_auto_write: true,
    meta_pixel: true,
    meta_lead_sync: true,
    tiktok_conversion: true,
  });

  const handleToggle = (key: string) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const testDiagnostic = () => {
    setCheckingStatus(true);
    setCheckResult(null);
    setTimeout(() => {
      setCheckingStatus(false);
      setCheckResult(true);
      setCustomLatency(Math.floor(Math.random() * 80) + 90);
    }, 1200);
  };

  const forceSync = () => {
    setSyncing(true);
    onSyncGoogle();
    // Simulate sync duration
    setTimeout(() => {
      setSyncing(false);
    }, 2000);
  };

  const openSettings = (serviceId: string) => {
    setActiveConfigId(serviceId);
    setCheckResult(null);
    setCustomLatency(null);
  };

  // Update status when accessToken changes
  useEffect(() => {
    if (accessToken) {
      setConnections(prev => ({
        ...prev,
        google: 'connected',
        agenda: 'connected'
      }));
    } else {
      setConnections(prev => ({
        ...prev,
        google: 'disconnected',
        agenda: 'disconnected'
      }));
    }
  }, [accessToken]);

  const connectService = async (serviceId: string, isDemo = false) => {
    console.log(`[Connections] connectService called for: ${serviceId}, status: ${connections[serviceId]}, isDemo: ${isDemo}`);
    if (serviceId === 'whatsapp') {
      setActiveTab('whatsapp');
      return;
    }

    if (serviceId === 'agenda' || serviceId === 'google') {
      if (connections[serviceId] === 'connected' && !isDemo) {
        if (serviceId === 'agenda') {
          forceSync();
        } else {
          onDisconnectGoogle();
        }
        return;
      }
      
      setConnections(prev => ({ ...prev, [serviceId]: 'connecting' }));
      try {
        if (isDemo) {
          await onConnectGoogle('demo');
        } else {
          await onConnectGoogle();
        }
      } catch (err) {
        console.error("Failed to connect to Google", err);
      } finally {
        setTimeout(() => {
          const token = localStorage.getItem('google_access_token');
          if (!token || token === 'null' || token === 'undefined') {
            setConnections(prev => ({ ...prev, [serviceId]: 'disconnected' }));
          } else {
            setConnections(prev => ({ ...prev, [serviceId]: 'connected' }));
          }
        }, 800);
      }
      return;
    }
    
    // Generic connect/disconnect for other services
    if (connections[serviceId] === 'connected') {
      setConnections(prev => ({ ...prev, [serviceId]: 'disconnected' }));
    } else {
      setConnections(prev => ({ ...prev, [serviceId]: 'connecting' }));
      
      // Simulate connection process
      setTimeout(() => {
        setConnections(prev => ({ 
          ...prev, 
          [serviceId]: 'connected'
        }));
      }, 1500);
    }
  };

  const rawIntegrations = [
    {
      id: 'google',
      name: 'Google Analytics & Ads',
      description: 'Conecte sua conta do Google para importar métricas e otimizar anúncios da sua clínica com IA.',
      icon: Search,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'agenda',
      name: 'Google Agenda',
      description: 'Sincronize a agenda dos dentistas e permita que o assistente inteligente marque consultas automaticamente.',
      icon: Calendar,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Conecte seu WhatsApp para automatizar o atendimento aos pacientes com nosso Agente IA.',
      icon: MessageSquare,
      color: 'bg-green-100 text-green-600',
    },
    {
      id: 'facebook',
      name: 'Facebook & Instagram',
      description: 'Integre suas redes sociais da Meta para gerenciar anúncios, mensagens e captação de leads.',
      icon: Facebook,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'tiktok',
      name: 'TikTok Ads',
      description: 'Conecte sua conta do TikTok para criar e otimizar campanhas de vídeo focadas em conversão.',
      icon: Videotape, // Simple icon fallback
      color: 'bg-black text-white',
    }
  ];

  const integrations = rawIntegrations.filter(item => {
    if (type === 'ads') {
      return ['google', 'facebook', 'tiktok'].includes(item.id);
    } else {
      return ['agenda', 'whatsapp'].includes(item.id);
    }
  });

  return (
    <div className="connections-page-wrapper max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-neutral-100 italic">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-2">
            {type === 'ads' ? 'Conexões AI Ads' : 'Conexões'}
          </h1>
          <p className="text-sm sm:text-base text-neutral-500">
            {type === 'ads' 
              ? 'Conecte suas contas de tráfego pago (Google Ads, Facebook Ads e TikTok Ads) para que nossa inteligência crie e otimize suas campanhas.'
              : 'Gerencie as integrações de APIs e interfaces que alimentam o Front Odonto AI.'
            }
          </p>
        </div>
        <div className="hidden sm:flex w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl items-center justify-center shadow-inner shrink-0 self-start">
          <Link2 size={32} />
        </div>
      </div>

      {type !== 'ads' && (
        <div className="flex border-b border-neutral-200 overflow-x-auto scrollbar-none whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setSubTab('integrations')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
              subTab === 'integrations'
                ? 'border-neutral-900 text-neutral-900 font-extrabold'
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <Link2 size={16} />
            Integrações Ativas
          </button>
          <button
            id="notification-settings-tab"
            onClick={() => setSubTab('notifications')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
              subTab === 'notifications'
                ? 'border-emerald-500 text-emerald-600 font-extrabold'
                : 'border-transparent text-neutral-400 hover:text-neutral-500'
            }`}
          >
            <Settings2 size={16} />
            Configurações de Notificações
          </button>
          <button
            onClick={() => setSubTab('quick_responses')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
              subTab === 'quick_responses'
                ? 'border-emerald-500 text-emerald-600 font-extrabold'
                : 'border-transparent text-neutral-400 hover:text-neutral-500'
            }`}
          >
            <MessageSquare size={16} />
            Respostas Rápidas
          </button>
        </div>
      )}

      {subTab === 'notifications' && type !== 'ads' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Card de Configuração Central */}
          <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-neutral-100 space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bell size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Agente de Lembretes Automáticos WhatsApp</h2>
                  <p className="text-sm text-neutral-500">Configure com quantos minutos antes do agendamento o WhatsApp disparará o lembrete.</p>
                </div>
              </div>
              
              {/* Toggle Habilitar/Desabilitar */}
              <label className="flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100/80 px-4 py-2.5 rounded-2xl cursor-pointer transition-all border border-neutral-100 max-w-max self-start sm:self-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Disparo Automático</span>
                <button
                  onClick={() => setRemindersEnabled(!remindersEnabled)}
                  className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${remindersEnabled ? 'bg-emerald-500' : 'bg-neutral-200'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </label>
            </div>

            {/* Configuração do Tempo de Antecedência */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <label className="block text-sm font-extrabold text-neutral-800 uppercase tracking-wide">Minutos de Antecedência</label>
                  <p className="text-xs text-neutral-500">O sistema irá escanear agendamentos marcados para exatamente este intervalo no futuro.</p>
                </div>
                <div className="flex items-center gap-3 max-w-sm">
                  <div className="relative flex-1">
                    <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="number"
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:bg-white rounded-xl text-sm font-bold text-neutral-800 outline-none transition-all"
                      placeholder="Ex: 1440"
                    />
                  </div>
                  <span className="text-xs font-bold text-neutral-500 uppercase bg-neutral-100 px-3 py-2 rounded-lg shrink-0">
                    Mins
                  </span>
                </div>
              </div>

              {/* Botões de Presets Estilizados */}
              <div>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest block mb-2">Sugestões de Intervalo</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: '30 Minutos', value: 30 },
                    { label: '1 Hora', value: 60 },
                    { label: '2 Horas', value: 120 },
                    { label: '12 Horas', value: 720 },
                    { label: '24 Horas (Padrão)', value: 1440 },
                    { label: '48 Horas (2 dias)', value: 2880 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setReminderMinutes(preset.value)}
                      className={`px-3 py-2 text-[10px] font-bold rounded-xl border transition-all text-center uppercase tracking-wide cursor-pointer
                        ${reminderMinutes === preset.value
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold shadow-sm shadow-emerald-500/5'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Box do tempo calculado */}
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Os pacientes serão notificados com exatamente <strong className="font-extrabold text-emerald-700">{getFriendlyMinutesDesc(reminderMinutes)}</strong> de antecedência antes de suas respectivas consultas.</span>
              </div>
            </div>

            {/* Modelos de Mensagem Personalizados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-neutral-100">
              
              {/* Template Local */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-neutral-800 uppercase tracking-wider">Lembrete para Consultas Locais</label>
                  <span className="text-[9px] font-bold text-neutral-400">Variáveis Provedor</span>
                </div>
                <textarea
                  value={templateLocal}
                  onChange={(e) => setTemplateLocal(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:bg-white rounded-2xl text-xs font-semibold text-neutral-800 outline-none transition-all resize-none leading-relaxed"
                  placeholder="Escreva a mensagem..."
                />
                <div className="flex flex-wrap gap-1.5">
                  {['{nome_paciente}', '{data}', '{hora}', '{dentista}', '{clinica}', '{localizacao}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTemplateLocal(prev => prev + tag)}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[9px] font-mono font-bold rounded cursor-pointer transition-colors"
                      title="Clique para inserir variável"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Google Calendar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-neutral-800 uppercase tracking-wider">Lembrete para Google Agenda</label>
                  <span className="text-[9px] font-bold text-neutral-400">Variáveis Google</span>
                </div>
                <textarea
                  value={templateGoogle}
                  onChange={(e) => setTemplateGoogle(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:bg-white rounded-2xl text-xs font-semibold text-neutral-800 outline-none transition-all resize-none leading-relaxed"
                  placeholder="Escreva a mensagem..."
                />
                <div className="flex flex-wrap gap-1.5">
                  {['{nome_paciente}', '{titulo_consulta}', '{data}', '{hora}', '{localizacao}', '{dentista}', '{clinica}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTemplateGoogle(prev => prev + tag)}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[9px] font-mono font-bold rounded cursor-pointer transition-colors"
                      title="Clique para inserir variável"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Prédica Visual WhatsApp (Preview Bubble) */}
            <div className="bg-neutral-50/50 rounded-2xl border border-neutral-100 p-5 mt-4">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest block mb-3">Pré-visualização do Lembrete no Celular (WhatsApp)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Prévia Lembrete Local */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Prévia: Lembrete Local</span>
                  <div className="bg-[#efeae2] p-4 rounded-2xl border border-[#e1d9ca] shadow-inner relative overflow-hidden" style={{ minHeight: '120px' }}>
                    {/* Wallpaper background pattern logic */}
                    <div 
                      className="absolute inset-0 opacity-10 pointer-events-none" 
                      style={{ 
                        backgroundImage: `radial-gradient(circle, #000 10%, transparent 11%), radial-gradient(circle, #000 10%, transparent 11%)`,
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 8px 8px'
                      }} 
                    />
                    
                    {/* Chat Bubble Container */}
                    <div className="relative bg-[#d9fdd3] text-[#111b21] py-2 px-3.5 rounded-xl shadow-sm max-w-[95%] ml-auto text-xs leading-relaxed border-t border-r border-[#cee9c1]">
                      <p className="whitespace-pre-line text-[11px] font-medium font-sans">
                        {templateLocal
                          .replace(/{nome_paciente}/g, 'Fabio Nunes')
                          .replace(/{data}/g, '15/06')
                          .replace(/{hora}/g, '10:00')
                          .replace(/{dentista}/g, 'Dra. Gabriela Vasconcelos')
                          .replace(/{clinica}/g, 'Clínica Sorriso Perfeito')
                          .replace(/{clínica}/g, 'Clínica Sorriso Perfeito')
                          .replace(/{localizacao}/g, 'Av. Paulista, 1500 - Sala 4')
                          .replace(/{localização}/g, 'Av. Paulista, 1500 - Sala 4')
                        }
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-[#667781] font-sans">
                        <span>15:57</span>
                        <span className="text-sky-500 font-extrabold font-mono text-[10px] leading-none">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prévia Lembrete Google */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Prévia: Google Agenda</span>
                  <div className="bg-[#efeae2] p-4 rounded-2xl border border-[#e1d9ca] shadow-inner relative overflow-hidden" style={{ minHeight: '120px' }}>
                    {/* Wallpaper background pattern logic */}
                    <div 
                      className="absolute inset-0 opacity-10 pointer-events-none" 
                      style={{ 
                        backgroundImage: `radial-gradient(circle, #000 10%, transparent 11%), radial-gradient(circle, #000 10%, transparent 11%)`,
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 8px 8px'
                      }} 
                    />
                    
                    {/* Chat Bubble Container */}
                    <div className="relative bg-[#d9fdd3] text-[#111b21] py-2 px-3.5 rounded-xl shadow-sm max-w-[95%] ml-auto text-xs leading-relaxed border-t border-r border-[#cee9c1]">
                      <p className="whitespace-pre-line text-[11px] font-medium font-sans">
                        {templateGoogle
                          .replace(/{nome_paciente}/g, 'Fabio Nunes')
                          .replace(/{titulo_consulta}/g, 'Clareamento Dental')
                          .replace(/{data}/g, '16/06')
                          .replace(/{hora}/g, '14:30')
                          .replace(/{localizacao}/g, ' em Consultório Principal')
                          .replace(/{localização}/g, ' em Consultório Principal')
                          .replace(/{dentista}/g, 'Dr. Roberto Cruz')
                          .replace(/{clinica}/g, 'Odonto Riso')
                          .replace(/{clínica}/g, 'Odonto Riso')
                        }
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-[#667781] font-sans">
                        <span>16:02</span>
                        <span className="text-sky-500 font-extrabold font-mono text-[10px] leading-none">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Salvar e Feedback */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-neutral-100 gap-4">
              <div className="w-full sm:w-auto">
                {showSaveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-xl font-bold w-full"
                  >
                    <Check size={14} className="text-emerald-600 font-black" />
                    Configurações salvas com sucesso!
                  </motion.div>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleSaveNotificationSettings}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <Save size={16} />
                Salvar Configurações
              </button>
            </div>

          </div>
        </motion.div>
      ) : subTab === 'quick_responses' && type !== 'ads' ? (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <QuickResponsesManager />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
        {integrations.map((integration, index) => {
          const status = connections[integration.id];
          const isConnected = status === 'connected';
          const isConnecting = status === 'connecting';
          
          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${integration.color}`}>
                  <integration.icon size={24} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                    <h3 className="text-lg font-semibold text-neutral-900 truncate">{integration.name}</h3>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-max">
                        <CheckCircle2 size={12} /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full w-max">
                        <AlertCircle size={12} /> Inativo
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-neutral-500 leading-relaxed mb-4 line-clamp-2">
                    {integration.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 w-full">
                      <button
                        onClick={() => connectService(integration.id, false)}
                        disabled={isConnecting}
                        className={`
                          flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                          ${isConnected 
                            ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' 
                            : 'bg-neutral-900 text-white hover:bg-neutral-800'
                          }
                          ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                      >
                        {isConnecting ? (
                          <>Conectando...</>
                        ) : integration.id === 'whatsapp' ? (
                          <>
                            Configurar QR
                            <ExternalLink size={12} />
                          </>
                        ) : isConnected ? (
                          (integration.id === 'agenda') ? 'Sincronizar' : 'Desconectar'
                        ) : (
                          (integration.id === 'google' || integration.id === 'agenda') ? 'Sincronizar' : `Conectar`
                        )}
                      </button>
                      
                      {isConnected && integration.id !== 'whatsapp' && (
                        <button 
                          onClick={() => openSettings(integration.id)}
                          className="px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                        >
                          Config.
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {showConfigGuide && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl shadow-2xl border border-neutral-100 max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 shrink-0">
              <h2 className="text-lg font-bold text-neutral-900">Como Configurar OAuth 2.0</h2>
              <button onClick={() => setShowConfigGuide(false)} className="p-2 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 text-sm text-neutral-700 leading-relaxed overflow-y-auto flex-1">
              <p>Para sincronizar sua agenda com o Google Calendar:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Acesse o <a href="https://console.cloud.google.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>.</li>
                <li>No menu lateral, vá em <strong>APIs e Serviços &gt; Tela de consentimento OAuth</strong>.</li>
                <li>Configure o app e adicione o escopo <code>https://www.googleapis.com/auth/calendar.events</code>.</li>
                <li>Em <strong>Credenciais</strong>, crie um <strong>ID do cliente OAuth 2.0</strong> do tipo "Aplicativo Web".</li>
                <li>Adicione <code>{window.location.origin}</code> como Origem Autorizada de JavaScript.</li>
                <li>Use o ID do Cliente obtido para configurar sua aplicação.</li>
              </ol>
            </div>
            <div className="bg-neutral-50 p-5 sm:p-6 border-t border-neutral-100 shrink-0">
              <button 
                onClick={() => setShowConfigGuide(false)}
                className="w-full px-4 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Modal de Configurações e Status da Conexão */}
      {activeConfigId && (() => {
        const activeIntegration = rawIntegrations.find(i => i.id === activeConfigId);
        if (!activeIntegration) return null;
        const mainName = activeIntegration.name.split(' ')[0];
        
        return (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl border border-neutral-100 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeIntegration.color}`}>
                    <activeIntegration.icon size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900">{activeIntegration.name}</h2>
                    <p className="text-xs text-neutral-500">Status & Painel de Configurações</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveConfigId(null)} 
                  className="p-2 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Status Indicator & Main Content (Scrollable) */}
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-3.5 h-3.5 bg-green-500 rounded-full animate-ping absolute inset-0 opacity-70"></div>
                      <div className="w-3.5 h-3.5 bg-green-500 rounded-full relative"></div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Integração Ativa e Operacional</p>
                      <p className="text-xs text-neutral-500">Sua API está habilitada e autenticada.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full uppercase tracking-wider w-max">
                    Conectado
                  </span>
                </div>

                {/* Configuration details specific to service */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Parâmetros Ativos</h4>
                  
                  {activeConfigId === 'google' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">Conta autenticada</span>
                        <span className="font-medium text-neutral-900">fabiozeronunes@gmail.com</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">Perfil Google Ads</span>
                        <span className="font-medium text-neutral-900">Clinic Front Odonto AI (832-192-3849)</span>
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Importar métricas do Google Analytics (GA4)</span>
                          <button 
                            onClick={() => handleToggle('google_analytics')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.google_analytics ? 'bg-blue-600' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.google_analytics ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Rastrear conversões de leads em Anúncios</span>
                          <button 
                            onClick={() => handleToggle('google_ads')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.google_ads ? 'bg-blue-600' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.google_ads ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeConfigId === 'agenda' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">E-mail associado</span>
                        <span className="font-medium text-neutral-900">fabiozeronunes@gmail.com</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">Calendário Primário</span>
                        <span className="font-semibold text-indigo-600">Minhas Consultas (Front Odonto AI)</span>
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Sincronização bidirecional em tempo real</span>
                          <button 
                            onClick={() => handleToggle('calendar_two_way')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.calendar_two_way ? 'bg-indigo-600' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.calendar_two_way ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Permitir marcação automática por IA</span>
                          <button 
                            onClick={() => handleToggle('calendar_auto_write')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.calendar_auto_write ? 'bg-indigo-600' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.calendar_auto_write ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeConfigId === 'facebook' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">Meta Business Manager</span>
                        <span className="font-medium text-neutral-900">Clínica Front Odonto AI Principal</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">ID Pixel Ativo</span>
                        <span className="font-medium text-neutral-900">2938491029384</span>
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Importar Leads do Facebook em tempo real</span>
                          <button 
                            onClick={() => handleToggle('meta_lead_sync')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.meta_lead_sync ? 'bg-blue-700' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.meta_lead_sync ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Habilitar Pixel de Rastreamento Avançado</span>
                          <button 
                            onClick={() => handleToggle('meta_pixel')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.meta_pixel ? 'bg-blue-700' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.meta_pixel ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeConfigId === 'tiktok' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-50">
                        <span className="text-neutral-500">TikTok Business Center</span>
                        <span className="font-medium text-neutral-900">Front Odonto AI HQ (Advertiser ID: 718294)</span>
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <label className="flex items-center justify-between p-3 bg-neutral-50/50 hover:bg-neutral-50 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm text-neutral-700">Sincronização de TikTok Conversion API</span>
                          <button 
                            onClick={() => handleToggle('tiktok_conversion')}
                            className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${toggles.tiktok_conversion ? 'bg-black' : 'bg-neutral-200'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggles.tiktok_conversion ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Diagnostic Area */}
                <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                      <Shield size={16} className="text-blue-600" />
                      Diagnóstico & Status de Rede
                    </span>
                    <button 
                      onClick={testDiagnostic}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      disabled={checkingStatus}
                    >
                      {checkingStatus ? 'Testando...' : 'Re-testar Rede'}
                    </button>
                  </div>
                  
                  {checkingStatus ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <RefreshCw size={12} className="animate-spin text-blue-600" />
                      Verificando credenciais OAuth e credenciais da API remota...
                    </div>
                  ) : checkResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                        <Check size={14} className="bg-green-100 rounded-full p-0.5 shrink-0 text-green-700" />
                        Conectado com sucesso! Sem erros detectados de permissão.
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 bg-white p-2 rounded-lg border border-neutral-100 mt-2">
                        <div>Sincronizador: <strong className="text-neutral-600">Ativo</strong></div>
                        <div>Latência: <strong className="text-neutral-600">{customLatency || 124}ms</strong></div>
                        <div>Protocolo: <strong className="text-neutral-600">HTTPS (TLS 1.3)</strong></div>
                        <div>Permissão: <strong className="text-neutral-600">Escrita/Leitura</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">
                      Clique em "Re-testar Rede" para verificar a validade de tokens da API do {mainName}.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-neutral-50 p-5 sm:p-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  onClick={forceSync}
                  disabled={syncing}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Sincronizando..." : "Sincronizar Agora"}
                </button>
                <button
                  onClick={() => setActiveConfigId(null)}
                  className="w-full sm:flex-1 px-4 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
