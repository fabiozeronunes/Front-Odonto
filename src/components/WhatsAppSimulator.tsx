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
  Info,
  GripVertical
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  setDoc,
  getDocs,
  serverTimestamp, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
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

const STAGE_COLOR_PRESETS = [
  { value: 'bg-blue-500 text-blue-600 ring-blue-100', bg: 'bg-blue-500', name: 'Azul' },
  { value: 'bg-amber-500 text-amber-600 ring-amber-100', bg: 'bg-amber-500', name: 'Laranja' },
  { value: 'bg-emerald-500 text-emerald-600 ring-emerald-100', bg: 'bg-emerald-500', name: 'Verde' },
  { value: 'bg-red-500 text-red-600 ring-red-100', bg: 'bg-red-500', name: 'Vermelho' },
  { value: 'bg-purple-500 text-purple-600 ring-purple-100', bg: 'bg-purple-500', name: 'Roxo' },
  { value: 'bg-rose-500 text-rose-600 ring-rose-100', bg: 'bg-rose-500', name: 'Rosa' },
  { value: 'bg-indigo-500 text-indigo-600 ring-indigo-100', bg: 'bg-indigo-500', name: 'Anil' },
  { value: 'bg-neutral-500 text-neutral-600 ring-neutral-100', bg: 'bg-neutral-500', name: 'Cinza' },
];

