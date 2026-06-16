import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Mic, 
  Phone, 
  Video, 
  MoreVertical, 
  CheckCheck, 
  Play, 
  Pause, 
  Loader2, 
  Square, 
  QrCode, 
  RefreshCw, 
  ArrowLeft, 
  MessageSquare,
  Trash2,
  Tag,
  Check,
  Plus,
  User,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { Patient, Clinic } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'voice';
  timestamp: string;
  remoteJid?: string;
}

const PREDEFINED_CRM_TAGS = [
  { id: 'Limpeza', label: '🪥 Limpeza/Profilaxia', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'Implante', label: '🦷 Implante Dentário', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Aparelho', label: '🔍 Ortodontia / Aparelho', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'Canal', label: '⚡ Canal / Endodontia', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Clareamento', label: '✨ Clareamento Estético', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Prótese', label: '🦷 Prótese Dentária', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Urgência', label: '🚨 Urgência / Dor', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Avaliação', label: '📝 Avaliação Inicial', color: 'bg-neutral-50 text-neutral-700 border-neutral-200' }
];

const CRM_STAGES = [
  { id: 'lead', title: 'Leads Captados', color: 'bg-blue-500 text-blue-600 ring-blue-100', hoverCol: 'hover:bg-blue-50' },
  { id: 'contacted', title: 'Em Atendimento', color: 'bg-amber-500 text-amber-600 ring-amber-100', hoverCol: 'hover:bg-amber-50' },
  { id: 'scheduled', title: 'Consulta Marcada', color: 'bg-emerald-500 text-emerald-600 ring-emerald-100', hoverCol: 'hover:bg-emerald-50' },
  { id: 'lost', title: 'Perdidos', color: 'bg-neutral-400 text-neutral-500 ring-neutral-100', hoverCol: 'hover:bg-neutral-50' },
];

export default function WhatsAppSimulator() {
  const [chats, setChats] = useState<Record<string, { name: string; lastMessage: string; timestamp: string; messages: Message[] }>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('wa_active_chat_id');
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeChatId) {
        localStorage.setItem('wa_active_chat_id', activeChatId);
      } else {
        localStorage.removeItem('wa_active_chat_id');
      }
    } catch (e) {
      console.error("Erro ao persistir wa_active_chat_id:", e);
    }
  }, [activeChatId]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'qr'>('disconnected');
  const [connectedUser, setConnectedUser] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [showCRMDetails, setShowCRMDetails] = useState(() => window.innerWidth >= 1280);

  // CRM/Patients Integration State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Deleted numbers cache to persist hide/delete filter
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wa_deleted_chats');
      return (saved && saved !== 'undefined' && saved !== 'null') ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Erro ao ler wa_deleted_chats:", e);
      return [];
    }
  });

  // Track edits to Patient Name directly from whatsapp
  const [editingPatientName, setEditingPatientName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Sync auth and Firestore patients/clinics in real-time
  useEffect(() => {
    let unsubClinics: () => void;
    let unsubPatients: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (unsubClinics) unsubClinics();
      if (unsubPatients) unsubPatients();

      if (user) {
        // Load clinics owned by user
        const clinicsQuery = query(collection(db, 'clinics'), where('ownerId', '==', user.uid));
        unsubClinics = onSnapshot(clinicsQuery, (snapshot) => {
          setClinics(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
        });

        // Load all patients (linked to owner or public depending on rule)
        const q = query(collection(db, 'pacientes'));
        unsubPatients = onSnapshot(q, (ptSnapshot) => {
          setPatients(ptSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
        });
      } else {
        setClinics([]);
        setPatients([]);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubPatients) unsubPatients();
    };
  }, []);

  // Poll for connection status (Immediate fetch then smooth 20s interval)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/wa-status', {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.status) {
          setConnectionStatus(data.status);
          if (data.qr) setQrCode(data.qr);
          if (data.user) setConnectedUser(data.user);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 20000);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const rawData = event.data;
        if (!rawData) return;
        const trimmed = typeof rawData === 'string' ? rawData.trim() : '';
        if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
          return;
        }
        const data = JSON.parse(trimmed);
        console.log('WS Message:', data);

        if (data.type === 'status') {
          setConnectionStatus(data.status);
          if (data.qr) setQrCode(data.qr);
          if (data.user) setConnectedUser(data.user);
        } else if (data.type === 'history') {
          setChats(prev => {
            const newChats = { ...prev };
            
            (data.chats || []).forEach((c: any) => {
              const jid = c.id;
              if (!jid || jid.includes('@g.us') || jid.includes('status')) return;
              
              const phone = jid.split('@')[0];
              if (!newChats[jid]) {
                newChats[jid] = {
                  name: c.name || `+${phone}`,
                  messages: [],
                  lastMessage: c.conversationTimestamp ? '' : '...',
                  timestamp: c.conversationTimestamp ? new Date(c.conversationTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                };
              }
            });

            (data.messages || []).forEach((m: any) => {
              const jid = m.key.remoteJid;
              if (!jid || !newChats[jid]) return;
              
              const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
              if (text) {
                const msgId = m.key.id;
                if (!newChats[jid].messages.some(msg => msg.id === msgId)) {
                  newChats[jid].messages.push({
                    id: msgId,
                    role: m.key.fromMe ? 'assistant' : 'user',
                    content: text,
                    type: 'text',
                    timestamp: new Date((m.messageTimestamp as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    remoteJid: jid
                  });
                  newChats[jid].lastMessage = text;
                }
              }
            });

            return newChats;
          });
        } else if (data.type === 'message') {
          const remoteJid = data.remoteJid || 'status@broadcast';
          const phone = remoteJid.split('@')[0];
          
          const newMsg: Message = {
            id: Date.now().toString(),
            role: data.role,
            content: data.content,
            type: 'text',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            remoteJid: remoteJid
          };

          setChats(prev => {
            const currentChat = prev[remoteJid] || { 
              name: phone === 'simulator' ? 'Simulador Front Odonto AI' : `+${phone}`, 
              messages: [], 
              lastMessage: '', 
              timestamp: '' 
            };
            
            return {
              ...prev,
              [remoteJid]: {
                ...currentChat,
                lastMessage: data.content,
                timestamp: newMsg.timestamp,
                messages: [...currentChat.messages, newMsg]
              }
            };
          });

          if (data.role === 'assistant') setIsTyping(false);
        }
      } catch (err) {
        console.warn("Falha ao analisar a mensagem WS:", err);
      }
    };

    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats, activeChatId, isTyping]);

  // Find CRM patient by matching phone number
  const findPatientForChat = (chatId: string | null) => {
    if (!chatId) return null;
    const phone = chatId.split('@')[0];
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    if (!cleanPhoneDigits) return null;

    return patients.find(p => {
      const pPhone = p.phone || p.telefone || '';
      const cleanPPhone = pPhone.replace(/\D/g, '');
      return cleanPPhone.endsWith(cleanPhoneDigits) || cleanPhoneDigits.endsWith(cleanPPhone);
    });
  };

  const matchedPatient = findPatientForChat(activeChatId);

  // Sync editing patient name on transition
  useEffect(() => {
    if (matchedPatient) {
      setEditingPatientName(matchedPatient.name || matchedPatient.nome || '');
    } else if (activeChatId) {
      const activeChat = chats[activeChatId];
      setEditingPatientName(activeChat?.name || '');
    } else {
      setEditingPatientName('');
    }
  }, [activeChatId, matchedPatient, chats]);

  // Handle saving the patient's name to Firestore
  const handleSavePatientName = async () => {
    if (!activeChatId || !editingPatientName.trim()) return;
    setIsSavingName(true);
    try {
      if (matchedPatient) {
        // Update both CRM name and normal patient name
        await updateDoc(doc(db, 'pacientes', matchedPatient.id), {
          nome: editingPatientName,
          name: editingPatientName,
        });
      } else {
        // If not registered in CRM yet, create lead automatically
        const phone = activeChatId.split('@')[0];
        const clinicId = clinics[0]?.id || '';
        await addDoc(collection(db, 'pacientes'), {
          name: editingPatientName,
          nome: editingPatientName,
          phone: phone,
          telefone: phone,
          status: 'lead',
          clinicId: clinicId,
          ownerId: currentUser?.uid || '',
          source: 'whatsapp_real',
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Erro ao salvar nome de paciente:", err);
    } finally {
      setIsSavingName(false);
    }
  };

  // Update CRM stage directly (links tag update to CRM stage progression)
  const handleUpdateCRMStage = async (stage: 'lead' | 'contacted' | 'scheduled' | 'lost') => {
    if (!activeChatId) return;
    const phone = activeChatId.split('@')[0];
    const activeChat = chats[activeChatId];

    try {
      if (matchedPatient) {
        await updateDoc(doc(db, 'pacientes', matchedPatient.id), {
          status: stage,
          lastContactAt: serverTimestamp()
        });
      } else {
        // Create lead automatically on stage click if not registered yet
        const clinicId = clinics[0]?.id || '';
        const nameToUse = editingPatientName.trim() || activeChat?.name || `+${phone}`;
        await addDoc(collection(db, 'pacientes'), {
          name: nameToUse,
          nome: nameToUse,
          phone: phone,
          telefone: phone,
          status: stage,
          clinicId: clinicId,
          ownerId: currentUser?.uid || '',
          source: 'whatsapp_real',
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar etapa de CRM:", e);
    }
  };

  // Toggle specific therapeutic interest tags
  const handleToggleInterestTag = async (tagLabel: string) => {
    if (!activeChatId) return;
    try {
      if (matchedPatient) {
        // Toggle tag from current text list
        const currentInterest = matchedPatient.interestedIn || '';
        let updatedInterest = '';
        if (currentInterest.includes(tagLabel)) {
          // Remove tag
          updatedInterest = currentInterest
            .split(',')
            .map(t => t.trim())
            .filter(t => t && t !== tagLabel)
            .join(', ');
        } else {
          // Add tag
          updatedInterest = currentInterest 
            ? `${currentInterest}, ${tagLabel}` 
            : tagLabel;
        }

        await updateDoc(doc(db, 'pacientes', matchedPatient.id), {
          interestedIn: updatedInterest,
          lastContactAt: serverTimestamp()
        });
      } else {
        // Auto create lead and add interest tag
        const phone = activeChatId.split('@')[0];
        const activeChat = chats[activeChatId];
        const clinicId = clinics[0]?.id || '';
        const nameToUse = editingPatientName.trim() || activeChat?.name || `+${phone}`;

        await addDoc(collection(db, 'pacientes'), {
          name: nameToUse,
          nome: nameToUse,
          phone: phone,
          telefone: phone,
          status: 'lead',
          interestedIn: tagLabel,
          clinicId: clinicId,
          ownerId: currentUser?.uid || '',
          source: 'whatsapp_real',
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar tags adicionais:", e);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !activeChatId) return;
    if (connectionStatus !== 'connected') return;
    
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'send_message',
        remoteJid: activeChatId,
        text: input
      }));
    }
    
    setInput('');
  };

  const handleConnect = async () => {
    setConnectionStatus('connecting');
    setQrCode(null);
    try {
      await fetch('/api/wa-connect', { method: 'POST' });
    } catch (e) {
      console.error('Failed to initiate connection:', e);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm("Deseja realmente terminar a sessão e desconectar esta conta do WhatsApp?")) {
      setConnectionStatus('connecting');
      setQrCode(null);
      setConnectedUser(null);
      try {
        await fetch('/api/wa-disconnect', { method: 'POST' });
      } catch (e) {
        console.error('Failed to disconnect:', e);
      }
    }
  };

  const handleReset = async () => {
    setConnectionStatus('connecting');
    setQrCode(null);
    try {
      await fetch('/api/wa-reset', { method: 'POST' });
    } catch (e) {
      console.error('Failed to reset connection:', e);
    }
  };

  // Permanently delete/hide whatsapp chat session from sidebar
  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Deseja mesmo remover este número e ocultá-lo dos atendimentos?")) {
      const updated = [...deletedChatIds, id];
      setDeletedChatIds(updated);
      localStorage.setItem('wa_deleted_chats', JSON.stringify(updated));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    }
  };

  const activeChat = activeChatId ? chats[activeChatId] : null;

  // Filter out deleted chats and apply search query
  const filteredChats = Object.entries(chats)
    .filter(([id]) => !deletedChatIds.includes(id))
    .filter(([_, chat]) => 
      (chat.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
    )
    .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp));

  return (
    <div className="flex flex-col md:flex-row h-full max-h-[calc(100vh-8rem)] min-h-[450px] md:min-h-[600px] bg-neutral-50 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-200">
      
      {/* WhatsApp Left Sidebar */}
      <div className={`${activeChatId ? 'hidden md:flex' : 'flex w-full md:flex'} border-r border-neutral-200 flex-col bg-[#f0f2f5] md:w-[320px] md:min-w-[320px] md:max-w-[320px] shrink-0`}>
        
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between bg-[#f0f2f5] shrink-0 border-b border-neutral-300/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#128C7E] overflow-hidden flex items-center justify-center border border-white shadow-sm shrink-0">
              <span className="text-white font-bold text-sm">
                {connectedUser ? (connectedUser.name?.[0]?.toUpperCase() || 'O') : 'A'}
              </span>
            </div>
            {connectedUser && (
              <div className="min-w-0">
                <span className="text-xs font-black text-neutral-800 uppercase tracking-tighter truncate block">
                  {connectedUser.name || 'Conectado'}
                </span>
                <span className="text-[8px] font-bold text-green-600 uppercase tracking-widest block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                  Ativo no Watts
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2 text-neutral-600 items-center">
            <a 
              href={`${window.location.origin}?tab=whatsapp`} 
              target="_blank" 
              rel="noopener noreferrer" 
              title="Abrir Painel de Atendimento em Nova Aba (Desktop)" 
              className="flex items-center gap-1.5 bg-[#128C7E]/10 hover:bg-[#128C7E] hover:text-white text-neutral-700 text-[10px] font-extrabold uppercase tracking-widest py-1.5 px-3 rounded-xl transition-all border border-neutral-300/40 shadow-xs"
              id="btn-desktop-panel"
            >
              <ExternalLink size={12} className="stroke-[2.5]" />
              <span>Painel</span>
            </a>
            {connectionStatus === 'connected' && (
              <button 
                onClick={handleDisconnect} 
                title="Terminar Sessão e Desconectar" 
                className="flex items-center gap-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-650 text-[10px] font-extrabold uppercase tracking-widest py-1.5 px-2.5 rounded-xl transition-all border border-red-200 shadow-xs cursor-pointer"
                id="btn-logout"
              >
                Sair
              </button>
            )}
            <button className="hover:text-[#128C7E] p-1 rounded-lg hover:bg-white/50">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Connection Area (Bigger QR Code & Loading) */}
        {connectionStatus !== 'connected' && (
          <div className="p-5 bg-white border-b border-neutral-200 shadow-inner">
            {connectionStatus === 'qr' && qrCode ? (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center space-y-1">
                  <h3 className="text-xs font-black text-neutral-800 uppercase tracking-widest text-[#128C7E]">Conectar WhatsApp</h3>
                  <p className="text-[10px] text-neutral-400 max-w-[200px] leading-relaxed mx-auto">Sincronize com seu smartphone abrindo o WhatsApp &gt; Aparelhos Conectados &gt; Escanear QR Code</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-emerald-50 flex items-center justify-center transition-all hover:shadow-xl">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56 sm:w-64 sm:h-64 object-contain" />
                </div>
                <button 
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 py-2 px-4 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-xl text-[10px] font-black text-neutral-600 transition-all uppercase tracking-widest"
                >
                  <RefreshCw size={12} />
                  Atualizar Código QR
                </button>
              </div>
            ) : connectionStatus === 'connecting' ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-10 h-10 text-[#128C7E] animate-spin mb-3" />
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest animate-pulse">
                  Conectando ao Whatsapp...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center gap-3 bg-neutral-50/50 p-4 rounded-2xl border border-dashed border-neutral-300/65">
                <div className="text-neutral-400 p-2.5 bg-neutral-100 rounded-full">
                  <QrCode size={30} className="stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[11px] font-black text-neutral-700 uppercase tracking-widest">WhatsApp Desconectado</h3>
                  <p className="text-[10px] text-neutral-400 max-w-[230px] leading-relaxed mx-auto">
                    Inicie a sincronização de leitura para ativar os atendimentos do agente e capturar leads automaticamente.
                  </p>
                </div>
                <button 
                  onClick={handleConnect}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#128C7E] hover:bg-[#075e54] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={11} className="stroke-[2.5]" />
                  Iniciar Atendimento WhatsApp
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search contacts bar */}
        <div className="p-3 bg-white border-b border-neutral-200/50">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Pesquisar número em atendimento..."
              className="w-full bg-[#f0f2f5] py-2.5 pl-10 pr-4 rounded-xl text-xs outline-none placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-green-500/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute left-3.5 top-3 text-neutral-400">
              <QrCode size={14} />
            </div>
          </div>
        </div>

        {/* Chat Threads List */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {filteredChats.length === 0 ? (
            <div className="p-10 text-center text-neutral-400 space-y-2">
              <MessageSquare className="mx-auto text-neutral-300" size={36} />
              <p className="text-xs font-semibold">Nenhuma conversa ativa</p>
              <p className="text-[10px] text-neutral-400">Os números que entrarem em contato aparecerão aqui em tempo real.</p>
            </div>
          ) : (
            filteredChats.map(([id, chat]) => {
              const matchedPt = findPatientForChat(id);
              const displayName = matchedPt ? (matchedPt.name || matchedPt.nome) : chat.name;
              const hasCRMStage = matchedPt ? CRM_STAGES.find(s => s.id === matchedPt.status) : null;

              return (
                <div 
                  key={id}
                  onClick={() => setActiveChatId(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer border-b border-neutral-100 relative group transition-all ${activeChatId === id ? 'bg-[#ebebeb] border-l-4 border-[#128C7E]' : 'hover:bg-neutral-50'}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-neutral-200 shrink-0 flex items-center justify-center overflow-hidden border border-neutral-300/40 shadow-sm relative">
                    <span className="font-extrabold text-[#128C7E] text-sm">
                      {displayName?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>

                  {/* Body details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h5 className="font-bold text-sm text-neutral-800 truncate pr-4">
                        {displayName}
                      </h5>
                      <span className="text-[10px] font-medium text-neutral-400 shrink-0">
                        {chat.timestamp}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500 truncate leading-tight flex-1">
                        {chat.lastMessage}
                      </p>
                      
                      {/* Interactive CRM Status Mini Badge */}
                      {hasCRMStage && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tracking-tight text-white ${hasCRMStage.color}`}>
                          {hasCRMStage.title.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Overlay (Delete / Archive option) */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center bg-transparent group-hover:block hidden transition-all z-10">
                    <button
                      onClick={(e) => handleDeleteChat(e, id)}
                      className="p-2 bg-white/90 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg border border-neutral-200 hover:border-red-200 shadow-md transition-all scale-95 hover:scale-105 active:scale-95 duration-100"
                      title="Apagar e ocultar número"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Frame */}
      <div className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex-row bg-[#efeae2] relative overflow-hidden`}>
        {activeChatId ? (
          <>
            <div className="flex-1 flex flex-col h-full bg-[#f3f0ea] relative border-r border-neutral-200">
              {/* WhatsApp styled header */}
              <div className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-neutral-300/40 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveChatId(null)} 
                    className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-500 block md:hidden mr-1"
                    title="Voltar para conversas"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center overflow-hidden shrink-0 border border-white">
                    <span className="font-extrabold text-[#128C7E] text-sm">
                      {(matchedPatient ? (matchedPatient.name || matchedPatient.nome) : activeChat?.name)?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-800 line-clamp-1">
                      {matchedPatient ? (matchedPatient.name || matchedPatient.nome) : activeChat?.name}
                    </h4>
                    <p className="text-[9px] text-[#128C7E] uppercase font-bold tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full block animate-pulse" />
                      atendimento ativo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-neutral-500">
                  <button 
                    onClick={() => setShowCRMDetails(!showCRMDetails)}
                    className={`p-2 rounded-xl border flex items-center gap-1.5 transition-all text-[11px] font-extrabold uppercase tracking-wide px-3 ${showCRMDetails ? 'bg-[#128C7E] border-[#128C7E] text-white shadow-md' : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-600'}`}
                    title="Painel Integrado do CRM"
                  >
                    <Tag size={13} />
                    <span>Funil/CRM</span>
                  </button>
                  <button className="p-1.5 hover:bg-white/60 rounded-lg hover:text-neutral-800"><Video size={16} /></button>
                  <button className="p-1.5 hover:bg-white/60 rounded-lg hover:text-neutral-800"><Phone size={16} /></button>
                </div>
              </div>

              {/* Improved Messages Space with custom doodle-styled cards and auto scroll */}
              <div ref={scrollRef} className="flex-1 p-5 space-y-3 overflow-y-auto bg-[#efeae2] bg-opacity-70 custom-scrollbar relative">
                {/* Visual info banner */}
                <div className="flex justify-center my-2">
                  <span className="bg-white/80 shadow-xs border border-neutral-200/50 text-[10px] text-neutral-500 font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Info size={11} />
                    As mensagens abaixo estão integradas com a Inteligência Artificial
                  </span>
                </div>

                {activeChat?.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.98, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-[80%] px-3.5 py-2.5 rounded-2xl shadow-xs relative text-[13px] min-w-[90px] leading-relaxed
                      ${msg.role === 'user' 
                        ? 'bg-[#d9fdd3] text-neutral-900 rounded-tr-none border border-green-200/40 shadow-sm' 
                        : 'bg-white text-neutral-900 rounded-tl-none border border-neutral-200/40 shadow-sm'}
                    `}>
                      <p className="pr-12 text-neutral-800 whitespace-pre-wrap">{msg.content}</p>
                      <div className="absolute bottom-1 right-2 text-[8px] text-neutral-400 flex items-center gap-0.5 font-bold select-none">
                        {msg.timestamp}
                        {msg.role === 'assistant' && (
                          <div className="flex items-center text-blue-500">
                            <CheckCheck size={11} />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs text-neutral-500 italic shadow-sm flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span>Dentista IA digitando...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Send Input Box */}
              <div className="bg-[#f0f2f5] px-4 py-3 border-t border-neutral-300/40 flex items-center gap-3 shrink-0">
                <div className="flex-1 bg-white rounded-xl px-4 py-3 border border-neutral-200 flex items-center shadow-xs">
                  <input 
                    className="w-full bg-transparent outline-none text-xs sm:text-sm placeholder:text-neutral-400 text-neutral-800"
                    placeholder="Digite uma resposta manual para assumir o chat..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                </div>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-11 h-11 bg-[#128C7E] hover:bg-[#075e54] rounded-full flex items-center justify-center text-white shadow-md disabled:opacity-40 transition-all active:scale-95 shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* INTEGRATED CRM & STAGES TAGGING SYSTEM PANEL */}
            <AnimatePresence>
              {showCRMDetails && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '310px', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="absolute right-0 top-0 z-20 h-full w-[310px] bg-white border-l border-neutral-200 shadow-2xl flex flex-col xl:relative xl:z-0 xl:shadow-none overflow-y-auto"
                >
                  {/* Panel Header */}
                  <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-[#128C7E]" />
                      <h4 className="font-extrabold text-[#128C7E] text-xs uppercase tracking-wider">Integração CRM & Funil</h4>
                    </div>
                    <button 
                      onClick={() => setShowCRMDetails(false)}
                      className="text-neutral-300 hover:text-neutral-500 text-xs font-bold hover:bg-neutral-100 p-1 rounded-md"
                    >
                      Ocultar
                    </button>
                  </div>

                  {/* Panel Body */}
                  <div className="p-4 space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-5">
                      
                      {/* Name of Lead and Status indicator */}
                      <div className="bg-neutral-50 border border-neutral-200/50 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center font-extrabold text-[#128C7E] text-xs shadow-inner">
                            <User size={13} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Identificação do Lead</span>
                            <span className="text-xs font-bold text-neutral-500 block truncate">
                              + {activeChatId?.split('@')[0]}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider">Nome no CRM</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              className="flex-1 px-3 py-1.5 bg-white border border-neutral-200 outline-none rounded-xl text-xs font-semibold focus:ring-1 focus:ring-[#128C7E]"
                              placeholder="Editar ou dar nome ao Lead..."
                              value={editingPatientName}
                              onChange={(e) => setEditingPatientName(e.target.value)}
                            />
                            <button
                              onClick={handleSavePatientName}
                              disabled={isSavingName}
                              className="px-3 bg-[#128C7E] hover:bg-[#075e54] text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {isSavingName ? '...' : 'Ok'}
                            </button>
                          </div>
                        </div>

                        {matchedPatient ? (
                          <div className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-100 p-2 rounded-xl flex items-center gap-1.5 mt-2">
                            <Check size={12} className="text-emerald-600 shrink-0" />
                            <span>Contatos sincronizados no CRM</span>
                          </div>
                        ) : (
                          <div className="bg-amber-50 text-amber-800 text-[9px] font-medium border border-amber-100 p-2 rounded-xl mt-2 flex flex-col gap-1.5 leading-relaxed">
                            <span className="font-bold">⚠️ Lead não cadastrado no CRM</span>
                            <span>Selecione uma das etapas do funil abaixo para criar e vincular este contato ao CRM instantaneamente.</span>
                          </div>
                        )}
                      </div>

                      {/* STAGEMENT / CRM FUNNEL PROGRESSION */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                            <span>Etapa do Funil de Clínicas</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {CRM_STAGES.map((stg) => {
                            const isCurrentStatus = matchedPatient?.status === stg.id;
                            
                            return (
                              <button
                                key={stg.id}
                                onClick={() => handleUpdateCRMStage(stg.id as any)}
                                className={`
                                  w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all relative overflow-hidden group
                                  ${isCurrentStatus 
                                    ? 'bg-[#128C7E]/5 border-[#128C7E] shadow-sm text-neutral-800' 
                                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-600'}
                                `}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-2.5 h-2.5 rounded-full ${stg.color} relative`}>
                                    {isCurrentStatus && (
                                      <span className="absolute inset-0 bg-current rounded-full animate-ping opacity-75" />
                                    )}
                                  </div>
                                  <span className="text-xs font-extrabold tracking-tight uppercase">
                                    {stg.title}
                                  </span>
                                </div>

                                {isCurrentStatus ? (
                                  <span className="text-[10px] font-black text-[#128C7E] uppercase bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 pr-1 border border-emerald-100">
                                    <Check size={10} />
                                    No Funil
                                  </span>
                                ) : (
                                  <ChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* DENTAL SPECIFIC TARGETING TAGS */}
                      <div className="space-y-2.5 pt-1 border-t border-neutral-100">
                        <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                          Tags de Interesse Clínico
                        </span>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {PREDEFINED_CRM_TAGS.map((tag) => {
                            const currentInterestList = matchedPatient?.interestedIn || '';
                            const isTagged = currentInterestList.split(',').map(t => t.trim()).includes(tag.id);
                            
                            return (
                              <button
                                key={tag.id}
                                onClick={() => handleToggleInterestTag(tag.id)}
                                className={`
                                  text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1
                                  ${isTagged 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}
                                `}
                              >
                                {tag.label}
                                {isTagged && <Check size={10} className="stroke-[3]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Footer informational */}
                    <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-[9px] text-neutral-400 font-medium leading-relaxed">
                      Sempre que atualizar a etapa ou selecionar tags de atendimento, o lead transita de forma automática no CRM da sua clinica!
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Empty Active Chat Welcome view */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f8f9fa] border-b-4 border-[#128C7E] p-4">
            <div className="w-full max-w-sm text-center space-y-4 flex flex-col items-center">
              <div className="bg-neutral-200 p-6 rounded-full text-neutral-400">
                <MessageSquare size={70} />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-neutral-700">
                  {connectionStatus === 'connected' ? 'Atendimento Digital IA Ativo' : 'Gerenciamento WhatsApp Business'}
                </h2>
                <p className="text-xs text-neutral-500 leading-relaxed max-w-[280px]">
                  {connectionStatus === 'connected' 
                    ? 'Clique em qualquer conversa sincronizada à esquerda para iniciar o atendimento integrado ou automatizar respostas.' 
                    : 'Aponte seu celular e escaneie o código QR na lateral para ativar a sincronização e automação com Inteligência Artificial.'}
                </p>
                <div className="flex items-center justify-center gap-2 text-neutral-400 text-[10px] pt-1">
                  <CheckCheck size={12} className="text-green-500" />
                  <span>Conexão de dados blindada</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

