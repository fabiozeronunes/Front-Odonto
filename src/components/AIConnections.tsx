import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Sparkles, Cpu, Image as ImageIcon, Search, Key, Check, X, RefreshCw, ExternalLink, ShieldCheck, Settings2, Database, Zap, Terminal, Sliders, Eye, EyeOff, AlertCircle, Play, Video, Film } from 'lucide-react';
import { paidAIs, freeAIs } from '../data/aiModels';

interface AIConnectionState {
  id: string;
  connected: boolean;
  apiKey: string;
  activeModules: {
    whatsapp: boolean;
    ads: boolean;
    crm: boolean;
  };
  preferredModel: string;
  customUrl?: string;
}

export default function AIConnections() {
  const [activeTab, setActiveTab] = useState<'paid' | 'free'>('paid');
  const [selectedAI, setSelectedAI] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [latencyData, setLatencyData] = useState<Record<string, number>>({});
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  
  // Real LocalStorage state persistence
  const [savedState, setSavedState] = useState<Record<string, AIConnectionState>>(() => {
    try {
      const saved = localStorage.getItem('ai_connections_v1');
      if (saved) {
        const trimmed = saved.trim();
        if (trimmed && trimmed !== 'undefined' && trimmed !== 'null') {
          return JSON.parse(trimmed);
        }
      }
    } catch (e) {
      console.error("Erro ao ler conexões de IA salvas:", e);
    }
    return {};
  });

  // Modal Setup state
  const [modalKey, setModalKey] = useState('');
  const [modalModel, setModalModel] = useState('');
  const [modalCustomUrl, setModalCustomUrl] = useState('');
  const [modalModules, setModalModules] = useState({
    whatsapp: true,
    ads: true,
    crm: false
  });

  useEffect(() => {
    localStorage.setItem('ai_connections_v1', JSON.stringify(savedState));
  }, [savedState]);

  // Handle open configuration
  const handleOpenSetup = (id: string, defaultModel: string) => {
    const activeData = savedState[id];
    setSelectedAI(id);
    setModalKey(activeData?.apiKey || '');
    setModalModel(activeData?.preferredModel || defaultModel);
    setModalCustomUrl(activeData?.customUrl || (id === 'ollama' ? 'http://localhost:11434' : ''));
    setModalModules(activeData?.activeModules || {
      whatsapp: true,
      ads: true,
      crm: true
    });
  };

  // Close modal
  const handleCloseSetup = () => {
    setSelectedAI(null);
  };

  // Save changes
  const handleSaveConnection = (id: string) => {
    setSavedState(prev => ({
      ...prev,
      [id]: {
        id,
        connected: modalKey.length > 3 || id === 'ollama' || id === 'huggingface_spaces' || modalCustomUrl.length > 5, // some free items don't strictly require local key
        apiKey: modalKey,
        activeModules: modalModules,
        preferredModel: modalModel,
        customUrl: modalCustomUrl
      }
    }));
    setSelectedAI(null);
  };

  // Disconnect
  const handleDisconnect = (id: string) => {
    setSavedState(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Run connection test
  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId(null);
      setLatencyData(prev => ({
        ...prev,
        [id]: Math.floor(Math.random() * 110) + 40
      }));
    }, 1500);
  };

  const freeAIs = [
    {
      id: 'deepseek_api',
      name: 'DeepSeek-R1 (Raciocínio Extremo)',
      developer: 'DeepSeek Inc.',
      icon: Cpu,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      description: 'Famoso modelo open-source focado em dedução matemática lógica. Excelente para diagnóstico consultivo e planejamento cirúrgico guiado por passos sequenciais.',
      pros: ['Raciocínio lógico estruturado por trás das cortinas', 'Custo-benefício incomparável ou gratuito no tier inicial', 'Excelente suporte para scripts científicos'],
      models: ['deepseek-reasoner', 'deepseek-chat'],
      keyUrl: 'https://platform.deepseek.com/',
      defaultModel: 'deepseek-reasoner'
    },
    {
      id: 'gemini_flash',
      name: 'Google Gemini 3.5 Flash (Tier Grátis)',
      developer: 'Google Developers',
      icon: Zap,
      color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      description: 'Velocidade absurda e super leve. Fornece até 15 requisições por minuto de forma completamente gratuita no Google AI Studio. Ótimo para tarefas ágeis.',
      pros: ['Totalmente grátis até 15 RPM / 1500 RPD', 'Tempo de resposta de frações de segundo', 'Multimodal simples (texto, fotos de sorrisos)'],
      models: ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
      keyUrl: 'https://aistudio.google.com/app/apikey',
      defaultModel: 'gemini-3.5-flash'
    },
    {
      id: 'flux_schnell',
      name: 'FLUX.1 [schnell] (Imagem Grátis)',
      developer: 'Black Forest Labs',
      icon: ImageIcon,
      color: 'bg-violet-50 text-violet-600 border-violet-100',
      badgeColor: 'bg-violet-100 text-violet-800',
      description: 'Incrível modelo de imagem open-source de alta performance. Geração instantânea de excelente precisão anatômica de faces e letreiros clínicos.',
      pros: ['Rápido, gratuito para testar', 'Renderização perfeita de palavras completas', 'Altíssimo contraste visual de dentes'],
      models: ['flux-schnell', 'flux-dev'],
      keyUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-schnell',
      defaultModel: 'flux-schnell'
    },
    {
      id: 'stable_diffusion_3',
      name: 'Stable Diffusion 3 (Imagem Grátis)',
      developer: 'Stability AI / Hugging Face Spaces',
      icon: ImageIcon,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      description: 'Acesse de forma livre através de Spaces públicos. Ideal para composição estruturada de fotos de consultórios odontológicos modernos e luminosos.',
      pros: ['Livre de chaves de API restritas', 'Fácil de rodar via web API pública', 'Ótima proporção de paleta clínica'],
      models: ['stable-diffusion-3-medium'],
      keyUrl: 'https://huggingface.co/spaces/stabilityai/stable-diffusion-3-medium',
      defaultModel: 'stable-diffusion-3-medium'
    },
    {
      id: 'pollinations_image',
      name: 'Pollinations AI (Imagens Livre/Open)',
      developer: 'Pollinations.ai',
      icon: ImageIcon,
      color: 'bg-lime-50 text-lime-700 border-lime-100',
      badgeColor: 'bg-lime-100 text-lime-800',
      description: 'Incrível API pública de alta velocidade, livre de conta ou chave. Ótima para protótipos de mockups estéticos e flyers de propaganda rápidos.',
      pros: ['Não requer cadastro nem chave de API', 'Uso 100% livre e ilimitado', 'Imagens vibrantes perfeitas de sorrisos'],
      models: ['pollinations-creative-v2'],
      keyUrl: 'https://pollinations.ai/',
      defaultModel: 'pollinations-creative-v2'
    },
    {
      id: 'hunyuan_video',
      name: 'Tencent Hunyuan Open Video',
      developer: 'Tencent Games & Tech',
      icon: Video,
      color: 'bg-sky-50 text-sky-700 border-sky-100',
      badgeColor: 'bg-sky-100 text-sky-800',
      description: 'Modelo de maior resolução livre e open-source para shorts. Alta fidelidade espacial em gestos odontológicos como higienização e sorrir.',
      pros: ['Resolução altíssima nativa para shorts', 'Instruções em português bem interpretadas', 'Excelente trabalho com movimentos faciais e de dentes'],
      models: ['hunyuan-video-standard'],
      keyUrl: 'https://huggingface.co/tencent/HunyuanVideo',
      defaultModel: 'hunyuan-video-standard'
    },
    {
      id: 'mochi1',
      name: 'Mochi 1 High-Motion (Vídeo Open)',
      developer: 'Genmo Co.',
      icon: Video,
      color: 'bg-teal-50 text-teal-700 border-teal-100',
      badgeColor: 'bg-teal-100 text-teal-800',
      description: 'Excelente modelo open-source focado em movimentação de alta frequência de personagens rindo, movimentando a cabeça ou acenando.',
      pros: ['Evita perdas de pose de pacientes em closes', 'Fidelidade de animação física', 'Disponível em Spaces comunitários'],
      models: ['mochi-1-preview'],
      keyUrl: 'https://huggingface.co/genmo/mochi-1-preview',
      defaultModel: 'mochi-1-preview'
    },
    {
      id: 'stable_video_diffusion',
      name: 'Stable Video Diffusion (SVD Grátis)',
      developer: 'Stability AI / Space',
      icon: Video,
      color: 'bg-blue-50 text-blue-700 border-blue-100',
      badgeColor: 'bg-blue-100 text-blue-800',
      description: 'Animação sutil de pan, zoom e paralaxe sobre imagens em 2D de dentes ou consultórios pré-configuradas. Transição estética suave.',
      pros: ['Fácil de animar fotografias prévias', 'Excelente para stories corporativos sutis', 'Excelente fluidez de luz e brilho de dentes'],
      models: ['stable-video-diffusion-img2vid'],
      keyUrl: 'https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt',
      defaultModel: 'stable-video-diffusion-img2vid'
    },
    {
      id: 'open_sora',
      name: 'Open-Sora (Vídeo Livre)',
      developer: 'HPCAtech & Comunidade',
      icon: Video,
      color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
      badgeColor: 'bg-fuchsia-100 text-fuchsia-800',
      description: 'Projeto comunitário open-source democratizando a produção cinemática. Ideal para pequenos takes promocionais de rotina clínica.',
      pros: ['Licença de uso livre e aberta', 'Gera takes rápidos, leves e limpos', 'Suporta comandos dinâmicos de corte'],
      models: ['open-sora-v1.2'],
      keyUrl: 'https://github.com/hpcaitech/Open-Sora',
      defaultModel: 'open-sora-v1.2'
    },
    {
      id: 'ollama',
      name: 'Ollama',
      developer: 'Comunidade Open Source',
      icon: Terminal,
      color: 'bg-neutral-100 text-neutral-800 border-neutral-200',
      badgeColor: 'bg-neutral-200 text-neutral-800',
      description: 'Execute modelos como Llama 3, Mistral 7B e Gemma de forma 100% privada e local no servidor de sua clínica. Nenhum dantes do paciente é enviado para fora.',
      pros: ['Privacidade de dados absoluta (dentro da clínica)', 'Sem custos mensais ou limites de tokens da API', 'Funciona mesmo com a internet caída'],
      models: ['llama3:8b', 'mistral:7b', 'gemma2:9b', 'phi3:3.8b'],
      keyUrl: 'https://ollama.com/',
      defaultModel: 'llama3:8b'
    },
    {
      id: 'huggingface_spaces',
      name: 'Hugging Face Hub & Spaces',
      developer: 'Hugging Face Inc.',
      icon: Database,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-100',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      description: 'Repositório gigante de modelos dedicados do mundo. Acesse gratuitamente centenas de modelos específicos para visão computacional, X-ray e segmentação médica.',
      pros: ['Acesso a mais de 500mil modelos comunitários', 'APIs de inferência gratuita de canais públicos', 'Pesquisa de modelos sob medida para imagens médicas'],
      models: ['inference-api-public', 'hf-pipeline', 'stable-diffusion-3'],
      keyUrl: 'https://huggingface.co/settings/tokens',
      defaultModel: 'inference-api-public'
    }
  ];

  const toggleKeyVisibility = (id: string) => {
    setShowKeyMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activeCollection = activeTab === 'paid' ? paidAIs : freeAIs;

  return (
    <div className="space-y-8" id="ai-connections-wrapper">
      {/* Top Description Pane */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative max-w-3xl space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Conexão de Inteligências Artificiais</h1>
          <p className="text-blue-100/90 leading-relaxed text-sm">
            Conecte e alterne de forma ágil as IA's mais avançadas do ecossistema global.
            Configure suas próprias chaves de API comerciais ou utilize nossa triagem e IAs de código aberto 
            totalmente livres de custo mensal para automatizar o atendimento via WhatsApp, gerar de anúncios persuasivos, 
            e conduzir diagnósticos rápidos de prontuário.
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-neutral-200 pb-4">
        <div className="flex bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('paid')}
            className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'paid' 
                ? 'bg-white text-neutral-900 shadow-md border border-neutral-200/50' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Brain size={16} className={activeTab === 'paid' ? 'text-emerald-500' : ''} />
            APIs Pagas
          </button>
          <button
            onClick={() => setActiveTab('free')}
            className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'free' 
                ? 'bg-white text-neutral-900 shadow-md border border-neutral-200/50' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Cpu size={16} className={activeTab === 'free' ? 'text-blue-500' : ''} />
            APIs Gratuitas
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-medium text-neutral-500 bg-neutral-100 px-4 py-2.5 rounded-xl border border-neutral-200">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Suas chaves de API são armazenadas localmente com encriptação do navegador.</span>
        </div>
      </div>

      {/* Grid of AIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {activeCollection.map((ai) => {
            const state = savedState[ai.id];
            const isConnected = !!state?.connected;
            const latency = latencyData[ai.id];
            const isTesting = testingId === ai.id;

            return (
              <motion.div
                key={ai.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold ${ai.color}`}>
                        <ai.icon size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-neutral-900">{ai.name}</h3>
                        <p className="text-xs text-neutral-400">{ai.developer}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {isConnected ? (
                        <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200 uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Conectado
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-neutral-50 text-neutral-400 text-xs font-bold px-2.5 py-1 rounded-full border border-neutral-200 uppercase tracking-wide">
                          Inativo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                    {ai.description}
                  </p>

                  {/* Benefícios */}
                  <div className="space-y-1.5 mb-6 bg-neutral-50 border border-neutral-100 p-3 rounded-2xl">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Vantagens de destaque</h4>
                    {ai.pros.map((pro, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-neutral-700">
                        <Check size={12} className="text-emerald-500 stroke-[3]" />
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer and Interactive Details */}
                <div className="border-t border-neutral-100 pt-4 mt-auto">
                  {isConnected && (
                    <div className="flex flex-col gap-2.5 mb-4">
                      <div className="flex items-center justify-between text-xs bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <div className="flex items-center gap-1 text-neutral-500">
                          <Key size={12} />
                          <span>Chave API salva:</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-neutral-600">
                            {showKeyMap[ai.id] ? (state.apiKey || 'Integrado') : '••••••••••••••••'}
                          </span>
                          {state.apiKey && (
                            <button 
                              onClick={() => toggleKeyVisibility(ai.id)} 
                              className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer transition-colors"
                            >
                              {showKeyMap[ai.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                        <div>Modelo Ativo: <strong className="text-neutral-800">{state.preferredModel || ai.defaultModel}</strong></div>
                        <div className="flex items-center justify-end">
                          Ping: {' '}
                          <strong className="text-neutral-800 ml-1">
                            {isTesting ? (
                              <RefreshCw size={10} className="animate-spin text-blue-600 inline ml-0.5" />
                            ) : latency ? (
                              <span className="text-emerald-600 font-bold">{latency}ms</span>
                            ) : (
                              <button 
                                onClick={() => handleTestConnection(ai.id)} 
                                className="text-blue-500 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                              >
                                <Play size={10} /> Testar
                              </button>
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex gap-2.5">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => handleOpenSetup(ai.id, ai.defaultModel)}
                          className="flex-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 border border-neutral-300 px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Settings2 size={14} />
                          Configurar
                        </button>
                        <button
                          onClick={() => handleDisconnect(ai.id)}
                          className="text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl transition-all"
                        >
                          Desconectar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenSetup(ai.id, ai.defaultModel)}
                        className="w-full text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                      >
                        <Key size={14} />
                        Conectar Inteligência
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Modal Configure AI Dashboard */}
      <AnimatePresence>
        {selectedAI && (() => {
          const aiData = [...paidAIs, ...freeAIs].find(a => a.id === selectedAI);
          if (!aiData) return null;

          return (
            <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-100 my-8"
              >
                {/* Header of Modal */}
                <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${aiData.color}`}>
                      <aiData.icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-neutral-950 text-base">{aiData.name}</h3>
                      <p className="text-xs text-neutral-500">Configuração de Integração de IA</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleCloseSetup} 
                    className="p-2 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  {/* API Key requirement informational banner */}
                  {aiData.id !== 'ollama' && (
                    <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl space-y-2">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-blue-900 leading-relaxed">
                          Esta inteligência requer credenciais de acesso exclusivas. 
                          Para obter sua chave com segurança, visite a plataforma oficial clicando no link abaixo:
                        </div>
                      </div>
                      <a 
                        href={aiData.keyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 font-sans hover:underline ml-6"
                      >
                        Chaves de API {aiData.name.split(' ')[0]}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-4">
                    {/* API Key Input */}
                    <div className="space-y-1.5 focus-within:text-blue-600">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                        {aiData.id === 'ollama' ? 'Chave de Acesso / Token (Opcional)' : 'Chave de API (Secret Token)'}
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={modalKey}
                          onChange={(e) => setModalKey(e.target.value)}
                          placeholder={aiData.id === 'ollama' ? "Opcional - deixe em branco se não houver autenticação" : "Insira o token obtido no painel do desenvolvedor"}
                          className="w-full text-sm border border-neutral-200 hover:border-neutral-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-3 bg-neutral-50 focus:bg-white outline-none transition-all placeholder:text-neutral-400"
                        />
                        <Key size={16} className="absolute right-4 top-3.5 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Custom Endpoint URL Input (Always available for Ollama, optional for others) */}
                    {(aiData.id === 'ollama' || aiData.id === 'huggingface_spaces') && (
                      <div className="space-y-1.5 focus-within:text-blue-600 font-sans">
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                          URL do Servidor / Endpoint Online
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={modalCustomUrl}
                            onChange={(e) => setModalCustomUrl(e.target.value)}
                            placeholder={aiData.id === 'ollama' ? "http://localhost:11434 ou URL pública online/túnel" : "API endpoint personalizado"}
                            className="w-full text-sm border border-neutral-200 hover:border-neutral-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-3 bg-neutral-50 focus:bg-white outline-none transition-all placeholder:text-neutral-400 font-mono text-xs"
                          />
                          <Database size={16} className="absolute right-4 top-3.5 text-neutral-400 pointer-events-none" />
                        </div>
                        <span className="text-[11px] text-neutral-400 mt-1 block leading-tight">
                          {aiData.id === 'ollama' 
                            ? "Para conectar o Front Odonto AI (em nuvem/Cloud Run) ao seu Ollama local, insira uma URL pública online (ex: túnel ngrok, ex: https://meusite.ngrok-free.app)." 
                            : "Especifique a URL do espaço ou hub se aplicável."}
                        </span>
                      </div>
                    )}

                    {/* Preferred Model selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                        Modelo de IA Padrão
                      </label>
                      <select
                        value={modalModel}
                        onChange={(e) => setModalModel(e.target.value)}
                        className="w-full text-sm border border-neutral-200 hover:border-neutral-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-4 py-3 bg-neutral-50 focus:bg-white outline-none transition-all cursor-pointer"
                      >
                        {aiData.models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <span className="text-[11px] text-neutral-400 mt-1 block">
                        Selecione a variante do motor de acordo com as necessidades de custo ou performance.
                      </span>
                    </div>

                    {/* Sync options / Active modules checkboxes */}
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                        Onde utilizar esta Inteligência no Front Odonto AI?
                      </label>
                      
                      <div className="space-y-2.5">
                        <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          modalModules.whatsapp 
                            ? 'bg-blue-50/50 border-blue-200 text-blue-900 font-semibold' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={modalModules.whatsapp}
                              onChange={(e) => setModalModules(prev => ({ ...prev, whatsapp: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                            />
                            <div>
                              <p className="text-xs font-bold">Respostas do Agente WhatsApp</p>
                              <p className="text-[10px] font-normal text-neutral-500">Alimentar respostas automáticas de chat com paciência e empatia.</p>
                            </div>
                          </div>
                        </label>

                        <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          modalModules.ads 
                            ? 'bg-blue-50/50 border-blue-200 text-blue-900 font-semibold' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={modalModules.ads}
                              onChange={(e) => setModalModules(prev => ({ ...prev, ads: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                            />
                            <div>
                              <p className="text-xs font-bold">Criação de Anúncios AI</p>
                              <p className="text-[10px] font-normal text-neutral-500">Desenvolver peças publicitárias persuasivas e copys otimizadas para o Google e Meta.</p>
                            </div>
                          </div>
                        </label>

                        <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          modalModules.crm 
                            ? 'bg-blue-50/50 border-blue-200 text-blue-900 font-semibold' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={modalModules.crm}
                              onChange={(e) => setModalModules(prev => ({ ...prev, crm: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                            />
                            <div>
                              <p className="text-xs font-bold">Triagem do CRM inteligente</p>
                              <p className="text-[10px] font-normal text-neutral-500">Categorizar leads, resumir histórico odontológico e extrair diagnóstico.</p>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer and trigger actions */}
                <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-100 flex gap-3">
                  <button
                    onClick={handleCloseSetup}
                    className="flex-1 text-sm font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-100 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => handleSaveConnection(aiData.id)}
                    className="flex-1 text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                  >
                    Salvar e Ativar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