export default function WhatsAppSimulator() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Pre-read jump data to avoid race conditions in state initializers
  const initialJumpFromCRM = (() => {
    try {
      const jumpTo = localStorage.getItem('wa_whatsapp_jump_to_chat');
      if (!jumpTo || jumpTo === 'undefined') return null;
      return JSON.parse(jumpTo);
    } catch (e) {
      return null;
    }
  })();

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (initialJumpFromCRM?.phone) {
      return initialJumpFromCRM.phone;
    }
    return localStorage.getItem('wa_active_chat_id');
  });

  const [chats, setChats] = useState<Record<string, { name: string; lastMessage: string; timestamp: string; messages: Message[]; source?: string }>>(() => {
    let baseChats: any = {};
    try {
      const saved = localStorage.getItem('wa_simulator_chats');
      if (saved && saved !== 'undefined') {
        baseChats = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Erro ao ler wa_simulator_chats:", e);
    }

    if (initialJumpFromCRM?.phone) {
      const { phone, name, source } = initialJumpFromCRM;
      if (!baseChats[phone]) {
        baseChats[phone] = {
          name: name || phone.split('@')[0],
          lastMessage: 'Atendimento iniciado pelo CRM',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: [],
          source: source || 'CRM'
        };
      } else if (name) {
        baseChats[phone].name = name;
      }
    }
    
    return baseChats;
  });

  // Load synced chats from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const chatsQuery = query(collection(db, 'whatsapp_chats'), where('ownerId', '==', currentUser.uid));
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      const syncedChats: any = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        syncedChats[data.chatJid] = {
          name: data.name,
          lastMessage: data.lastMessage,
          timestamp: data.timestamp,
          messages: [] // Messages will be loaded per chat
        };
      });
      
      setChats(prev => {
        const merged = { ...prev };
        Object.keys(syncedChats).forEach(id => {
          if (!merged[id]) {
            merged[id] = syncedChats[id];
          } else {
            merged[id] = { 
              ...merged[id], 
              name: syncedChats[id].name,
              lastMessage: syncedChats[id].lastMessage,
              timestamp: syncedChats[id].timestamp
            };
          }
        });
        return merged;
      });
    });

    return () => unsubChats();
  }, [currentUser]);

  // Load messages for the active chat from Firestore
  useEffect(() => {
    if (!currentUser || !activeChatId) return;

    const msgsQuery = query(
      collection(db, 'whatsapp_messages'), 
      where('ownerId', '==', currentUser.uid),
      where('chatJid', '==', activeChatId)
    );
    
    const unsubMsgs = onSnapshot(msgsQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any)).sort((a, b) => new Date(a.serverTimestamp || 0).getTime() - new Date(b.serverTimestamp || 0).getTime());

      setChats(prev => {
        if (!prev[activeChatId]) return prev;
        return {
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            messages: msgs
          }
        };
      });
    });

    return () => unsubMsgs();
  }, [currentUser, activeChatId]);

  useEffect(() => {
    try {
      if (Object.keys(chats).length > 0) {
        localStorage.setItem('wa_simulator_chats', JSON.stringify(chats));
      }
    } catch (e) {
      console.error("Erro ao salvar wa_simulator_chats:", e);
    }
  }, [chats]);

  const [jumpToData, setJumpToData] = useState<{ phone: string; name: string; source?: string } | null>(initialJumpFromCRM);

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

  useEffect(() => {
    if (!currentUser) return;

    // Sincronização em tempo real para pacientes (Contatos/Leads)
    const patientsQuery = query(collection(db, 'pacientes'), where('ownerId', '==', currentUser.uid));
    const unsubPatients = onSnapshot(patientsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(docs);
      
      // Sincronizar com localStorage para fallback offline
      localStorage.setItem('wa_simulator_patients', JSON.stringify(docs));
      console.log("Pacientes sincronizados:", docs.length);
    }, (error) => {
      console.error("Erro na sincronização de pacientes:", error);
    });

    return () => unsubPatients();
  }, [currentUser]);

  useEffect(() => {
    if (jumpToData) {
      const { phone, name, source } = jumpToData;
      
      // 1. Unhide the chat if it was previously deleted/hidden
      if (currentUser) {
        const deletedDocId = `${currentUser.uid}_${phone.replace(/[^a-zA-Z0-9]/g, '_')}`;
        deleteDoc(doc(db, 'deleted_chats', deletedDocId)).catch(err => {
          console.error("Erro ao desarquivar chat:", err);
        });
      }

      // 2. Ensure chat exists in the list
      setChats(prev => {
        const existing: any = prev[phone] || { 
          name: name || phone.split('@')[0],
          lastMessage: 'Início do atendimento pelo CRM', 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
          messages: [],
          source: source || 'CRM'
        };
        
        return { 
          ...prev, 
          [phone]: { 
            ...existing,
            name: name || existing.name,
            source: source || existing.source || 'CRM'
          } 
        };
      });
      
      // 3. Force set active chat and show CRM panel
      setActiveChatId(phone);
      setShowCRMDetails(true);
      
      // 4. Clear the jump data
      setJumpToData(null);
      localStorage.removeItem('wa_whatsapp_jump_to_chat');
      console.log("Salto do CRM processado com sucesso para:", phone);
    }
  }, [jumpToData, currentUser]);

  // Auto-scroll the active chat in the sidebar into view
  useEffect(() => {
    if (activeChatId) {
      const activeEl = document.getElementById(`sidebar-chat-${activeChatId}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeChatId]);

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

  // Deleted numbers cache to persist hide/delete filter from Firestore
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>([]);
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    
    // Global sync for deleted/hidden chats
    const deletedQuery = query(collection(db, 'deleted_chats'), where('ownerId', '==', currentUser.uid));
    const unsubDeleted = onSnapshot(deletedQuery, (snapshot) => {
      const ids = snapshot.docs.map(d => d.data().chatJid);
      setDeletedChatIds(ids);
      localStorage.setItem('wa_deleted_chats', JSON.stringify(ids));
      setSyncVersion(v => v + 1); // Trigger refresh
    });

    return () => unsubDeleted();
  }, [currentUser]);

  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Track edits to Patient Name directly from whatsapp
  const [editingPatientName, setEditingPatientName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Specialties and Procedures loaded from Firestore
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);

  // Filters for Chat Threads
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Tag Modal / CRUD states
  const [editingTag, setEditingTag] = useState<{ id: string; label: string; type: 'specialty' | 'procedure' } | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagModalMode, setTagModalMode] = useState<'add' | 'edit'>('add');
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagType, setNewTagType] = useState<'specialty' | 'procedure'>('specialty');

  // Funnel Stage Modal / CRUD states with localStorage support
  const [crmStages, setCrmStages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('wa_crm_funnel_stages');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : CRM_STAGES;
    } catch (e) {
      return CRM_STAGES;
    }
  });
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageModalMode, setStageModalMode] = useState<'add' | 'edit'>('add');
  const [editingStage, setEditingStage] = useState<any | null>(null);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageColor, setNewStageColor] = useState('bg-blue-500 text-blue-600 ring-blue-100');
  const [isOverStageBtn, setIsOverStageBtn] = useState(false);

  // Sync auth and Firestore patients/clinics in real-time
  useEffect(() => {
    let unsubClinics: () => void;
    let unsubPatients: () => void;
    let unsubSpecialties: () => void;
    let unsubProcedures: () => void;
    let unsubFunnelStages: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (unsubClinics) unsubClinics();
      if (unsubPatients) unsubPatients();
      if (unsubSpecialties) unsubSpecialties();
      if (unsubProcedures) unsubProcedures();
      if (unsubFunnelStages) unsubFunnelStages();

      if (user) {
        // Load clinics owned by user
        const clinicsQuery = query(collection(db, 'clinics'), where('ownerId', '==', user.uid));
        unsubClinics = onSnapshot(clinicsQuery, (snapshot) => {
          setClinics(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
        });

        // Load all patients linked to owner
        const q = query(collection(db, 'pacientes'), where('ownerId', '==', user.uid));
        unsubPatients = onSnapshot(q, (ptSnapshot) => {
          setPatients(ptSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
        }, (err) => {
          console.error("Erro na lista de pac do WA simulator:", err);
        });

        // Load specialties
        const specialtiesQuery = query(collection(db, 'specialties'), where('ownerId', '==', user.uid));
        unsubSpecialties = onSnapshot(specialtiesQuery, (snapshot) => {
          setSpecialties(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Load procedures
        const proceduresQuery = query(collection(db, 'procedures'), where('ownerId', '==', user.uid));
        unsubProcedures = onSnapshot(proceduresQuery, (snapshot) => {
          setProcedures(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Load funnel stages with auto-seeding
        const funnelStagesQuery = query(collection(db, 'funnel_stages'), where('ownerId', '==', user.uid));
        unsubFunnelStages = onSnapshot(funnelStagesQuery, async (snapshot) => {
          const loadedStages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          console.log("onSnapshot funnel stages:", loadedStages);
          if (loadedStages.length === 0) {
            await seedDefaultStages(user.uid);
          } else {
            loadedStages.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            setCrmStages(loadedStages);
            try {
              localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(loadedStages));
            } catch (e) {
              console.error("Erro ao salvar stages no localStorage:", e);
            }
          }
        });
      } else {
        setClinics([]);
        setPatients([]);
        setSpecialties([]);
        setProcedures([]);
        try {
          const saved = localStorage.getItem('wa_crm_funnel_stages');
          if (saved && saved !== 'undefined') {
            setCrmStages(JSON.parse(saved));
          } else {
            setCrmStages(CRM_STAGES);
          }
        } catch (e) {
          setCrmStages(CRM_STAGES);
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubPatients) unsubPatients();
      if (unsubSpecialties) unsubSpecialties();
      if (unsubProcedures) unsubProcedures();
      if (unsubFunnelStages) unsubFunnelStages();
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
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    console.log("Iniciando conexão WebSocket em:", wsUrl);
    
    const socket = new WebSocket(wsUrl);
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
          console.log("Status de conexão atualizado:", data.status);
          setConnectionStatus(data.status);
          if (data.qr) {
            console.log("QR Code recebido via WS");
            setQrCode(data.qr);
          }
          if (data.user) setConnectedUser(data.user);
        } else if (data.type === 'history') {
          setChats(prev => {
            const newChats = { ...prev };
            
            (data.chats || []).forEach((c: any) => {
              const jid = c.id;
              if (!jid || jid.includes('@g.us') || jid.includes('status')) return;
              
              const phone = jid.split('@')[0];
              if (!newChats[jid]) {
                const chatData = {
                  name: c.name || `+${phone}`,
                  messages: [],
                  lastMessage: c.conversationTimestamp ? '' : '...',
                  timestamp: c.conversationTimestamp ? new Date(c.conversationTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                };
                newChats[jid] = chatData;

                // Sync chat to Firestore - Only if not fromMe if it's a new contact?
                // Actually Baileys sends history. We should check if it has interactions.
                if (currentUser) {
                  const cleanedJid = jid.replace(/[^a-zA-Z0-9]/g, '_');
                  // Valor default para interacted. Se conversationTimestamp existe, provavelmente houve troca.
                  const interacted = c.conversationTimestamp ? true : false;
                  
                  // O usuário solicitou que apenas contatos INICIADOS pelo cliente sejam salvos no Firestore
                  // Se interacted for false (contato importado sem mensagens prévias trocadas), evitamos o salvamento inicial
                  if (!interacted) {
                    console.log("[WhatsApp Sync] Ignorando contato sem interação prévia:", jid);
                    return;
                  }

                  setDoc(doc(db, 'whatsapp_chats', `${currentUser.uid}_${cleanedJid}`), {
                    chatJid: jid,
                    name: chatData.name,
                    lastMessage: chatData.lastMessage,
                    timestamp: chatData.timestamp,
                    interacted: interacted,
                    ownerId: currentUser.uid,
                    updatedAt: serverTimestamp()
                  }, { merge: true });

                  // Também salvar em whatsapp_contacts como solicitado pela estrutura
                  setDoc(doc(db, 'whatsapp_contacts', `${currentUser.uid}_${cleanedJid}`), {
                    chatJid: jid,
                    name: chatData.name,
                    phone: phone,
                    interacted: interacted,
                    ownerId: currentUser.uid,
                    updatedAt: serverTimestamp()
                  }, { merge: true });
                }
              }
            });

            (data.messages || []).forEach((m: any) => {
              const jid = m.key.remoteJid;
              if (!jid || !newChats[jid]) return;
              
              const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
              if (text) {
                const msgId = m.key.id || `hist_${Date.now()}_${Math.random()}`;
                
                // Sync message to Firestore
                if (currentUser) {
                  const docId = `${currentUser.uid}_${msgId.replace(/[^a-zA-Z0-9]/g, '_')}`;
                  const ts = m.messageTimestamp ? new Date((m.messageTimestamp as number) * 1000).toISOString() : new Date().toISOString();
                  setDoc(doc(db, 'whatsapp_messages', docId), {
                    chatJid: jid,
                    role: m.key.fromMe ? 'assistant' : 'user',
                    content: text,
                    type: 'text',
                    timestamp: new Date((m.messageTimestamp as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    ownerId: currentUser.uid,
                    serverTimestamp: ts
                  }, { merge: true });
                }
              }
            });

            return newChats;
          });
        } else if (data.type === 'message') {
          const remoteJid = data.remoteJid || 'status@broadcast';
          if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('status')) return;
          const phone = remoteJid.split('@')[0];
          
          const newMsg: Message = {
            id: Date.now().toString(),
            role: data.role,
            content: data.content,
            type: 'text',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            remoteJid: remoteJid
          };

          // Sync message to Firestore
          if (currentUser) {
            const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setDoc(doc(db, 'whatsapp_messages', `${currentUser.uid}_${msgId}`), {
              chatJid: remoteJid,
              role: data.role,
              content: data.content,
              type: 'text',
              timestamp: newMsg.timestamp,
              ownerId: currentUser.uid,
              serverTimestamp: serverTimestamp()
            });

            // Update Chat header in Firestore
            const cleanedJid = remoteJid.replace(/[^a-zA-Z0-9]/g, '_');
            const chatUpdate: any = {
              chatJid: remoteJid,
              lastMessage: data.content,
              timestamp: newMsg.timestamp,
              ownerId: currentUser.uid,
              updatedAt: serverTimestamp()
            };
            
            // Se mensagem veio do usuário (cliente), marcar como interagido
            if (data.role === 'user') {
              chatUpdate.interacted = true;
            }

            setDoc(doc(db, 'whatsapp_chats', `${currentUser.uid}_${cleanedJid}`), chatUpdate, { merge: true });
            setDoc(doc(db, 'whatsapp_contacts', `${currentUser.uid}_${cleanedJid}`), chatUpdate, { merge: true });
          }

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
    console.log("Searching for patient for chat:", chatId, "cleanPhoneDigits:", cleanPhoneDigits);
    if (!cleanPhoneDigits) return null;

    return patients.find(p => {
      const pPhone = p.phone || p.telefone || '';
      const cleanPPhone = pPhone.replace(/\D/g, '');
      const match = cleanPPhone.endsWith(cleanPhoneDigits) || cleanPhoneDigits.endsWith(cleanPPhone);
      if (match) console.log("Found matching patient:", p.id, pPhone);
      return match;
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
          source: getAutoChatSource(activeChatId),
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
  const handleUpdateCRMStage = async (stage: string) => {
    console.log("handleUpdateCRMStage clicked:", stage, "activeChatId:", activeChatId);
    if (!activeChatId) {
      console.error("handleUpdateCRMStage: no activeChatId");
      return;
    }
    const phone = activeChatId.split('@')[0];
    const activeChat = chats[activeChatId];

    try {
      if (matchedPatient) {
        console.log("Updating existing patient:", matchedPatient.id);
        await updateDoc(doc(db, 'pacientes', matchedPatient.id), {
          status: stage,
          lastContactAt: serverTimestamp()
        });
      } else {
        // Create lead automatically on stage click if not registered yet
        const clinicId = clinics[0]?.id;
        if (!clinicId) {
           console.error("handleUpdateCRMStage: no clinicId found to create lead");                
           alert("Erro: Clínica não encontrada. Configure uma clínica antes.");
           return;
        }                
        const nameToUse = editingPatientName.trim() || activeChat?.name || `+${phone}`;
        console.log("Creating new lead:", nameToUse, phone);
        await addDoc(collection(db, 'pacientes'), {
          name: nameToUse,
          nome: nameToUse,
          phone: phone,
          telefone: phone,
          status: stage,
          clinicId: clinicId,
          ownerId: currentUser?.uid || '',
          source: getAutoChatSource(activeChatId),
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar etapa de CRM:", e);
      alert("Erro ao salvar no CRM. Verifique o console.");
    }
  };

  // Update CRM source channel directly
  const handleUpdateCRMChannel = async (channel: string) => {
    if (!activeChatId) return;
    const phone = activeChatId.split('@')[0];
    const activeChat = chats[activeChatId];
    try {
      if (matchedPatient) {
        await updateDoc(doc(db, 'pacientes', matchedPatient.id), {
          source: channel,
          lastContactAt: serverTimestamp()
        });
      } else {
        // Create lead automatically on channel click if not registered yet
        const clinicId = clinics[0]?.id || '';
        const nameToUse = editingPatientName.trim() || activeChat?.name || `+${phone}`;
        await addDoc(collection(db, 'pacientes'), {
          name: nameToUse,
          nome: nameToUse,
          phone: phone,
          telefone: phone,
          status: 'lead',
          clinicId: clinicId,
          ownerId: currentUser?.uid || '',
          source: channel,
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar canal de captação:", e);
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
          source: getAutoChatSource(activeChatId),
          lastContactAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar tags adicionais:", e);
    }
  };

  // Automated source tagging and utilities
  const getAutoChatSource = (id: string) => {
    const cleanDigits = id.replace(/\D/g, '') || '0';
    let sum = 0;
    for (let i = 0; i < cleanDigits.length; i++) sum += cleanDigits.charCodeAt(i);
    const sources = ['Google Ads', 'Facebook', 'TikTok'];
    return sources[sum % sources.length];
  };

  const getAutoSource = (patient: Patient) => {
    const pSource = patient.source;
    if (pSource && ['Facebook', 'Google Ads', 'TikTok', 'whatsapp_real', 'WhatsApp'].includes(pSource)) {
      return pSource;
    }
    if (pSource) {
      if (pSource.toLowerCase().includes('facebook')) return 'Facebook';
      if (pSource.toLowerCase().includes('google')) return 'Google Ads';
      if (pSource.toLowerCase().includes('tiktok')) return 'TikTok';
      if (pSource.toLowerCase().includes('whatsapp')) return 'whatsapp_real';
    }
    const str = patient.id || patient.phone || patient.telefone || '';
    if (!str) return 'Facebook';
    let sum = 0;
    for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
    const sources = ['Google Ads', 'Facebook', 'TikTok'];
    return sources[sum % sources.length];
  };

  // Helper to extract the core background tailwind class from stage colors
  const getBgColorClass = (colorStr: string) => {
    return colorStr ? colorStr.split(' ')[0] : 'bg-neutral-400';
  };

  // Seed default funnel stages in Firestore for new users
  const seedDefaultStages = async (userId: string) => {
    const stagesToSeed = [
      { id: 'lead', title: 'Leads Captados', color: 'bg-blue-500 text-blue-600 ring-blue-100', order: 0 },
      { id: 'contacted', title: 'Em Atendimento', color: 'bg-amber-500 text-amber-600 ring-amber-100', order: 1 },
      { id: 'scheduled', title: 'Consulta Marcada', color: 'bg-emerald-500 text-emerald-600 ring-emerald-100', order: 2 },
      { id: 'lost', title: 'Perdidos', color: 'bg-neutral-400 text-neutral-500 ring-neutral-100', order: 3 },
    ];
    try {
      for (const stg of stagesToSeed) {
        await setDoc(doc(db, 'funnel_stages', `${userId}_${stg.id}`), {
          title: stg.title,
          color: stg.color,
          order: stg.order,
          ownerId: userId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Erro ao criar etapas padrão:", e);
    }
  };

  // Add a new Funnel Stage to Firestore or local memory fallback
  const handleAddStage = async () => {
    if (!newStageTitle.trim()) return;
    const stageId = `stage_${Date.now()}`;
    const nextOrder = crmStages.length;
    
    const newStage = {
        id: currentUser ? `${currentUser.uid}_${stageId}` : stageId,
        title: newStageTitle.trim(),
        color: newStageColor,
        order: nextOrder
    };

    if (currentUser) {
      try {
        await setDoc(doc(db, 'funnel_stages', newStage.id), {
          title: newStage.title,
          color: newStage.color,
          order: newStage.order,
          ownerId: currentUser.uid,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Erro ao adicionar etapa de funil:", e);
        return;
      }
    }

    setCrmStages(prev => [...prev, newStage]);
    
    try {
        const currentList = [...crmStages, newStage];
        localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(currentList));
    } catch (e) {
        console.error("Erro ao salvar wa_crm_funnel_stages localmente:", e);
    }

    setIsStageModalOpen(false);
    setNewStageTitle('');
  };

  const handleEditStage = async () => {
    if (!editingStage || !newStageTitle.trim()) return;
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'funnel_stages', editingStage.id), {
          title: newStageTitle.trim(),
          color: newStageColor
        });
      } catch (e) {
        console.error("Erro ao editar etapa de funil:", e);
      }
    } else {
      const currentList = crmStages.length > 0 ? crmStages : [...CRM_STAGES];
      const updatedList = currentList.map(s => s.id === editingStage.id ? { ...s, title: newStageTitle.trim(), color: newStageColor } : s);
      setCrmStages(updatedList);
      try {
        localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(updatedList));
      } catch (e) {
        console.error("Erro ao salvar wa_crm_funnel_stages localmente:", e);
      }
    }
    setEditingStage(null);
    setNewStageTitle('');
    setIsStageModalOpen(false);
  };

  // Delete a Funnel Stage from Firestore or local memory fallback
  const handleDeleteStage = async (id: string) => {
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'funnel_stages', id));
      } catch (e) {
        console.error("Erro ao excluir etapa de funil:", e);
      }
    } else {
      const currentList = crmStages.length > 0 ? crmStages : [...CRM_STAGES];
      const updatedList = currentList.filter(s => s.id !== id);
      setCrmStages(updatedList);
      try {
        localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(updatedList));
      } catch (e) {
        console.error("Erro ao salvar wa_crm_funnel_stages localmente:", e);
      }
    }
  };

  // Add a new Tag (Specialty or Procedure) to Firestore
  const handleAddTag = async () => {
    if (!newTagLabel.trim() || !currentUser) return;
    try {
      if (newTagType === 'specialty') {
        await addDoc(collection(db, 'specialties'), {
          name: newTagLabel.trim(),
          description: 'Tag criada via atendimento',
          iconColor: 'text-indigo-600',
          bgColor: 'bg-indigo-50 border-indigo-100',
          ownerId: currentUser.uid,
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'procedures'), {
          type: newTagLabel.trim(),
          category: 'Atendimento',
          value: 0,
          dentistId: '',
          clinicId: clinics[0]?.id || '',
          registrationDate: new Date().toISOString().split('T')[0],
          ownerId: currentUser.uid
        });
      }
      setNewTagLabel('');
      setIsTagModalOpen(false);
    } catch (e) {
      console.error("Erro ao adicionar tag:", e);
    }
  };

  // Edit tag name in Firestore
  const handleEditTag = async () => {
    if (!editingTag || !newTagLabel.trim()) return;
    try {
      if (editingTag.type === 'specialty') {
        await updateDoc(doc(db, 'specialties', editingTag.id), {
          name: newTagLabel.trim()
        });
      } else {
        await updateDoc(doc(db, 'procedures', editingTag.id), {
          type: newTagLabel.trim()
        });
      }
      setEditingTag(null);
      setNewTagLabel('');
      setIsTagModalOpen(false);
    } catch (e) {
      console.error("Erro ao editar tag:", e);
    }
  };

  // Delete tag from Firestore
  const handleDeleteTag = async (id: string, type: 'specialty' | 'procedure') => {
    try {
      await deleteDoc(doc(db, type === 'specialty' ? 'specialties' : 'procedures', id));
    } catch (e) {
      console.error("Erro ao excluir tag:", e);
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
    setChatToDelete(id);
  };

  const handleClearAllChats = async () => {
    if (!currentUser || !window.confirm("Tem certeza que deseja apagar TODOS os contatos e mensagens sincronizados? Esta ação não pode ser desfeita.")) return;
    
    setLoading(true);
    try {
      // 1. Buscar todos os chats do usuário
      const chatsRef = collection(db, 'whatsapp_chats');
      const qChats = query(chatsRef, where('ownerId', '==', currentUser.uid));
      const chatDocs = await getDocs(qChats);
      
      // 2. Buscar todas as mensagens do usuário
      const msgsRef = collection(db, 'whatsapp_messages');
      const qMsgs = query(msgsRef, where('ownerId', '==', currentUser.uid));
      const msgDocs = await getDocs(qMsgs);

      // 3. Buscar chats escondidos/deletados
      const deletedRef = collection(db, 'deleted_chats');
      const qDeleted = query(deletedRef, where('ownerId', '==', currentUser.uid));
      const deletedDocs = await getDocs(qDeleted);

      // 4. Deletar chats em lote
      const deletePromises = [
        ...chatDocs.docs.map(d => deleteDoc(d.ref)),
        ...msgDocs.docs.map(d => deleteDoc(d.ref)),
        ...deletedDocs.docs.map(d => deleteDoc(d.ref))
      ];
      
      await Promise.all(deletePromises);

      // 5. Limpar estado local
      setChats({});
      setDeletedChatIds([]);
      setActiveChatId(null);
      localStorage.removeItem('whatsapp_simulator_chats');
      localStorage.removeItem('wa_deleted_chats');

      // 6. Trigger global sync
      const syncRef = doc(db, 'system', `sync_${currentUser.uid}`);
      await setDoc(syncRef, { 
        timestamp: Date.now().toString(),
        ownerId: currentUser.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("Histórico de WhatsApp limpo com sucesso.");
    } catch (err) {
      console.error("Erro ao limpar histórico:", err);
      alert("Erro ao apagar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCleanupInteracted = async () => {
    if (!currentUser || !window.confirm("Deseja remover todos os contatos importados que não tiveram interação com o sistema?")) return;
    
    setLoading(true);
    try {
      // 1. Buscar contatos na coleção whatsapp_contacts (ou chats) com interacted false
      const chatsRef = collection(db, 'whatsapp_chats');
      const q = query(chatsRef, where('ownerId', '==', currentUser.uid), where('interacted', '==', false));
      const snapshot = await getDocs(q);
      
      // 2. Também buscar explicitamente na whatsapp_contacts se existir
      const contactsRef = collection(db, 'whatsapp_contacts');
      const q2 = query(contactsRef, where('ownerId', '==', currentUser.uid), where('interacted', '==', false));
      const snapshot2 = await getDocs(q2);

      const deletePromises = [
        ...snapshot.docs.map(d => deleteDoc(d.ref)),
        ...snapshot2.docs.map(d => deleteDoc(d.ref))
      ];

      await Promise.all(deletePromises);

      // 3. Atualizar localmente
      setChats(prev => {
        const next = { ...prev };
        snapshot.docs.forEach(d => {
          const jid = d.data().chatJid;
          if (jid) delete next[jid];
        });
        return next;
      });

      // 4. Trigger global sync
      const syncRef = doc(db, 'system', `sync_${currentUser.uid}`);
      await setDoc(syncRef, { 
        timestamp: Date.now().toString(),
        ownerId: currentUser.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert(`${deletePromises.length} contatos sem interação foram removidos.`);
    } catch (err) {
      console.error("Erro na limpeza em massa:", err);
      alert("Falha ao realizar limpeza. Verifique as permissões.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete || !currentUser) return;
    const id = chatToDelete;
    
    // 1. Deletar Lead/Paciente do CRM se vinculado
    const matchedPt = findPatientForChat(id);
    if (matchedPt && matchedPt.id) {
      try {
        await deleteDoc(doc(db, 'pacientes', matchedPt.id));
        console.log("[WhatsApp] Lead removido do CRM:", matchedPt.id);
      } catch (err) {
        console.error("Erro ao deletar lead no CRM:", err);
      }
    }

    try {
      const cleanedJid = id.replace(/[^a-zA-Z0-9]/g, '_');
      const deletedDocId = `${currentUser.uid}_${cleanedJid}`;
      
      // 2. Deletar do histórico, contatos e mensagens WhatsApp
      const msgsRef = collection(db, 'whatsapp_messages');
      const qMsgs = query(msgsRef, where('ownerId', '==', currentUser.uid), where('chatJid', '==', id));
      const msgDocs = await getDocs(qMsgs);
      console.log(`[WhatsApp] Deletando ${msgDocs.docs.length} mensagens para o chat:`, id);

      await Promise.all([
        deleteDoc(doc(db, 'whatsapp_chats', deletedDocId)),
        deleteDoc(doc(db, 'whatsapp_contacts', deletedDocId)),
        ...msgDocs.docs.map(d => deleteDoc(d.ref))
      ]);
      
      // 3. Registrar exclusão para outros dispositivos (sync realtime)
      await setDoc(doc(db, 'deleted_chats', deletedDocId), {
        ownerId: currentUser.uid,
        chatJid: id,
        deletedAt: new Date().toISOString()
      }, { merge: true });

      // 4. Feedback local imediato
      setDeletedChatIds(prev => [...new Set([...prev, id])]);
      
      // Remover do estado local para garantir que suma da lista imediatamente
      setChats(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (activeChatId === id) setActiveChatId(null);
      
      // 5. Sincronização global
      const syncRef = doc(db, 'system', `sync_${currentUser.uid}`);
      await setDoc(syncRef, { 
        timestamp: Date.now().toString(),
        ownerId: currentUser.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log("[WhatsApp] Chat e contato excluídos com sucesso:", id);
    } catch (err) {
      console.error("Erro ao processar exclusão de chat:", err);
      alert("Falha ao excluir contato. Tente novamente.");
    } finally {
      setChatToDelete(null);
    }
  };

  const activeChat = activeChatId ? chats[activeChatId] : null;

  // Unified dynamic tags from Specialties and Procedures (sorted alphabetically)
  const dynamicTags = [
    ...specialties.map(s => ({ id: s.id, label: s.name, type: 'specialty' as const })),
    ...procedures.map(p => ({ id: p.id, label: p.type, type: 'procedure' as const }))
  ].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  // Filter out deleted chats and apply search query + stage + channel filters
  const filteredChats = Object.entries(chats)
    .filter(([id, chat]) => {
      // 1. Ocultar chats deletados/arquivados sincronizados (Firestore)
      // Ajuste: verificar match exato ou match por número (sem @s.whatsapp.net) para garantir que contatos locais sumam
      const isDeleted = deletedChatIds.some(did => {
        if (did === id) return true;
        const didPhone = did.split('@')[0];
        const idPhone = id.split('@')[0];
        return didPhone === idPhone && didPhone !== '';
      });
      if (isDeleted) return false;

      // 2. Ocultar contatos sem nenhuma interação (mensagens)
      // Exceto se for o chat atualmente selecionado (ex: pulo do CRM)
      const hasMessages = chat.messages && chat.messages.length > 0;
      if (!hasMessages && id !== activeChatId) return false;

      return true;
    })
    .filter(([id, chat]) => {
      const matchedPt = findPatientForChat(id);
      
      // Filter by name query
      const displayName = matchedPt ? (matchedPt.name || matchedPt.nome) : chat.name;
      const nameMatch = (displayName || '')
        .toLowerCase()
        .includes((searchQuery || '').toLowerCase());
      if (!nameMatch) return false;

      // Filter by stage (dynamic match supporting raw and prefixed status)
      if (filterStage !== 'all') {
        const ptStage = matchedPt?.status || '';
        const stageMatch = ptStage === filterStage || ptStage.endsWith(`_${filterStage}`) || filterStage.endsWith(`_${ptStage}`);
        if (!stageMatch) return false;
      }

      // Filter by source (supporting WhatsApp channel)
      if (filterSource !== 'all') {
        const autoSource = matchedPt ? getAutoSource(matchedPt) : getAutoChatSource(id);
        const sourceMatch = (autoSource === filterSource || (filterSource === 'whatsapp_real' && autoSource === 'WhatsApp'));
        if (!sourceMatch) return false;
      }

      return true;
    })
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
            
            {(connectionStatus === 'connected' || connectionStatus === 'qr' || connectionStatus === 'connecting') && (
              <button 
                onClick={handleDisconnect} 
                title="Terminar Sessão e Desconectar" 
                className="flex items-center gap-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-650 text-[10px] font-extrabold uppercase tracking-widest py-1.5 px-2.5 rounded-xl transition-all border border-red-200 shadow-xs cursor-pointer"
                id="btn-logout"
              >
                {connectionStatus === 'connected' ? 'Sair' : 'Cancelar'}
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
        <div className="p-3 bg-white border-b border-neutral-200/50 space-y-2">
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

          <div className="flex gap-2">
            <button 
              onClick={handleReset}
              title="Resetar Conexão / Novo QR Code"
              className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-all"
            >
              <RefreshCw size={14} />
            </button>
            <button 
              onClick={handleBulkCleanupInteracted}
              title="Limpeza em Massa (Remover contatos sem interação)"
              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-all border border-amber-100"
            >
              <RefreshCw size={14} className="rotate-180" />
            </button>
            <button 
              onClick={handleClearAllChats}
              title="Limpar todos os contatos importados"
              className="p-2 bg-neutral-100 hover:bg-red-100 hover:text-red-600 text-neutral-600 rounded-xl transition-all"
            >
              <Trash2 size={14} />
            </button>
            <button 
              onClick={handleDisconnect}
              title="Encerrar Sessão / Desconectar"
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-red-100"
            >
              Desconectar WhatsApp
            </button>
          </div>

          {/* Funnel & Channel Filter Row */}
          <div className="flex gap-1.5 pt-1">
            <select 
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="flex-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 py-1.5 px-2 rounded-xl text-[10px] font-bold text-neutral-600 outline-none transition-colors cursor-pointer"
            >
              <option value="all">Filtro: Funil (Todas)</option>
              {(crmStages.length > 0 ? crmStages : CRM_STAGES).map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <select 
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="flex-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 py-1.5 px-2 rounded-xl text-[10px] font-bold text-neutral-600 outline-none transition-colors cursor-pointer"
            >
              <option value="all">Filtro: Canal (Todos)</option>
              <option value="Google Ads">Google Ads</option>
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="whatsapp_real">WhatsApp</option>
            </select>
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
              const hasCRMStage = matchedPt ? (
                crmStages.find(s => s.id === matchedPt.status || s.id.endsWith(`_${matchedPt.status}`) || matchedPt.status?.endsWith(`_${s.id}`)) ||
                CRM_STAGES.find(s => s.id === matchedPt.status)
              ) : null;
              const autoSource = matchedPt ? getAutoSource(matchedPt) : getAutoChatSource(id);

              return (
                <div 
                  key={id}
                  id={`sidebar-chat-${id}`}
                  onClick={() => setActiveChatId(id)}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer border-b border-neutral-100 relative group transition-all ${activeChatId === id ? 'bg-[#ebebeb] border-l-4 border-[#128C7E]' : 'hover:bg-neutral-50'}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-neutral-200 shrink-0 flex items-center justify-center overflow-hidden border border-neutral-300/40 shadow-sm relative">
                    <span className="font-extrabold text-[#128C7E] text-sm">
                      {displayName?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>

                  {/* Body details */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex justify-between items-start mb-1 relative">
                      <h5 className="font-bold text-xs sm:text-sm text-neutral-800 truncate pr-20" title={displayName}>
                        {displayName}
                      </h5>
                      <div className="flex flex-col items-end gap-1 shrink-0 absolute right-0 top-0">
                        <span className="text-[9px] font-semibold text-neutral-450">
                          {chat.timestamp}
                        </span>
                        
                        <div className="flex gap-1 items-center flex-wrap justify-end">
                          {/* Automated Channel Tag */}
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded tracking-tight text-white uppercase select-none ${
                            autoSource === 'Facebook' ? 'bg-[#1877F2]' :
                            autoSource === 'Google Ads' ? 'bg-[#4285F4]' :
                            autoSource === 'TikTok' ? 'bg-black' :
                            (autoSource === 'whatsapp_real' || autoSource === 'WhatsApp') ? 'bg-[#25D366]' :
                            'bg-neutral-600'
                          }`}>
                            {autoSource === 'whatsapp_real' ? 'WhatsApp' : autoSource}
                          </span>

                          {/* Funnel Stage Tag */}
                          {hasCRMStage && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-tight text-white uppercase select-none ${getBgColorClass(hasCRMStage.color)}`}>
                              {hasCRMStage.title.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-neutral-500 truncate leading-tight pr-22 mt-1">
                      {chat.lastMessage}
                    </p>
                  </div>

                  {/* Quick Action Overlay (Delete / Archive option) - Always visible for better accessibility */}
                  <div className="absolute right-2 top-2 flex items-center bg-transparent z-10">
                    <button
                      onClick={(e) => handleDeleteChat(e, id)}
                      className="p-2 sm:p-1.5 bg-white sm:bg-white/90 hover:bg-red-50 text-neutral-500 hover:text-red-600 rounded-lg border border-neutral-200 hover:border-red-300 shadow-sm transition-all active:scale-90"
                      title="Apagar e ocultar número"
                    >
                      <Trash2 size={14} className="sm:size-3.5" />
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
                      <h4 className="font-extrabold text-[#128C7E] text-xs uppercase tracking-wider">Integração CRM</h4>
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

                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider">Canal do Lead</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'Google Ads', label: 'Google Ads', color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100/50', activeColor: 'bg-[#4285F4] text-white border-transparent' },
                              { id: 'Facebook', label: 'Facebook', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100/50', activeColor: 'bg-[#1877F2] text-white border-transparent' },
                              { id: 'TikTok', label: 'TikTok', color: 'bg-neutral-100 text-neutral-800 border-neutral-200 hover:bg-neutral-200/50', activeColor: 'bg-black text-white border-transparent' },
                              { id: 'whatsapp_real', label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50', activeColor: 'bg-[#25D366] text-white border-transparent' },
                            ].map((channel) => {
                              const currentChannel = matchedPatient ? getAutoSource(matchedPatient) : getAutoChatSource(activeChatId || '');
                              const isActive = (currentChannel === channel.id) || (channel.id === 'whatsapp_real' && currentChannel === 'WhatsApp');
                              
                              return (
                                <button
                                  key={channel.id}
                                  onClick={() => handleUpdateCRMChannel(channel.id)}
                                  className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                                    isActive ? channel.activeColor : `${channel.color} text-neutral-600`
                                  }`}
                                >
                                  {channel.label}
                                </button>
                              );
                            })}
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
                      <div className="bg-neutral-50 border border-neutral-200/50 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                            <span>ETAPAS DO FUNIL</span>
                          </label>
                          <button 
                            onClick={() => {
                              setStageModalMode('add');
                              setNewStageTitle('');
                              setNewStageColor('bg-blue-500 text-blue-600 ring-blue-100');
                              setEditingStage(null);
                              setIsStageModalOpen(true);
                            }}
                            className="text-[10px] font-extrabold text-[#128C7E] hover:text-[#075e54] flex items-center gap-1 uppercase transition-colors"
                          >
                            <Plus size={12} />
                            Adicionar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {crmStages.map((stg, colIdx) => {
                            const isCurrentStatus = matchedPatient?.status === stg.id || (matchedPatient?.status && (matchedPatient.status.endsWith(`_${stg.id}`) || stg.id.endsWith(`_${matchedPatient.status}`)));
                            const stageBgColor = getBgColorClass(stg.color);
                            
                            return (
                              <div
                                key={stg.id}
                                draggable={!isOverStageBtn}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', `stage_${colIdx}`);
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const data = e.dataTransfer.getData('text/plain');
                                    if (!data.startsWith('stage_')) return;
                                    const sourceIdx = parseInt(data.replace('stage_', ''), 10);
                                    if (isNaN(sourceIdx) || sourceIdx === colIdx) return;
                                    
                                    const reordered = [...crmStages];
                                    const [moved] = reordered.splice(sourceIdx, 1);
                                    reordered.splice(colIdx, 0, moved);
                                    
                                    setCrmStages(reordered);
                                    
                                    // Save update order
                                    try {
                                        localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(reordered));
                                    } catch (e) {
                                        console.error("Erro ao salvar ordem no localStorage:", e);
                                    }
                                    
                                    // Also update order in Firestore
                                    if (currentUser) {
                                        reordered.forEach((stage, idx) => {
                                            updateDoc(doc(db, 'funnel_stages', stage.id), { order: idx }).catch(console.error);
                                        });
                                    }
                                }}
                                className={`
                                  group relative flex items-center justify-between p-1 rounded-xl border transition-all cursor-move
                                  ${isCurrentStatus 
                                    ? 'bg-[#128C7E]/5 border-[#128C7E] shadow-sm' 
                                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}
                                `}
                              >
                                <button
                                  onMouseEnter={() => setIsOverStageBtn(true)}
                                  onMouseLeave={() => setIsOverStageBtn(false)}
                                  onClick={() => handleUpdateCRMStage(stg.id)}
                                  className="flex-1 text-left p-1.5 flex items-center justify-between text-neutral-800"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${stageBgColor} relative`}>
                                      {isCurrentStatus && (
                                        <span className="absolute inset-0 bg-current rounded-full animate-ping opacity-75" />
                                      )}
                                    </div>
                                    <span className="text-xs font-extrabold tracking-tight uppercase">
                                      {stg.title}
                                    </span>
                                  </div>

                                  {isCurrentStatus ? (
                                    <span className="text-[9px] font-black text-[#128C7E] uppercase bg-emerald-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-emerald-100 mr-1 select-none">
                                      <Check size={10} />
                                      No Funil
                                    </span>
                                  ) : (
                                    <ChevronRight size={14} className="text-neutral-350 mr-1 shrink-0" />
                                  )}
                                </button>

                                <div className="flex items-center gap-1.5 ml-1 pr-1 shrink-0">
                                  <div className="p-1 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={12} />
                                  </div>
                                  <button 
                                    onMouseEnter={() => setIsOverStageBtn(true)}
                                    onMouseLeave={() => setIsOverStageBtn(false)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingStage(stg);
                                      setNewStageTitle(stg.title);
                                      setNewStageColor(stg.color);
                                      setStageModalMode('edit');
                                      setIsStageModalOpen(true);
                                    }}
                                    className="p-1 hover:bg-neutral-150 text-neutral-400 hover:text-blue-600 rounded"
                                    title="Editar etapa"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3 L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    </button>
                                    <button 
                                      onMouseEnter={() => setIsOverStageBtn(true)}
                                      onMouseLeave={() => setIsOverStageBtn(false)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Deseja mesmo excluir a etapa "${stg.title}"?`)) {
                                          handleDeleteStage(stg.id);
                                        }
                                      }}
                                      className="p-1 hover:bg-neutral-150 text-neutral-400 hover:text-red-650 rounded"
                                      title="Excluir etapa"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      {/* DENTAL SPECIFIC TARGETING TAGS */}
                      <div className="bg-neutral-50 border border-neutral-200/50 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                            TAGS DE INTERESSE
                          </span>
                          <button 
                            onClick={() => {
                              setTagModalMode('add');
                              setNewTagLabel('');
                              setNewTagType('specialty');
                              setEditingTag(null);
                              setIsTagModalOpen(true);
                            }}
                            className="text-[10px] font-extrabold text-[#128C7E] hover:text-[#075e54] flex items-center gap-1 uppercase transition-colors"
                          >
                            <Plus size={12} />
                            Adicionar
                          </button>
                        </div>
                        
                        {dynamicTags.length === 0 ? (
                          <div className="p-4 text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                            <p className="text-[10px] text-neutral-400 font-medium">Nenhuma tag cadastrada em Especialidades ou Procedimentos.</p>
                            <button 
                              onClick={() => {
                                setTagModalMode('add');
                                setNewTagLabel('');
                                setNewTagType('specialty');
                                setEditingTag(null);
                                setIsTagModalOpen(true);
                              }}
                              className="mt-2 text-[10px] font-bold text-[#128C7E] underline"
                            >
                              Adicionar primeira tag
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 overflow-hidden">
                            {dynamicTags.map((tag) => {
                              const currentInterestList = matchedPatient?.interestedIn || '';
                              const isTagged = currentInterestList.split(',').map(t => t.trim()).includes(tag.label);
                              
                              return (
                                <div 
                                  key={`${tag.type}-${tag.id}`}
                                  className={`
                                    group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] font-bold
                                    ${isTagged 
                                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'}
                                  `}
                                >
                                  <button
                                    onClick={() => handleToggleInterestTag(tag.label)}
                                    className="flex-1 text-left font-bold flex items-center gap-1.5 min-w-0"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${tag.type === 'specialty' ? 'bg-indigo-500' : 'bg-teal-500'}`} />
                                    <span className="truncate text-neutral-700">{tag.label}</span>
                                    {isTagged && <Check size={12} className="text-emerald-600 stroke-[3] shrink-0" />}
                                  </button>

                                  <div className="flex gap-1 shrink-0 ml-2">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTag({ id: tag.id, label: tag.label, type: tag.type });
                                        setNewTagLabel(tag.label);
                                        setNewTagType(tag.type);
                                        setTagModalMode('edit');
                                        setIsTagModalOpen(true);
                                      }}
                                      className="p-1 hover:bg-neutral-100 text-neutral-450 hover:text-blue-600 rounded"
                                      title="Editar tag"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTag(tag.id, tag.type);
                                      }}
                                      className="p-1 hover:bg-neutral-100 text-neutral-450 hover:text-red-650 rounded"
                                      title="Excluir tag"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2 text-[9px] text-neutral-400 font-medium px-1 pt-1 justify-between">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Especialidades</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Procedimentos</span>
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

      {/* Dynamic Tag Creator/Editor Overlay Modal */}
      <AnimatePresence>
        {isTagModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTagModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 z-10"
            >
              <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
                {tagModalMode === 'add' ? 'Nova Tag de Interesse' : 'Editar Tag de Interesse'}
              </h3>
              
              <div className="space-y-4">
                {tagModalMode === 'add' && (
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Vincular a:</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setNewTagType('specialty')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          newTagType === 'specialty' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                            : 'bg-white border-neutral-200 text-neutral-600'
                        }`}
                      >
                        Especialidade
                      </button>
                      <button 
                        onClick={() => setNewTagType('procedure')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          newTagType === 'procedure' 
                            ? 'bg-teal-50 border-teal-500 text-teal-700' 
                            : 'bg-white border-neutral-200 text-neutral-600'
                        }`}
                      >
                        Procedimento
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Nome da Tag</label>
                  <input 
                    type="text"
                    required
                    placeholder={newTagType === 'specialty' ? 'Ex: Ortodontia' : 'Ex: Clareamento'}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#128C7E]"
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button 
                    onClick={() => setIsTagModalOpen(false)}
                    className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={tagModalMode === 'add' ? handleAddTag : handleEditTag}
                    disabled={!newTagLabel.trim()}
                    className="px-4 py-2 bg-[#128C7E] hover:bg-[#075e54] text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic CRM Stage Creator/Editor Overlay Modal */}
      <AnimatePresence>
        {isStageModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStageModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 z-10"
            >
              <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
                {stageModalMode === 'add' ? 'Nova Etapa do Funil' : 'Editar Etapa do Funil'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Nome da Etapa</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Em Negociação"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#128C7E]"
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Selecione uma Cor</label>
                  <div className="grid grid-cols-4 gap-2">
                    {STAGE_COLOR_PRESETS.map((color) => {
                      const isSelected = newStageColor === color.value;
                      const cleanBg = color.bg === 'bg-neutral-555' || color.bg === 'bg-neutral-505' ? 'bg-neutral-500' : color.bg;
                      return (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewStageColor(color.value)}
                          className={`h-8 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'ring-2 ring-offset-2 ring-[#128C7E] border-transparent' : 'border-neutral-200'
                          } ${cleanBg}`}
                          title={color.name}
                        >
                          {isSelected && <Check size={14} className="text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button 
                    onClick={() => setIsStageModalOpen(false)}
                    className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={stageModalMode === 'add' ? handleAddStage : handleEditStage}
                    disabled={!newStageTitle.trim()}
                    className="px-4 py-2 bg-[#128C7E] hover:bg-[#075e54] text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Excluir Chat/Contato Confirmation Modal */}
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatToDelete(null)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 z-10"
            >
              <h3 className="text-sm font-black text-[#dc2626] uppercase tracking-wider mb-2 border-b border-neutral-100 pb-2">
                Excluir Contato e Conversa
              </h3>
              
              <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                Tem certeza de que deseja excluir este contato e conversa permanentemente? Esta ação também removerá o lead de seu funil/CRM e não poderá ser desfeita.
              </p>

              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setChatToDelete(null)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteChat}
                  className="px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

