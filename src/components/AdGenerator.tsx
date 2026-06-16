import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Sparkles, 
  Copy, 
  RefreshCw, 
  Facebook, 
  Instagram, 
  Search, 
  Music, 
  Layout, 
  Smartphone,
  CheckCircle2,
  Bookmark,
  Target,
  Heart,
  MousePointerClick,
  Info,
  Brain,
  Image as ImageIcon,
  Video,
  Film,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { allAIs } from '../data/aiModels';

const platforms = [
  { id: 'facebook', label: 'Facebook / IG', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50/70' },
  { id: 'google', label: 'Google Ads', icon: Search, color: 'text-emerald-600', bg: 'bg-emerald-50/70' },
  { id: 'tiktok', label: 'TikTok Ads', icon: Music, color: 'text-pink-600', bg: 'bg-pink-50/70' },
];

const tones = [
  { id: 'professional', label: '👩‍⚕️ Profissional', desc: 'Sério, baseado em autoridade de saúde e segurança' },
  { id: 'creative', label: '✨ Criativo', desc: 'Provocativo, com apelo visual e gírias de impacto' },
  { id: 'urgent', label: '🚨 Urgente', desc: 'Com tom de escassez, vagas limitadas e apelo a dor' },
  { id: 'friendly', label: '❤️ Acolhedor', desc: 'Foco na empatia, no acolhimento e fim do medo' },
];

const specialties = [
  { id: 'implants', label: 'Implantes & Próteces', desc: 'Foco em dentes fixos, mastigação perfeita, segurança bucal e sorrisos firmes' },
  { id: 'aligners', label: 'Alinhadores Invisíveis', desc: 'Estética discreta com Invisalign, ClearCorrect, foco em tecnologia e conforto' },
  { id: 'aesthetic', label: 'Lentes de Porcelana & Facetas', desc: 'Sorriso de artista, dentes perfeitamente alinhados, brancos e rejuvenescimento facial' },
  { id: 'ortho', label: 'Ortodontia Convencional', desc: 'Aparelhos fixos estéticos ou autoligados, correção de mordida para crianças ou adultos' },
  { id: 'canal', label: 'Endodontia Sem Dor (Canal)', desc: 'Emergências e canal em sessão única com microscopia eletrônica e conforto absoluto' },
  { id: 'whitening', label: 'Clareamento Dental Laser', desc: 'Aumente o brilho do sorriso de forma segura e rápida para eventos ou dia a dia' },
];

const hooks = [
  { id: 'simulacao', label: 'Simulação Digital 3D', desc: 'Exibir como o sorriso ficará antes mesmo de começar o tratamento com scanner iterativo' },
  { id: 'sem_medo', label: 'Atendimento Humanizado Sem Dor', desc: 'Perfeito para relaxar sob sedação consciente ou técnicas inovadoras' },
  { id: 'parcelamento', label: 'Facilidades de Pagamento', desc: 'Planos facilitados em até 24x ou condições que cabem perfeitamente no bolso' },
  { id: 'especialista', label: 'Corpo Clínico Premium', desc: 'Atendido exclusivamente por especialistas, mestres ou doutores em cada área' },
  { id: 'tecnologia', label: 'Laser Terapia & Diagnóstico Digital', desc: 'Sem cortes dramáticos, cicatrização acelerada e exatidão total' },
];

const targetAudiences = [
  { id: 'seniors_adults', label: 'Adultos & Terceira Idade', desc: 'Que perderam dentes e desejam resgatar a vitalidade e poder mastigar sem incoveniente' },
  { id: 'young_professionals', label: 'Jovens & Profissionais Liberais', desc: 'Desejam crescer na carreira através de uma imagem impecável e sorriso magnético' },
  { id: 'families_moms', label: 'Famílias & Mães', desc: 'Segurança, prevenção infantil, carinho e estrutura completa para todos do lar' },
  { id: 'event_goers', label: 'Noivos & Formandos', desc: 'Pessoas com data marcada para grandes fotos e momentos solenes na vida' },
];

const coreBenefits = [
  { id: 'esteem', label: 'Autoestima & Autoconfiança', desc: 'Fim do hábito de cobrir a boca com a mão ao rir' },
  { id: 'health_chew', label: 'Saúde Geral & Mastigação Perfeita', desc: 'Liberdade absoluta para comer churrasco ou alimentos firmes sem receio' },
  { id: 'aesthetic_look', label: 'Visual Rejuvenescido & Simetria', desc: 'Correção de desníveis faciais que deixam a face cansada' },
  { id: 'fast_results', label: 'Segurança e Praticidade', desc: 'Ganhar tempo com técnicas digitais rápidas' },
];

const ctas = [
  { id: 'whatsapp', label: 'Botão Conectar no WhatsApp', desc: 'Fale de forma reservada diretamente com o nosso especialista agora' },
  { id: 'agendar_simulado', label: 'Agendar Avaliação e Escaneamento', desc: 'Reservar na hora o check-up digital' },
  { id: 'tabela_valores', label: 'Receber Condições & Facilidades', desc: 'Interagir para obter simulação de faturamento personalizado' },
  { id: 'clinic_direction', label: 'Solicitar Endereço & Traçar Rota', desc: 'Iniciar rota direta pelo GPS no Google Maps' },
];

function parseAdContent(content: string) {
  let headline = "";
  let bodyCopy = "";
  let cta = "";
  let visualPrompt = "";
  let videoScript = "";
  let hashtags: string[] = [];

  const lines = content.split('\n');
  let currentSec = "";
  const bodyLines: string[] = [];
  const scriptLines: string[] = [];
  const visualLines: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();

    // Check headlines
    if (lower.includes("título magnético") || lower.includes("headline:") || (lower.startsWith("* **título") && lower.includes("**")) || lower.startsWith("### 🏛️ campanha")) {
      headline = trimmed.replace(/^[*\s-]*(título magnético|headline|título|campanha|title)[:\s*]+/gi, "").replace(/\*+/g, "").trim();
      continue;
    }

    // Check CTAs
    if (lower.includes("chamada de ação") || lower.includes("cta:") || (lower.startsWith("* **chamada") && lower.includes("**"))) {
      cta = trimmed.replace(/^[*\s-]*(chamada de ação final|cta|chamada de ação|botão)[:\s*]+/gi, "").replace(/\*+/g, "").trim();
      continue;
    }

    // Check for hashtags
    if (trimmed.includes("#")) {
      const foundTags = trimmed.match(/#[a-zA-Z0-9áàâãéèêíïóôõöúçñ_]+/g);
      if (foundTags) {
        hashtags = [...hashtags, ...foundTags];
      }
    }

    // Section triggers
    if (lower.includes("diretriz estética") || lower.includes("conceito visual") || lower.includes("visual prompt") || lower.includes("diretriz de corte")) {
      currentSec = "visual";
      continue;
    }
    if (lower.includes("roteiro do vídeo") || lower.includes("roteiro") || lower.includes("video script") || lower.includes("estrutura de reels") || lower.includes("cena ") || lower.includes("roteiro recomendado")) {
      currentSec = "script";
      continue;
    }
    if (lower.includes("texto de legenda") || lower.includes("legenda do post") || lower.includes("legenda curta") || lower.includes("texto principal") || lower.includes("copywriting principal") || lower.includes("legenda do post:")) {
      currentSec = "body";
      continue;
    }

    // Capture sections
    if (currentSec === "body") {
      if (trimmed.startsWith("---") || trimmed.startsWith("####") || lower.includes("chamada de ação") || lower.includes("diretriz")) {
        currentSec = "";
      } else {
        bodyLines.push(trimmed);
      }
    } else if (currentSec === "script") {
      if (trimmed.startsWith("---") || trimmed.startsWith("####") || lower.includes("chamada de ação") || lower.includes("diretriz")) {
        currentSec = "";
      } else {
        scriptLines.push(trimmed);
      }
    } else if (currentSec === "visual") {
      if (trimmed.startsWith("---") || trimmed.startsWith("####") || lower.includes("chamada de ação") || lower.includes("roteiro")) {
        currentSec = "";
      } else {
        visualLines.push(trimmed);
      }
    }
  }

  bodyCopy = bodyLines.join('\n').trim();
  videoScript = scriptLines.join('\n').trim();
  visualPrompt = visualLines.join('\n').trim();

  const cleanStr = (s: string) => s.replace(/^([> \s`"':\-\*])+|([> \s`"':\-\*])+$/g, "").trim();

  if (!bodyCopy) {
    bodyCopy = content;
  }

  return {
    headline: cleanStr(headline) || "Campanha Odontológica Premium",
    bodyCopy: cleanStr(bodyCopy),
    cta: cleanStr(cta) || "Falar com Especialistas no WhatsApp",
    visualPrompt: cleanStr(visualPrompt),
    videoScript: cleanStr(videoScript),
    hashtags: Array.from(new Set(hashtags))
  };
}

export default function AdGenerator() {
  const [loading, setLoading] = useState(false);
  const [adResult, setAdResult] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState('facebook');
  const [activeTone, setActiveTone] = useState('professional');
  
  // Advanced customization refinement states (Replicated across all 3 platforms buttons)
  const [selectedSpecialty, setSelectedSpecialty] = useState('implants');
  const [selectedHook, setSelectedHook] = useState('simulacao');
  const [selectedAudience, setSelectedAudience] = useState('seniors_adults');
  const [selectedBenefit, setSelectedBenefit] = useState('esteem');
  const [selectedCta, setSelectedCta] = useState('whatsapp');
  const [customNotes, setCustomNotes] = useState('');
  const [selectedImageAI, setSelectedImageAI] = useState('midjourney_api');
  const [selectedVideoAI, setSelectedVideoAI] = useState('runway_gen3');
  const [adGeneratorActiveAI, setAdGeneratorActiveAI] = useState('openai');

  const imageAIs = allAIs.filter(ai => ai.icon === ImageIcon);
  const videoAIs = allAIs.filter(ai => ai.icon === Video || ai.icon === Film);
  // Filter for text-generative AI (those not for image/video)
  const textAIs = allAIs.filter(ai => ai.icon !== ImageIcon && ai.icon !== Video && ai.icon !== Film);

  const [activeAI, setActiveAI] = useState<{ id: string; name: string; model: string } | null>(
    () => {
      const initial = allAIs.find(a => a.id === 'openai');
      return initial ? { id: initial.id, name: initial.name, model: initial.defaultModel || '' } : null;
    }
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCreativeType, setLastCreativeType] = useState<'image' | 'video' | 'text' | null>(null);

  const [adDrafts, setAdDrafts] = useState<Array<{
    id: string;
    type: 'image' | 'video' | 'text';
    content: string;
    imageSrc: string;
  }>>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(0);

  const generateAd = async (creativeType: 'image' | 'video' | 'text', count: number = 1) => {
    setLoading(true);
    setAdResult(null);
    setErrorMsg(null);
    setLastCreativeType(creativeType);

    const specialtyObj = specialties.find(s => s.id === selectedSpecialty);
    const hookObj = hooks.find(h => h.id === selectedHook);
    const audienceObj = targetAudiences.find(a => a.id === selectedAudience);
    const benefitObj = coreBenefits.find(b => b.id === selectedBenefit);
    const ctaObj = ctas.find(c => c.id === selectedCta);

    // Deep descriptive prompt assembled from advanced refinement controls
    const fullTargetDescriptor = `
      --- SELEÇÕES DETALHADAS ---
      - Tratamento Principal: ${specialtyObj?.label} (${specialtyObj?.desc})
      - Gancho/Diferencial de Vendas: ${hookObj?.label} (${hookObj?.desc})
      - Recorte de Público-Alvo: ${audienceObj?.label} (${audienceObj?.desc})
      - Benefício Principal Desejado: ${benefitObj?.label} (${benefitObj?.desc})
      - CTA de Fechamento: ${ctaObj?.label} (${ctaObj?.desc})
      - Detalhes Customizados Adicionais: ${customNotes || 'Sem observações extras'}
    `;

    // Use the selected AI from dropdown
    let allStoredConnections: any = {};
    try {
      const stored = localStorage.getItem('ai_connections_v1');
      if (stored) {
        const trimmed = stored.trim();
        if (trimmed && trimmed !== 'undefined' && trimmed !== 'null') {
          allStoredConnections = JSON.parse(trimmed);
        }
      }
    } catch (e) {
      console.error("Erro ao fazer parse de ai_connections_v1:", e);
    }
    const selectedAIConfig = allStoredConnections[adGeneratorActiveAI];
    
    // Find the full AI object to get the name
    const aiObj = allAIs.find(a => a.id === adGeneratorActiveAI);

    try {
      const response = await fetch('/api/ads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target: fullTargetDescriptor,
          platform: activePlatform,
          tone: activeTone,
          creativeType,
          count,
          selectedAI: selectedAIConfig ? {
            id: adGeneratorActiveAI,
            name: aiObj?.name || adGeneratorActiveAI,
            apiKey: selectedAIConfig.apiKey || '',
            model: selectedAIConfig.preferredModel || aiObj?.defaultModel || '',
            customUrl: selectedAIConfig.customUrl || ''
          } : {
            id: adGeneratorActiveAI,
            name: aiObj?.name || adGeneratorActiveAI,
            apiKey: '',
            model: aiObj?.defaultModel || '',
            customUrl: ''
          },
          selectedImageAI,
          selectedVideoAI,
          clinicInfo: {
            name: "Front Odonto AI Clinic",
            location: "Centro, Rio de Janeiro",
            specialtyName: specialtyObj?.label,
            hookText: hookObj?.label,
            benefitAim: benefitObj?.label,
            ctaGoal: ctaObj?.label
          }
        })
      });
      const data = await response.json();
      if (response.ok) {
        setAdResult(data.ad);
        
        // Parse into drafts based on === VARIAÇÃO [N] === splitters
        const rawText = data.ad || "";
        let parsedVariations: string[] = [];

        if (rawText.toLowerCase().includes("=== variação")) {
          // split on === VARIAÇÃO x === tags
          const parts = rawText.split(/===\s*VARIAÇÃO\s*\d+\s*===/gi);
          // the first part might be the introductory disclaimer block. Let's capture it and keep it or discard if empty
          const filteredParts = parts.map((p: string) => p.trim()).filter((p: string) => p.length > 5);
          
          if (filteredParts.length > 0) {
            parsedVariations = filteredParts;
          } else {
            parsedVariations = [rawText];
          }
        } else {
          parsedVariations = [rawText];
        }

        const images = [
          "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1579684389782-64d84b5e905d?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1512223792601-592a9809eed4?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1473445711224-df4019417dc4?w=600&auto=format&fit=crop&q=80"
        ];

        const newDrafts = parsedVariations.map((content, index) => {
          return {
            id: `draft-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            type: creativeType,
            content,
            imageSrc: images[index % images.length]
          };
        });

        setAdDrafts(newDrafts);
        setActiveDraftIndex(0);
      } else {
        setErrorMsg("Erro ao processar anúncio: " + (data.error || "Erro desconhecido"));
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg("Erro ao conectar ao servidor para gerar anúncio: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8" id="refiled-ad-generator">
      {/* Input Panel with Detailed Controls */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-8">
          
          {/* Title Area */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-neutral-900 tracking-tight">Estúdio de Criação AI Ads</h3>
              <p className="text-xs text-neutral-400 font-medium">Configure detalhes profissionais sob medida para criar copys campeãs de conversão</p>
            </div>
          </div>

          {/* Step 1: Platforms Buttons */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">
              Passo 1: Selecione o canal de veiculação
            </span>
            <div className="grid grid-cols-3 gap-3">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`
                    flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative
                    ${activePlatform === p.id 
                      ? 'border-blue-600 bg-blue-50/50 scale-[1.01]' 
                      : 'border-neutral-100 hover:border-neutral-200 bg-neutral-50/50'}
                  `}
                >
                  {activePlatform === p.id && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                  <p.icon size={22} className={activePlatform === p.id ? p.color : 'text-neutral-400'} />
                  <span className={`text-[11px] font-black uppercase ${activePlatform === p.id ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Advanced Refinery Modules */}
          <div className="space-y-6 pt-2 border-t border-neutral-100">
            <div className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-800 text-xs px-3 py-1.5 rounded-xl font-bold border border-neutral-200">
              <Bookmark size={13} className="text-blue-600" />
              Opções de Refinamento Avançado (Ativas para {platforms.find(p => p.id === activePlatform)?.label})
            </div>

            {/* Specialty Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">2</span>
                Tratamento ou Especialidade em Destaque
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {specialties.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSpecialty(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedSpecialty === item.id 
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-500/20' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {selectedSpecialty === item.id && <CheckCircle2 size={13} className="text-blue-600 shrink-0" />}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-tight block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Competitive Differential (Hook) Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">3</span>
                Gatilho / Diferencial Comercial da Clínica
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {hooks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedHook(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedHook === item.id 
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-500/20' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {selectedHook === item.id && <CheckCircle2 size={13} className="text-blue-600 shrink-0" />}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-tight block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">4</span>
                Recorte de Público & Abordagem
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {targetAudiences.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAudience(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedAudience === item.id 
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-500/20' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {selectedAudience === item.id && <CheckCircle2 size={13} className="text-blue-600 shrink-0" />}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-tight block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Core Emotional or Rational Benefit */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">5</span>
                Benefício Mais Valioso Estimulado no Anúncio
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {coreBenefits.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedBenefit(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedBenefit === item.id 
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-500/20' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {selectedBenefit === item.id && <CheckCircle2 size={13} className="text-blue-600 shrink-0" />}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-tight block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Option Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">6</span>
                Chamada de Ação Principal (CTA)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ctas.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedCta(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedCta === item.id 
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-500/20' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      {selectedCta === item.id && <CheckCircle2 size={13} className="text-blue-600 shrink-0" />}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-tight block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone selector */}
            <div className="space-y-2.5 border-t border-neutral-100 pt-5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">7</span>
                Tom de Voz do Especialista AI
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                {tones.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTone(t.id)}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-0.5 ${
                      activeTone === t.id 
                        ? 'border-blue-600 bg-blue-50/30 font-bold' 
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <span className="text-xs text-neutral-900">{t.label}</span>
                    <span className="text-[9px] text-neutral-400 font-normal leading-normal">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Special notes or custom directives */}
            <div className="space-y-2 border-t border-neutral-100 pt-5">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">8</span>
                Instruções extras, promoções ou observações específicas (Opcional)
              </label>
              <textarea 
                className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[90px] resize-none"
                placeholder="Exemplo: Mencionar que temos vaga para atendimento noturno. Ou adicionar que o dr. Roberto estará atendendo no sábado do implante."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </div>

            {/* Main Action Triggers */}
            <div className="space-y-4 border-t border-neutral-100 pt-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">9</span>
                  Compor Tipo de Campanha
                </label>
                <div className="w-full">
                  <select
                    value={adGeneratorActiveAI}
                    onChange={(e) => {
                      setAdGeneratorActiveAI(e.target.value);
                      const selected = allAIs.find(a => a.id === e.target.value);
                      setActiveAI(selected ? {id: selected.id, name: selected.name, model: selected.defaultModel || ''} : null);
                    }}
                    className="w-full text-xs font-semibold bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-neutral-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
                  >
                    {textAIs.map(ai => (
                      <option key={ai.id} value={ai.id}>{ai.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeAI && (
                <p className="text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl">
                  🔋 Conectado ao canal <b>{activeAI.name}</b> com o modelo <code>{activeAI.model || 'Default'}</code>.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Image Generation Controller */}
                <div className="flex flex-col bg-white border border-neutral-200 hover:border-blue-600 hover:shadow-md hover:shadow-blue-500/5 rounded-3xl p-5 gap-4 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors shrink-0">
                      <ImageIcon size={20} />
                    </div>
                    <div className="text-left">
                      <h5 className="font-extrabold text-sm text-neutral-950">Com Imagem</h5>
                      <span className="text-[10px] text-neutral-400 font-medium leading-tight block">Prompt de arte e copy visual</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-neutral-100 pt-3">
                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Injetar IA de Imagem:</label>
                    <select
                      value={selectedImageAI}
                      onChange={(e) => setSelectedImageAI(e.target.value)}
                      className="w-full text-xs font-semibold bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-neutral-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
                      id="image-ai-selector"
                    >
                      {imageAIs.map(ai => (
                        <option key={ai.id} value={ai.id}>{ai.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5 mt-auto">
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Gerar para teste:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[1, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          onClick={() => generateAd('image', num)}
                          disabled={loading}
                          className="py-2 text-[10px] font-extrabold bg-neutral-50 hover:bg-blue-600 border border-neutral-200 hover:border-blue-600 text-neutral-800 hover:text-white rounded-xl transition-all cursor-pointer text-center active:scale-95 disabled:opacity-50"
                        >
                          {num} {num === 1 ? 'Foto' : 'Fotos'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Video Generation Controller */}
                <div className="flex flex-col bg-white border border-neutral-200 hover:border-blue-600 hover:shadow-md hover:shadow-blue-500/5 rounded-3xl p-5 gap-4 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors shrink-0">
                      <Video size={20} />
                    </div>
                    <div className="text-left">
                      <h5 className="font-extrabold text-sm text-neutral-950">Com Vídeo</h5>
                      <span className="text-[10px] text-neutral-400 font-medium leading-tight block">Roteiro cênico e ganchos em segundos</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-neutral-100 pt-3">
                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Injetar IA de Vídeo:</label>
                    <select
                      value={selectedVideoAI}
                      onChange={(e) => setSelectedVideoAI(e.target.value)}
                      className="w-full text-xs font-semibold bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-neutral-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
                      id="video-ai-selector"
                    >
                      {videoAIs.map(ai => (
                        <option key={ai.id} value={ai.id}>{ai.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5 mt-auto">
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Gerar para teste:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((num) => (
                        <button
                          key={num}
                          onClick={() => generateAd('video', num)}
                          disabled={loading}
                          className="py-2 text-[10px] font-extrabold bg-neutral-50 hover:bg-blue-600 border border-neutral-200 hover:border-blue-600 text-neutral-800 hover:text-white rounded-xl transition-all cursor-pointer text-center active:scale-95 disabled:opacity-50"
                        >
                          {num} {num === 1 ? 'Vídeo' : 'Vídeos'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text Generation Controller */}
                <div className="flex flex-col bg-white border border-neutral-200 hover:border-blue-600 hover:shadow-md hover:shadow-blue-500/5 rounded-3xl p-5 gap-4 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="text-left">
                      <h5 className="font-extrabold text-sm text-neutral-950">Como Texto</h5>
                      <span className="text-[10px] text-neutral-400 font-medium leading-tight block">Cópia descritiva de alta conversão</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5 mt-auto">
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Gerar para teste:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 3, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => generateAd('text', num)}
                          disabled={loading}
                          className="py-2 text-[10px] font-extrabold bg-neutral-50 hover:bg-blue-600 border border-neutral-200 hover:border-blue-600 text-neutral-800 hover:text-white rounded-xl transition-all cursor-pointer text-center active:scale-95 disabled:opacity-50"
                        >
                          {num} {num === 1 ? 'Texto' : 'Textos'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-500 font-medium">
                  <RefreshCw className="animate-spin text-blue-600" size={14} />
                  <span>Sincronizando com a IA {activeAI ? activeAI.name : 'Padrão (Gemini)'}... Compondo campanha...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ad Blueprint Review & Preview Panel */}
      <div className="lg:col-span-5 space-y-6">
        <AnimatePresence mode="wait">
          {errorMsg ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-50 border border-red-200 p-6 rounded-3xl text-red-900 space-y-4"
              id="error-block-ad"
            >
              <div className="flex items-center gap-2.5">
                <Info size={24} className="text-red-500 shrink-0" />
                <h4 className="font-bold text-neutral-900 text-sm">Ocorreu um erro no processamento</h4>
              </div>
              <p className="text-xs leading-relaxed text-neutral-700 font-sans">
                {errorMsg}
              </p>
              <div className="bg-white/80 p-3.5 rounded-2xl border border-red-100 text-[11px] text-neutral-600 font-medium">
                💡 <b>Dica de Suporte:</b> Se você está usando o <b>Ollama</b>, nosso sistema tentará acionar a nuvem automaticamente. Se preferir, altere o seletor na aba <b>"Conexão AI"</b> para a IA com tier grátis (Gemini Flash).
              </div>
            </motion.div>
          ) : adResult ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6"
            >
              {/* Header with main copy button */}
              <div className="flex items-center justify-between bg-neutral-50 p-3 py-2.5 rounded-2xl border border-neutral-100">
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-black uppercase tracking-widest pl-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping mr-1"></span>
                  Geração Concluída
                </div>
                <button 
                  onClick={() => {
                    const activeDraft = adDrafts[activeDraftIndex];
                    navigator.clipboard.writeText(activeDraft ? activeDraft.content : adResult || '');
                    alert("Rascunho atual copiado na íntegra!");
                  }}
                  className="p-1.5 px-3 hover:bg-neutral-100 text-neutral-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-neutral-200 bg-white shadow-sm"
                  title="Copiar rascunho atual para clipboard"
                >
                  <Copy size={12} />
                  Copiar Todo
                </button>
              </div>

              {/* Multi-Draft tab selector if we have multiple drafts */}
              {adDrafts.length > 1 && (
                <div className="bg-blue-50/50 border border-blue-100/60 p-3.5 rounded-3xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                      🗂️ Variações de Teste A/B ({adDrafts.length})
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">
                      Opção {activeDraftIndex + 1} ativa
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 progress-selector pt-1">
                    {adDrafts.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveDraftIndex(idx)}
                        className={`px-3 py-1.5 text-[11px] font-black rounded-xl transition-all cursor-pointer ${
                          activeDraftIndex === idx
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                            : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700'
                        }`}
                      >
                        Versão {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Simulated Preview Header according to Platform */}
              <div className="p-3 bg-neutral-50 border border-neutral-200/50 rounded-2xl flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <h5 className="text-[10px] font-extrabold text-neutral-800 uppercase tracking-widest leading-none">
                    Previsão de Rascunho - {platforms.find(p => p.id === activePlatform)?.label}
                  </h5>
                  <p className="text-[9px] text-neutral-400 mt-0.5 font-medium">Layout do anúncio gerado para a campanha da clínica</p>
                </div>
              </div>

              {/* Organized and beautifully spaced ad details */}
              {(() => {
                const activeDraft = adDrafts[activeDraftIndex];
                const activeContent = activeDraft ? activeDraft.content : adResult;
                const parsed = parseAdContent(activeContent || "");
                const creativeType = activeDraft ? activeDraft.type : lastCreativeType;

                return (
                  <div className="space-y-8" id="organized-ad-elements">
                    {/* 1. TÍTULO / HEADLINE */}
                    {parsed.headline && (
                      <div className="bg-white border border-neutral-200/90 border-l-4 border-l-blue-600 p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100 font-mono">
                            📌 Passo 1: TÍTULO PRINCIPAL (HEADLINE)
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(parsed.headline);
                              alert("Título copiado!");
                            }}
                            className="p-1.5 px-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-bold text-neutral-600 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <Copy size={11} /> Copiar Título
                          </button>
                        </div>
                        <h4 className="font-extrabold text-neutral-900 text-base leading-snug tracking-tight">
                          {parsed.headline}
                        </h4>
                      </div>
                    )}

                    {/* 2. LEGENDA PRINCIPAL */}
                    {parsed.bodyCopy && (
                      <div className="bg-white border border-neutral-200/90 border-l-4 border-l-emerald-500 p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100/60 font-mono">
                            ✍️ Passo 2: LEGENDA DO POST (COPYWRITING)
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(parsed.bodyCopy);
                              alert("Legenda copiada!");
                            }}
                            className="p-1.5 px-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-bold text-neutral-600 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <Copy size={11} /> Copiar Legenda
                          </button>
                        </div>
                        <div className="whitespace-pre-line text-neutral-805 text-sm leading-relaxed bg-neutral-50/50 p-5 border border-neutral-100 rounded-2xl font-normal">
                          {parsed.bodyCopy}
                        </div>
                      </div>
                    )}

                    {/* 3. MULTIMEDIA MOCKUP MÍDIA PREVIEW */}
                    {creativeType === 'image' && (
                      <div className="border border-neutral-200/90 border-l-4 border-l-indigo-600 bg-white p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100 font-mono">
                            🎨 Passo 3: DIRETRIZ VISUAL RECOMENDADA
                          </span>
                        </div>
                        <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50">
                          <div className="bg-neutral-100 px-4 py-2.5 text-[10px] font-bold text-neutral-700 border-b border-neutral-200 flex items-center gap-1.5">
                            <ImageIcon size={12} className="text-indigo-600" />
                            <span>Preview de Mídia Dinâmico Simulado</span>
                          </div>
                          <div className="relative">
                            <img 
                              src={activeDraft ? activeDraft.imageSrc : "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80"}
                              alt="Visual de Capa"
                              className="w-full h-52 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-3 left-3 bg-neutral-950/85 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Sparkles size={10} className="text-yellow-400" />
                              Renderização Criativa de Mídia Estética
                            </div>
                          </div>
                          {parsed.visualPrompt && (
                            <div className="p-4 border-t border-neutral-100 space-y-2.5 bg-neutral-50/30">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-purple-700 uppercase tracking-wider bg-purple-50 px-2 py-0.5 border border-purple-200/50 rounded-md font-mono">Prompt de Geração AI (Midjourney/Dall-E)</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(parsed.visualPrompt);
                                    alert("Prompt visual copiado!");
                                  }}
                                  className="p-1 px-2.5 bg-white border border-neutral-205 hover:bg-neutral-100 text-[9px] font-bold text-neutral-600 cursor-pointer rounded-lg shadow-2xs"
                                >
                                  Copiar Prompt
                                </button>
                              </div>
                              <div className="bg-neutral-900 text-neutral-300 font-mono text-[10px] p-4 rounded-xl border border-neutral-800 max-h-36 overflow-y-auto leading-relaxed">
                                {parsed.visualPrompt}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {creativeType === 'video' && (
                      <div className="border border-neutral-200/95 border-l-4 border-l-pink-600 bg-white p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-pink-50 text-pink-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-pink-100 font-mono">
                            🎬 Passo 3: ROTEIRO DE VÍDEO COMPACTO (REELS/STORIES)
                          </span>
                        </div>
                        <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-950 text-white font-sans">
                          <div className="bg-neutral-900 px-4 py-3 text-[10px] font-bold text-neutral-300 border-b border-neutral-850 flex items-center justify-between select-none">
                            <div className="flex items-center gap-1.5">
                              <Video size={12} className="text-pink-500" />
                              <span>Estúdio de Reels & Short Commercial</span>
                            </div>
                            <span className="text-[8px] bg-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-full uppercase font-black tracking-widest">0:30 seg</span>
                          </div>
                          <div className="p-7 flex flex-col items-center justify-center text-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-900 relative">
                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-rose-600/30 border border-rose-500/40 px-2 py-0.5 rounded-md text-[8px] font-bold text-rose-400 uppercase tracking-widest">
                              <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping"></span>
                              A/B TEST ACTIVE
                            </div>
                            
                            <div className="w-12 h-12 bg-pink-600 hover:bg-pink-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all mb-4">
                              <Video size={18} className="ml-0.5" />
                            </div>

                            <div className="space-y-1.5 z-10">
                              <h4 className="font-extrabold text-xs tracking-tight text-white">Preview Dinâmico de Edição de Roteiro</h4>
                              <p className="text-[10px] text-neutral-400 max-w-xs mx-auto italic">
                                "{parsed.headline}"
                              </p>
                            </div>
                          </div>
                          {parsed.videoScript && (
                            <div className="p-4 border-t border-neutral-900 space-y-2.5 bg-neutral-900/60">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider bg-rose-950/40 px-2 py-0.5 border border-rose-800/30 rounded-md font-mono">Falas Recomendadas & Diretrizes</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(parsed.videoScript);
                                    alert("Roteiro copiado!");
                                  }}
                                  className="p-1 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-[9px] font-bold text-neutral-300 cursor-pointer rounded-lg border border-neutral-750"
                                >
                                  Copiar Script
                                </button>
                              </div>
                              <div className="bg-neutral-950/80 p-4 border border-neutral-900 rounded-xl text-xs font-normal leading-relaxed text-neutral-300 max-h-56 overflow-y-auto whitespace-pre-line">
                                {parsed.videoScript}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. CHAMADA DE AÇÃO (CTA) */}
                    {parsed.cta && (
                      <div className="bg-white border border-neutral-200/90 border-l-4 border-l-amber-500 p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-200/60 font-mono">
                            ⚡ Passo 4: CHAMADA PARA AÇÃO FINAL (CTA)
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(parsed.cta);
                              alert("CTA copiado!");
                            }}
                            className="p-1.5 px-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-bold text-neutral-600 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <Copy size={11} /> Copiar CTA
                          </button>
                        </div>
                        <div className="flex items-center gap-3.5 bg-amber-50/50 p-4.5 border border-dashed border-amber-350 rounded-2xl text-[12px] font-black text-amber-950">
                          <MousePointerClick size={16} className="text-amber-600 animate-pulse shrink-0 animate-bounce" />
                          <span>{parsed.cta}</span>
                        </div>
                      </div>
                    )}

                    {/* 5. HASHTAG CHIPS */}
                    {parsed.hashtags.length > 0 && (
                      <div className="bg-white border border-neutral-200/90 border-l-4 border-l-purple-500 p-6 rounded-3xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-purple-200/60 font-mono">
                            🏷️ Passo 5: HASHTAGS DE DISTRIBUIÇÃO RECOMENDADAS
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {parsed.hashtags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-3 py-1.5 bg-purple-50/40 hover:bg-purple-100 text-purple-800 text-[11px] font-black rounded-xl border border-purple-200/60 hover:border-purple-400 cursor-pointer transition-all uppercase tracking-wide shadow-2xs"
                              onClick={() => {
                                navigator.clipboard.writeText(tag);
                                alert(`Hashtag "${tag}" copiada!`);
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. RAW FULL TEXT EXPANSION PANEL */}
                    <details className="group border border-neutral-200 rounded-2xl bg-neutral-50 overflow-hidden">
                      <summary className="flex items-center justify-between p-4 text-[11px] font-extrabold text-neutral-500 cursor-pointer select-none hover:bg-neutral-100 transition-all uppercase tracking-wider">
                        <span>Texto Bruto na Íntegra (Visualização de Depuração)</span>
                        <span className="transition-transform group-open:rotate-180 text-xs">▼</span>
                      </summary>
                      <div className="bg-white p-5 border-t border-neutral-200 prose prose-blue max-w-none text-neutral-700 text-xs leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin">
                        <div className="markdown-body">
                          <Markdown>{activeContent}</Markdown>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })()}

              {/* Quick Actions Integration buttons */}
              <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col gap-2">
                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest text-center mb-0.5">Sincronização Direta de Mídias</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => alert("Simulando exportação do rascunho de A/B Testing para o Meta Business Manager...")}
                    className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl font-bold text-xs hover:bg-[#166FE5] transition-colors cursor-pointer"
                  >
                    <Facebook size={14} />
                    Exportar Meta
                  </button>
                  <button 
                    onClick={() => alert("Simulando exportação do rascunho de A/B Testing para o TikTok Ads Center...")}
                    className="flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl font-bold text-xs hover:bg-neutral-900 transition-colors cursor-pointer"
                  >
                    <Music size={14} />
                    Exportar TikTok
                  </button>
                </div>
                <button 
                  onClick={() => alert("Injetando rascunhos com múltiplos links de Whatsapp na sua conta Google Ads...")}
                  className="flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <Search size={14} />
                  Sincronizar com Painel Google Ads
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-neutral-50 border border-dashed border-neutral-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center text-neutral-400 min-h-[400px]">
              <div className="w-16 h-16 bg-white border border-neutral-100 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <Sparkles size={28} className="text-blue-500 animate-pulse" />
              </div>
              <h4 className="font-bold text-neutral-800 text-sm mb-1">Aguardando Parâmetros</h4>
              <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                Refine as opções correspondentes aos Passos 1 a 8 no painel ao lado e clique em "Compor Campanha" para simular a criação.
              </p>
            </div>
          )}
        </AnimatePresence>

        {/* Marketing Guidelines Box */}
        <div className="bg-neutral-900 p-6 rounded-3xl text-white space-y-4">
          <h4 className="font-bold text-sm tracking-tight flex items-center gap-2 text-blue-400 uppercase">
            <Megaphone size={16} />
            Estratégia Odonto AI
          </h4>
          <div className="space-y-3 text-xs text-neutral-400 font-medium">
            <div className="flex gap-2.5">
              <span className="text-blue-500 font-bold">•</span>
              <p><b>Diferenciais Estéticos Claros</b> criam desejo visual imediato no feed dos canais Facebook e Instagram.</p>
            </div>
            <div className="flex gap-2.5">
              <span className="text-blue-500 font-bold">•</span>
              <p><b>Anúncios de Google</b> devem focar em intenção explícita de busca utilizando termos com palavras-chave geolocalizadas.</p>
            </div>
            <div className="flex gap-2.5">
              <span className="text-blue-500 font-bold">•</span>
              <p><b>No TikTok</b>, o segredo reside nos primeiros 3 segundos de fita com hooks baseados em curiosidade ou superação visual.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
