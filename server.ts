import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion,
  WAMessage,
  MessageUpsertType,
  Browsers
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Initialize Supabase Client for backend sync
let supabaseClient: any = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      console.warn("Supabase credentials missing on backend side!");
    }
  }
  return supabaseClient;
}

console.log('--- SERVER RESTART ---');
console.log('[Env Boot] Credenciais Detectadas:', {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'OK' : (process.env.SUPABASE_URL ? 'FALLBACK OK' : 'MISSING'),
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'OK' : (process.env.SUPABASE_ANON_KEY ? 'FALLBACK OK' : 'MISSING'),
});

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/ws' });

// Middleware CORS robusto antes de qualquer rota
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://front-odonto.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  if (origin) {
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('run.app') || origin.includes('studio') || origin.includes('google.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://front-odonto.vercel.app');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Allow-Headers, token, access_token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rota para expor chaves do Supabase para o frontend (necessário para o app online funcionar com segredos)
app.get('/api/config/supabase', (req, res) => {
  // Tenta encontrar as chaves em diversas variações de nomes comuns
  const supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL;
    
  const supabaseAnonKey = 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('[API Supabase Config] Solicitação recebida do frontend.', { 
    urlFound: !!supabaseUrl, 
    keyFound: !!supabaseAnonKey,
    hasEnvKeys: Object.keys(process.env).some(k => k.includes('SUPABASE'))
  });
  
  res.json({
    url: supabaseUrl || '',
    anonKey: supabaseAnonKey || '',
    isConfigured: !!(supabaseUrl && supabaseAnonKey)
  });
});

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to get global ownerId (assuming single clinic owner for now) using Supabase
async function getGlobalOwnerInfo() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('owner_id, id')
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return {
      ownerId: data[0].owner_id,
      clinicId: data[0].id
    };
  } catch (err) {
    console.error("Error fetching owner info:", err);
    return null;
  }
}

// WhatsApp State
let sock: any = null;
let qrCode: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'qr' = 'disconnected';
let lastHistory: { chats: any[], messages: any[] } | null = null;
let contactsCache: Record<string, string> = {};
let isConnecting = false;
let forceDisconnect = false;

function isRegisteredContact(jid: string, name?: string): boolean {
  // MUST strictly only be individual physical chats on WhatsApp Web
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return false;

  const contactName = name || contactsCache[jid];
  if (!contactName) return false;

  const trimmed = contactName.trim();
  if (!trimmed) return false;

  // If the display name is just a phone number or format like "+5511...", it is an unsaved guest contact
  if (trimmed.startsWith('+') || /^\d+$/.test(trimmed.replace(/\s+/g, '').replace(/[-()+]/g, ''))) {
    return false;
  }

  return true;
}

function saveMessageToHistory(remoteJid: string, role: 'user' | 'assistant', text: string) {
  if (!lastHistory) {
    lastHistory = { chats: [], messages: [] };
  }
  
  // 1. Ensure chat exists in lastHistory.chats
  const chatIndex = lastHistory.chats.findIndex((c: any) => c.id === remoteJid);
  const now = Math.floor(Date.now() / 1000);
  if (chatIndex >= 0) {
    lastHistory.chats[chatIndex].conversationTimestamp = now;
    // promote to top of list
    const [chatObj] = lastHistory.chats.splice(chatIndex, 1);
    lastHistory.chats.unshift(chatObj);
  } else {
    lastHistory.chats.unshift({
      id: remoteJid,
      conversationTimestamp: now,
      name: contactsCache[remoteJid] || `+${remoteJid.split('@')[0]}`
    });
  }

  // 2. Add message to lastHistory.messages
  const msgId = 'SIM_' + Math.random().toString(36).substring(2, 11);
  const baileysMsg = {
    key: {
      remoteJid: remoteJid,
      fromMe: role === 'assistant',
      id: msgId
    },
    message: {
      conversation: text
    },
    messageTimestamp: now
  };
  
  if (!lastHistory.messages) {
    lastHistory.messages = [];
  }
  lastHistory.messages.push(baileysMsg);
}

// Store removed

// Broadcast to all WS clients
const broadcast = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const debugLog = (msg: string) => {
  try { fs.appendFileSync("wa-debug.log", msg + "\n"); } catch(e) {}
};

function hasSavedSession() {
  try {
    return fs.existsSync(path.join('wa_auth', 'creds.json'));
  } catch (e) {
    return false;
  }
}

async function connectToWhatsApp() {
  if (isConnecting) {
    debugLog("connectToWhatsApp called but is already connecting - skipping");
    return;
  }
  if (sock && connectionStatus === 'connected') {
    debugLog("connectToWhatsApp called but is already connected - skipping");
    return;
  }

  isConnecting = true;
  forceDisconnect = false;
  debugLog("connectToWhatsApp called");
  connectionStatus = 'connecting';
  broadcast({ type: 'status', status: 'connecting' });

  // Cleanup old socket if exists
  if (sock) {
    debugLog("Cleaning up existing socket before new connection attempt");
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ws?.close();
      sock.end(undefined);
    } catch (e) {
      debugLog("Error during socket cleanup: " + (e as any).message);
    }
    sock = null;
  }

  try {
    // Ensure wa_auth exists and is writable
    if (!fs.existsSync('wa_auth')) {
      fs.mkdirSync('wa_auth', { recursive: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('wa_auth');
    
    // Default version to use if fetch fails or hangs
    let version = [2, 3000, 1015901307] as [number, number, number];
    try {
      // Add a timeout to version fetching to prevent hanging indefinitely
      const latest = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout fetching version')), 5000))
      ]);
      if (latest) {
        debugLog("Fetched latest version: " + latest.version.join('.'));
        version = latest.version;
      }
    } catch (e) {
      debugLog("Failed to fetch version or timeout, using default: " + (e as any).message);
    }

    sock = makeWASocket({
      version,
      printQRInTerminal: false, 
      auth: state,
      logger: pino({ level: 'silent' }), 
      browser: Browsers.ubuntu('Chrome'), 
      syncFullHistory: false,
      connectTimeoutMs: 20000, 
      defaultQueryTimeoutMs: 20000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: true,
      retryRequestDelayMs: 2000
    });

    // Safety timeout to reset isConnecting if no events fire for a long time
    const safetyTimer = setTimeout(() => {
      if (isConnecting && connectionStatus === 'connecting') {
        debugLog("Safety timeout: resetting isConnecting after 45s of silence");
        isConnecting = false;
        // Don't change connectionStatus here, let the user retry or let baileys continue
      }
    }, 45000);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr || connection === 'open' || connection === 'close') {
        clearTimeout(safetyTimer);
      }

      debugLog("connection update: " + JSON.stringify({ ...update, qr: (qr ? 'YES' : 'NO') }));
      
      if (qr) {
        debugLog("Generating QR Code from update.qr - Length: " + qr.length);
        console.log(`[WhatsApp] QR Code length ${qr.length} received. Generating image...`);
        try {
          const generatedQr = await QRCode.toDataURL(qr);
          qrCode = generatedQr;
          debugLog("QR Code generated successfully");
          
          connectionStatus = 'qr';
          isConnecting = false;
          broadcast({ type: 'status', status: 'qr', qr: qrCode });
          console.log("[WhatsApp] QR Code broadcasted to all connected clients");
        } catch (e) {
          debugLog("QR Code generation error: " + (e as any).message);
          isConnecting = false;
          connectionStatus = 'disconnected';
          broadcast({ type: 'status', status: 'disconnected', error: 'Falha ao gerar imagem do QR Code' });
        }
      }

      if (connection === 'close') {
        const error = (lastDisconnect?.error as any);
        const statusCode = error?.output?.statusCode;
        const shouldReconnect = !forceDisconnect && (statusCode !== DisconnectReason.loggedOut);
        debugLog(`closed: ${error?.message || error}, reconnecting: ${shouldReconnect}, forceDisconnect: ${forceDisconnect}`);
        console.log('WhatsApp connection closed:', error?.message || error, 'reconnecting:', shouldReconnect);
        
        sock = null;
        qrCode = null;
        isConnecting = false;

        if (shouldReconnect) {
          connectionStatus = 'connecting';
          broadcast({ type: 'status', status: 'connecting' });
          setTimeout(connectToWhatsApp, 3000);
        } else {
          connectionStatus = 'disconnected';
          broadcast({ type: 'status', status: 'disconnected', qr: null, user: null });
          try {
            if (fs.existsSync('wa_auth')) {
              fs.rmSync('wa_auth', { recursive: true, force: true });
            }
          } catch(e) {}
        }
      } else if (connection === 'open') {
        debugLog("connection open");
        console.log('WhatsApp connection opened', sock.user);
        qrCode = null;
        connectionStatus = 'connected';
        isConnecting = false;
        broadcast({ type: 'status', status: 'connected', user: sock.user });
      }
    });

    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }: any) => {
      debugLog(`History Set: ${chats?.length} chats, ${messages?.length} messages`);
      
      // Populate contacts cache
      if (contacts) {
        for (const contact of contacts) {
          if (contact.id) {
            const name = contact.name || contact.verifiedName || contact.notify || contact.pushName;
            if (name) {
              contactsCache[contact.id] = name;
            }
          }
        }
      }

      // Broadcast some recent chats to populate the UI
      if (chats && chats.length > 0) {
        // Filter out groups, broadcasts and statuses. ONLY keep individual chats with a registered saved contact name.
        const filteredChats = chats.filter((chat: any) => {
          const jid = chat.id || '';
          if (!jid.endsWith('@s.whatsapp.net')) return false;
          // Pre-populate contactsCache if chat holds a name
          if (chat.name && !contactsCache[jid]) {
            contactsCache[jid] = chat.name;
          }
          const name = chat.name || contactsCache[chat.id];
          return isRegisteredContact(jid, name);
        });

        // Map chats to include the mapped name from contactsCache
        const enrichedChats = filteredChats.map((chat: any) => {
          const phone = chat.id.split('@')[0];
          const name = chat.name || contactsCache[chat.id];
          return {
            ...chat,
            name: name
          };
        });

        const filteredMessages = (messages || []).filter((msg: any) => {
          const jid = msg.key?.remoteJid || '';
          return jid && jid.endsWith('@s.whatsapp.net') && isRegisteredContact(jid);
        });

        lastHistory = {
          chats: enrichedChats.slice(0, 50),
          messages: filteredMessages.slice(0, 300)
        };
        broadcast({ 
          type: 'history', 
          ...lastHistory
        });
      }
    });

    sock.ev.on('contacts.set', ({ contacts }: any) => {
      if (contacts) {
        for (const contact of contacts) {
          if (contact.id) {
            const name = contact.name || contact.verifiedName || contact.notify || contact.pushName;
            if (name) {
              contactsCache[contact.id] = name;
            }
          }
        }
      }
    });

    sock.ev.on('contacts.upsert', (newContacts: any[]) => {
      for (const contact of newContacts) {
        if (contact.id) {
          const name = contact.name || contact.verifiedName || contact.notify || contact.pushName;
          if (name) {
            contactsCache[contact.id] = name;
          }
        }
      }
    });

    sock.ev.on('contacts.update', (updatedContacts: any[]) => {
      for (const contact of updatedContacts) {
        if (contact.id) {
          const name = contact.name || contact.verifiedName || contact.notify || contact.pushName;
          if (name) {
            contactsCache[contact.id] = name;
          }
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err: any) {
    debugLog("Critical err in connectToWhatsApp: " + err.message);
    console.error("Critical WhatsApp Initialization Error:", err);
    isConnecting = false;
    connectionStatus = 'disconnected';
    broadcast({ type: 'status', status: 'disconnected', error: err.message });
  }

  sock?.ev?.on('messages.upsert', async (m: { messages: WAMessage[], type: MessageUpsertType }) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && msg.message) {
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) {
            continue; // Skip groups and statuses - strictly individual chats
          }
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
          const phone = remoteJid?.split('@')[0] || '';
          const pushName = msg.pushName || '';
          
          if (remoteJid && pushName) {
            contactsCache[remoteJid] = pushName;
          }

          // Skip if this isn't a registered contact with actual name and number
          if (!isRegisteredContact(remoteJid, pushName)) {
            continue;
          }

          if (text) {
            console.log(`Received message from ${remoteJid}: ${text}`);
            broadcast({ type: 'message', role: 'user', content: text, remoteJid });
            saveMessageToHistory(remoteJid!, 'user', text);

            // Ensure lead exists in CRM
            try {
              const ownerInfo = await getGlobalOwnerInfo();
              const supabase = getSupabaseClient();
              if (ownerInfo && supabase) {
                let existingId: string | null = null;
                let currentData: any = null;
                
                const { data: existingList } = await supabase
                  .from('pacientes')
                  .select('*')
                  .eq('telefone', phone)
                  .limit(1);
                
                if (existingList && existingList.length > 0) {
                  existingId = existingList[0].id;
                  currentData = existingList[0];
                }
                
                if (!existingId) {
                  const displayName = contactsCache[remoteJid || ''] || pushName || `+${phone}`;
                  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
                  await supabase
                    .from('pacientes')
                    .insert({
                      id,
                      nome: displayName,
                      telefone: phone,
                      email: '',
                      clinic_id: ownerInfo.clinicId,
                      owner_id: ownerInfo.ownerId,
                      status: 'lead',
                      interested_in: 'Iniciou atendimento WA',
                      last_contact_at: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      source: 'whatsapp_real'
                    });
                  console.log(`New lead created automatically for ${phone} as ${displayName}`);
                } else {
                  const updateData: any = {
                    last_contact_at: new Date().toISOString()
                  };
                  
                  // If current name is just fallback, and we have a rich name now, update it
                  const displayName = contactsCache[remoteJid || ''] || pushName;
                  if (displayName && (!currentData.nome || currentData.nome.startsWith('WhatsApp ') || currentData.nome.startsWith('+'))) {
                    updateData.nome = displayName;
                  }
                  
                  await supabase
                    .from('pacientes')
                    .update(updateData)
                    .eq('id', existingId);
                  console.log(`Updated lead status/timestamp for ${phone}`);
                }
              }
            } catch (crmErr) {
              console.error("CRM Auto-Sync Error:", crmErr);
            }

            // Process with Gemini
            try {
              const aiResponse = await processWhatsAppWithGemini(text, remoteJid!);
              const supabase = getSupabaseClient();
              
              if (aiResponse.text) {
                await sock.sendMessage(remoteJid!, { text: aiResponse.text });
                broadcast({ type: 'message', role: 'assistant', content: aiResponse.text, remoteJid });
                saveMessageToHistory(remoteJid!, 'assistant', aiResponse.text);
              }
              
              if (aiResponse.leadInfo && supabase) {
                broadcast({ type: 'lead_detected', leadInfo: aiResponse.leadInfo, remoteJid });
                
                // Update lead with Gemini extracted info
                if (phone) {
                  const { data: existingList } = await supabase
                    .from('pacientes')
                    .select('*')
                    .eq('telefone', phone)
                    .limit(1);
                    
                  if (existingList && existingList.length > 0) {
                    const existingPatient = existingList[0];
                    const { name, email, interestedIn } = aiResponse.leadInfo;
                    const updateData: any = {};
                    if (name) {
                      updateData.nome = name;
                    }
                    if (email) updateData.email = email;
                    if (interestedIn) updateData.interested_in = interestedIn;
                    
                    if (Object.keys(updateData).length > 0) {
                      await supabase
                        .from('pacientes')
                        .update(updateData)
                        .eq('id', existingPatient.id);
                      console.log(`Lead ${phone} enriched with AI data`);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Gemini Error:", err);
            }
          }
        }
      }
    }
  });
}

async function processWhatsAppWithGemini(message: string, remoteJid: string) {
  const leadDetectionTool = {
    name: "update_lead_info",
    description: "Detects and updates patient/lead information gathered during conversation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Patient name" },
        phone: { type: Type.STRING, description: "Patient phone number" },
        email: { type: Type.STRING, description: "Patient email" },
        interestedIn: { type: Type.STRING, description: "What the patient is interested in (cleaning, braces, etc.)" }
      }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: `Você é um assistente profissional e amigável de uma clínica odontológica chamado 'OdontoAI'. 
        Seu objetivo é atender pacientes pelo WhatsApp, tirar dúvidas e converter leads para o funil de vendas (CRM).
        O ID do chat atual é: ${remoteJid}. O telefone do usuário é derivado deste ID.
        Sempre tente descobrir o nome do paciente se ainda não souber.
        Se o paciente demonstrar interesse real em um procedimento ou quiser agendar, use a função 'update_lead_info' para capturar os dados.
        Responda em Português (pt-BR).`,
        tools: [{ functionDeclarations: [leadDetectionTool] }]
      }
    });

    return {
      text: response.text,
      leadInfo: response.functionCalls?.find(f => f.name === 'update_lead_info')?.args 
    };
  } catch (error: any) {
    console.error("WhatsApp Gemini generation failed, using intelligent backup dialogue:", error.message);
    
    // Simple deterministic chatbot backup matching dental contexts for demo ease
    let replyText = "Olá, tudo bem? Me chamo OdontoAI, o assistente virtual da clínica! Estou passando por uma otimização rápida em meu servidor de nuvem. Como posso ajudar você hoje com agendamentos ou dúvidas clínicas?";
    let simulatedLead: any = null;
    
    const msgLower = (message || "").toLowerCase();
    if (msgLower.includes("implante") || msgLower.includes("dente") || msgLower.includes("dentadura")) {
      replyText = "Excelente! Nós somos especialistas em implantes dentários guiados por computador (totalmente indolor). Gostaria de agendar uma avaliação cortesia para planejar seu novo sorriso?";
      simulatedLead = { interestedIn: "Implantes" };
    } else if (msgLower.includes("aparelho") || msgLower.includes("invisivel") || msgLower.includes("alinhador") || msgLower.includes("estet") || msgLower.includes("orto")) {
      replyText = "Ah, perfeito! Trabalhamos com os Alinhadores Estéticos Invisíveis de última tecnologia, que alinham seus dentes de forma super rápida e discreta. Deseja realizar uma scan 3D de simulação na clínica?";
      simulatedLead = { interestedIn: "Alinhadores" };
    } else if (msgLower.includes("clarem") || msgLower.includes("branco") || msgLower.includes("limp")) {
      replyText = "Perfeito! No momento estamos com condições excelentes para Clareamento Dental a laser e raspagem preventiva. Qual seria o melhor dia da semana (segunda a sexta) para seu atendimento?";
      simulatedLead = { interestedIn: "Clareamento" };
    } else if (msgLower.includes("agend") || msgLower.includes("consulta") || msgLower.includes("marcar")) {
      replyText = "Claro! Para podermos agilizar o seu agendamento de consulta na clínica, você prefere o período da manhã ou da tarde?";
    } else if (msgLower.includes("preço") || msgLower.includes("valor") || msgLower.includes("quanto")) {
      replyText = "Para orçamentos precisos, nossos doutores precisam analisar o seu caso pessoalmente através de um checkup digital simples. Agendando hoje, conseguimos uma condição especial de parcelamento. Qual é o seu nome completo para eu iniciar a sua reserva?";
    }
    
    return {
      text: replyText,
      leadInfo: simulatedLead
    };
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WS client connected');
  ws.send(JSON.stringify({ type: 'status', status: connectionStatus, qr: qrCode }));
  
  if (lastHistory) {
    const enrichedChats = (lastHistory.chats || []).map((chat: any) => {
      const phone = chat.id.split('@')[0];
      const cachedName = contactsCache[chat.id];
      const currentName = chat.name || '';
      const name = (cachedName && (!currentName || currentName.startsWith('+') || currentName.startsWith('WhatsApp')))
        ? cachedName 
        : currentName || `+${phone}`;
      return { ...chat, name };
    });
    ws.send(JSON.stringify({ 
      type: 'history', 
      chats: enrichedChats, 
      messages: lastHistory.messages 
    }));
  }
  
  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'send_message' && sock && connectionStatus === 'connected') {
        const { remoteJid, text } = parsed;
        await sock.sendMessage(remoteJid, { text });
        broadcast({ type: 'message', role: 'assistant', content: text, remoteJid });
        saveMessageToHistory(remoteJid, 'assistant', text);
      }
    } catch (err) {
      console.error("WS Message Error:", err);
    }
  });
});

// API Routes

// Health check
app.get("/api/wa-status", (req, res) => {
  let enrichedHistory = null;
  if (lastHistory) {
    const enrichedChats = (lastHistory.chats || []).map((chat: any) => {
      const phone = chat.id.split('@')[0];
      const cachedName = contactsCache[chat.id];
      const currentName = chat.name || '';
      const name = (cachedName && (!currentName || currentName.startsWith('+') || currentName.startsWith('WhatsApp')))
        ? cachedName 
        : currentName || `+${phone}`;
      return { ...chat, name };
    });
    enrichedHistory = {
      ...lastHistory,
      chats: enrichedChats
    };
  }

  res.json({
    type: 'status',
    status: connectionStatus,
    user: sock?.user,
    qr: qrCode,
    hasHistory: !!lastHistory,
    history: enrichedHistory || lastHistory
  });
});

app.post("/api/wa-connect", async (req, res) => {
  debugLog("Explicit connection start requested via /api/wa-connect");
  
  // If force flag is present or we are in a likely stuck state, reset everything
  if (req.body?.force || (isConnecting && connectionStatus === 'connecting')) {
    debugLog("Forcing connection reset as requested or detecting stuck state");
    isConnecting = false;
    qrCode = null;
    connectionStatus = 'disconnected';
    if (sock) {
      try { sock.ws?.close(); sock.end(undefined); } catch(e) {}
      sock = null;
    }
  }

  if (sock && connectionStatus === 'connected') {
    return res.json({ success: true, message: 'Já conectado' });
  }
  
  connectToWhatsApp().then(() => {
    res.json({ success: true });
  }).catch((err) => {
    debugLog("wa-connect error: " + err.message);
    res.status(500).json({ error: err.message });
  });
});

app.post("/api/wa-disconnect", async (req, res) => {
  debugLog("Explicit logout requested via /api/wa-disconnect");
  forceDisconnect = true;
  lastHistory = null;
  qrCode = null;
  connectionStatus = 'disconnected';
  isConnecting = false;

  const currentSock = sock;
  sock = null; // Detach immediately to prevent race conditions during async logout

  const finalizeCleanup = () => {
    try {
      if (fs.existsSync('wa_auth')) {
        fs.rmSync('wa_auth', { recursive: true, force: true });
        debugLog("wa_auth directory deleted successfully");
      }
    } catch(e: any) {
      debugLog("Failed to delete wa_auth: " + e.message);
    }
    broadcast({ type: 'status', status: 'disconnected', qr: null, user: null });
  };

  if (currentSock) {
    try {
      debugLog("Attempting graceful WhatsApp logout...");
      // Try logout with timeout
      await Promise.race([
        currentSock.logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000))
      ]);
      debugLog("WhatsApp logout successful");
    } catch (e: any) {
      debugLog("Logout failed or timed out: " + e.message);
      // If logout fails, try to end socket forcefully
      try {
        if (currentSock.ws) currentSock.ws.terminate();
        currentSock.end(undefined);
      } catch (endErr) {}
    }
  }

  finalizeCleanup();
  res.json({ success: true });
});

app.post("/api/wa-reset", (req, res) => {
  debugLog("Reset/Refresh QR Code requested via /api/wa-reset");
  forceDisconnect = true;
  lastHistory = null;
  qrCode = null;
  connectionStatus = 'disconnected';
  isConnecting = false;

  const cleanupAndReconnect = () => {
    try {
      if (fs.existsSync('wa_auth')) {
        fs.rmSync('wa_auth', { recursive: true, force: true });
        debugLog("wa_auth deleted successfully on explicit reset");
      }
    } catch(e: any) {
      debugLog("Failed to delete wa_auth on explicit reset: " + e.message);
    }
    sock = null;
    broadcast({ type: 'status', status: 'disconnected', qr: null, user: null });
    connectToWhatsApp();
  };

  if (sock) {
    try {
      sock.logout().then(() => {
        try { sock.end(undefined); } catch(e) {}
        cleanupAndReconnect();
      }).catch((e: any) => {
        debugLog("sock.logout error in reset: " + e.message);
        try { sock.end(undefined); } catch(err) {}
        cleanupAndReconnect();
      });
    } catch(e) {
      try { sock.end(undefined); } catch(err) {}
      cleanupAndReconnect();
    }
    
    // Safety fallback: force clear and reconnect after 2.5s if not executed yet
    setTimeout(() => {
      if (sock || fs.existsSync('wa_auth')) {
        cleanupAndReconnect();
      }
    }, 2500);
  } else {
    cleanupAndReconnect();
  }

  res.json({ success: true });
});

app.post("/api/wa-send", async (req, res) => {
  const { phone, text } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ error: "Telefone e texto são obrigatórios." });
  }

  // Clear non-digits to format correctly
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) {
    return res.status(400).json({ error: "Telefone inválido." });
  }

  // standard Brazilian or international format
  const remoteJid = `${cleanPhone}@s.whatsapp.net`;

  try {
    if (sock && connectionStatus === 'connected') {
      await sock.sendMessage(remoteJid, { text });
      broadcast({ type: 'message', role: 'assistant', content: text, remoteJid });
      saveMessageToHistory(remoteJid, 'assistant', text);
      return res.json({ success: true, simulated: false, status: connectionStatus, message: "Mensagem enviada com sucesso no WhatsApp real!" });
    } else {
      // Simulate by adding to simulator history
      saveMessageToHistory(remoteJid, 'assistant', text);
      // Broadcast simulated message so any listening screens (like simulator tabs) update instantly
      broadcast({ type: 'message', role: 'assistant', content: text, remoteJid });
      return res.json({ 
        success: true, 
        simulated: true, 
        status: connectionStatus,
        message: "Canal em modo simulação. Mensagem simulada enviada com sucesso ao chat do paciente!" 
      });
    }
  } catch (err: any) {
    console.error("Erro ao enviar mensagem via /api/wa-send:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao processar mensagem do WhatsApp." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Gemini endpoint for the WhatsApp Assistant simulator (fallback UI)
app.post("/api/assistant/chat", async (req, res) => {
  try {
    const { message, audio, history } = req.body;
    
    const aiResponse = await processWhatsAppWithGemini(message || "Audio analysis requested", "simulator");
    
    // TTS for simulator
    let audioResponse = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: aiResponse.text || "Como posso ajudar?" }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      audioResponse = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (ttsError) {
      console.warn("TTS Error (ignoring):", ttsError);
    }

    res.json({ 
      text: aiResponse.text, 
      audio: audioResponse,
      leadInfo: aiResponse.leadInfo
    });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Google Calendar Integration
app.get("/api/calendar/events", async (req, res) => {
  try {
    const accessToken = req.query.accessToken as string;
    if (!accessToken) return res.status(401).json({ error: "Missing access token" });

    if (accessToken === 'demo-token') {
      return res.json([]);
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    // Get events from the primary calendar for the last 30 days and next 30 days
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    let calendarName = "Agenda Principal (Google)";
    try {
      const calInfo = await calendar.calendars.get({ calendarId: "primary" });
      if (calInfo.data && calInfo.data.summary) {
        calendarName = calInfo.data.summary;
      }
    } catch (e) {
      console.warn("Falha ao obter info do calendário principal, usando padrão:", e);
    }

    const items = response.data.items || [];
    const mappedItems = items.map((item: any) => ({
      ...item,
      calendarName: calendarName
    }));

    res.json(mappedItems);
  } catch (error: any) {
    console.error("Calendar Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/calendar/events", async (req, res) => {
  try {
    const { accessToken, event } = req.body;
    if (!accessToken) return res.status(401).json({ error: "Missing access token" });

    if (accessToken === 'demo-token') {
      return res.json({ id: "demo-created-" + Math.random().toString(36).substr(2, 9), ...event });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    res.json(response.data);
  } catch (error: any) {
    console.error("Calendar Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/calendar/events", async (req, res) => {
  try {
    const { accessToken, eventId } = req.body;
    if (!accessToken) return res.status(401).json({ error: "Missing access token" });
    if (!eventId) return res.status(400).json({ error: "Missing eventId" });

    if (accessToken === 'demo-token') {
      return res.json({ success: true, message: "Demo event deleted successfully" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error: any) {
    console.error("Calendar Delete Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to route prompt generation to selected AI client
async function generateWithProvider(providerId: string, apiKey: string, preferredModel: string, prompt: string, customUrl?: string): Promise<string> {
  const model = preferredModel || "";
  
  if (providerId === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const resJson: any = await response.json();
    if (resJson.error) {
      throw new Error(`Erro na API do OpenAI: ${resJson.error.message}`);
    }
    return resJson.choices[0].message.content;
  }
  
  if (providerId === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-3-5-sonnet-latest",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const resJson: any = await response.json();
    if (resJson.error) {
      throw new Error(`Erro na API do Anthropic: ${resJson.error.message}`);
    }
    return resJson.content[0].text;
  }
  
  if (providerId === "deepseek_api") {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const resJson: any = await response.json();
    if (resJson.error) {
      throw new Error(`Erro na API do DeepSeek: ${resJson.error.message}`);
    }
    return resJson.choices[0].message.content;
  }

  if (providerId === "perplexity_api") {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "sonar",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const resJson: any = await response.json();
    if (resJson.error) {
      throw new Error(`Erro na API do Perplexity: ${resJson.error.message}`);
    }
    return resJson.choices[0].message.content;
  }

  if (providerId === "ollama") {
    let baseUrl = (customUrl || "").trim() || "http://localhost:11434";
    
    // Check for invalid script commands, spaces, or absolute invalid strings as baseUrl
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      if (baseUrl.includes(" ") || baseUrl.includes("|") || baseUrl.length > 50 || !baseUrl) {
        baseUrl = "http://localhost:11434";
      } else {
        baseUrl = `http://${baseUrl}`;
      }
    }

    // Remove trailing slashes
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const finalUrl = baseUrl.includes("/api/generate") ? baseUrl : `${baseUrl}/api/generate`;

    try {
      const response = await fetch(finalUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: model || "llama3:8b",
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      const resJson: any = await response.json();
      return resJson.response;
    } catch (e: any) {
      console.warn("Ollama online fallback to Gemini 3.5 Flash:", e.message);
      
      const interaction = await ai.interactions.create({
        model: "gemini-3.5-flash",
        input: prompt
      });
      
      return `> 🔮 **Fronteira de Contingência Online Ativada (Ollama Off-line)**: O seu servidor Ollama em \`${baseUrl}\` está off-line no momento (${e.message}). Para garantir que a sua clínica nunca pare, o Front Odonto AI utilizou nossa **Conexão em Nuvem de Alto Desempenho (Gemini Online)** para criar esta peça publicitária com precisão absoluta.

---

${interaction.output_text}`;
    }
  }

  if (providerId === "gemini_flash" || providerId === "gemini_pro" || providerId === "huggingface_spaces") {
    const geminiModel = providerId === "gemini_pro" ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";
    const interaction = await ai.interactions.create({
      model: geminiModel,
      input: prompt
    });
    return interaction.output_text;
  }

  throw new Error(`Provedor de IA "${providerId}" não é suportado pelo nosso roteador de API.`);
}

function generateMockAd(target: string, clinicInfo: any, platform: string, tone: string, creativeType: string, errorDetail: string, count: number = 1, selectedImageAI?: string, selectedVideoAI?: string): string {
  const clinicName = clinicInfo?.name || "Front Odonto AI Clinic";
  const clinicPhone = clinicInfo?.phone || "+55 21 99999-9999";
  const clinicAddress = clinicInfo?.address || "Centro, Rio de Janeiro - RJ";
  const toneLabel = tone || "Emocionante e Persuasivo";
  const platformName = platform === "google" ? "Google Ads" : platform === "tiktok" ? "TikTok Ads" : "Instagram & Facebook Ads";
  
  const targetLower = (target || "").toLowerCase();
  
  let specialtyLabel = "Tratamento Odontológico Elegante";
  if (targetLower.includes("implante") || targetLower.includes("dente") || targetLower.includes("perda") || targetLower.includes("mastig")) {
    specialtyLabel = "Implantes Dentários de Última Geração";
  } else if (targetLower.includes("alinhador") || targetLower.includes("aparelho") || targetLower.includes("invis") || targetLower.includes("estét")) {
    specialtyLabel = "Alinhadores Estéticos Invisíveis";
  } else if (targetLower.includes("clare") || targetLower.includes("branc") || targetLower.includes("manch")) {
    specialtyLabel = "Clareamento Dental Personalizado";
  } else if (targetLower.includes("lent") || targetLower.includes("facet") || targetLower.includes("resina")) {
    specialtyLabel = "Lentes de Contato e Facetas";
  }

  // AI names for display
  const imageAiNames: Record<string, string> = {
    midjourney_api: 'Midjourney v6 API (Paga)',
    dalle3: 'OpenAI DALL-E 3 (Paga)',
    stable_diffusion_ultra: 'Stability AI Stable Diffusion Ultra (Paga)',
    adobe_firefly: 'Adobe Firefly Image v3 (Paga)',
    flux_schnell: 'FLUX.1 [schnell] (Grátis / Open-Source)',
    stable_diffusion_3: 'Stable Diffusion 3 (Grátis / Hugging Face Spaces)',
    pollinations_image: 'Pollinations AI (Grátis / Open-API)',
    craiyon_v3: 'Craiyon V3 (Grátis)'
  };

  const videoAiNames: Record<string, string> = {
    openai_sora: 'OpenAI Sora (Paga)',
    runway_gen3: 'Runway Gen-3 Alpha (Paga)',
    luma_dream: 'Luma Dream Machine (Paga)',
    kling_ai: 'Kling AI Premium (Paga)',
    hunyuan_video: 'Tencent Hunyuan Open Video (Grátis / Spaces)',
    mochi1: 'Mochi 1 High-Motion (Grátis / Open-Source)',
    stable_video_diffusion: 'Stable Video Diffusion (Grátis / Space)',
    open_sora: 'Open-Sora (Grátis)'
  };

  const imgAiLabel = imageAiNames[selectedImageAI || 'midjourney_api'] || 'Midjourney v6 API';
  const vidAiLabel = videoAiNames[selectedVideoAI || 'runway_gen3'] || 'Runway Gen-3 Alpha';

  let result = "";

  for (let idx = 1; idx <= count; idx++) {
    let hook = "";
    let description = "";
    let visualConcept = "";
    let script = "";
    let hashtags = "";

    if (specialtyLabel === "Implantes Dentários de Última Geração") {
      const hooksList = [
        "Não deixe a perda de dentes tirar seu prazer de comer e sorrir com segurança.",
        "Recupere dentes fixos em poucos dias com cirurgia guiada por computador de alta estabilidade.",
        "Troque sua dentadura móvel por uma Prótese Protocolo Fixa ultra-confortável.",
        "Volte a mastigar o que você mais gosta sem dores, desconforto ou vergonha de sorrir.",
        "Tecnologia Digital Odontológica: Implantes de titânio rápidos e previsíveis.",
        "Dê adeus à insegurança e sinta firmeza ao falar e sorrir em público.",
        "Tratamento humanizado sob sedação consciente para quem tem medo de dentista.",
        "Planejamento 3D personalizado: veja o resultado ideal antes do procedimento.",
        "Saúde bucal integrada para adultos que buscam mais qualidade de vida e digestão.",
        "Condições facilitadas de parcelamento direto para o seu tratamento de implante."
      ];
      hook = hooksList[(idx - 1) % hooksList.length];
      
      description = `Querido paciente, você sabia que a perda de um dente altera a mastigação e pode acelerar o envelhecimento facial? Aqui na ${clinicName}, nós usamos tecnologia guiada de última geração para devolver a estabilidade do seu sorriso sem sofrimento. Agende agora seu check-up digital!`;
      
      visualConcept = `Prompt de Mídia Estética (Otimizado para ${imgAiLabel}):
- [TRATAMENTO / ESPECIALIDADE]: Implantes Dentários de Última Geração (Reabilitação de Saúde Oral).
- [GATILHO E DIFERENCIAL CLÍNICO]: Recuperação da mastigação firme com dentes fixos, implantes de altíssima segurança e cirurgia guiada computadorizada sem dor.
- [RECORTE DE PÚBLICO-ALVO]: Paciente maduro sofisticado (50+ anos, homem ou mulher) demonstrando vitalidade rejuvenescida e sorrindo com confiança espontânea ao lado de entes queridos.
- [ABORDAGEM / ESTILO VISUAL]: Close fotorrealista de alto impacto com dentes perfeitamente esculpidos e naturais. Renderização com nitidez fotorrealista extrema, iluminação natural calorosa e dourada (golden hour), profundidade de campo rasa desfocando com elegância o consultório odontológico premium ao fundo, nível cinematográfico 8K. (Opção de Teste ${idx})`;
      
      script = `Roteiro do Vídeo (Reels/Shorts Ads) - 30s (Otimizado para ${vidAiLabel} - Opção ${idx}):
• [ESPECIALIDADE & ABORDAGEM]: Roteiro estruturado focado em Autoestima e Conforto por Reabilitação Oral Segura. Estilo cinematográfico com cortes sutis e visual limpo.
• [PÚBLICO-ALVO]: Paciente maduro e profissionais liberais buscando conforto na mastigação e convívio social livre de vergonha.
• [DIRETRIZ DE GRAVAÇÃO]:
  0-3s: (Gancho / Gatilho) Close no rosto de uma pessoa madura que tenta tímida e sutilmente cobrir a boca ao rir. "A vergonha de sorrir ou o desconforto ao mastigar estão prendendo sua liberdade de ser você mesmo?"
  4-12s: (Diferencial Tecnológico) Close em Dr(a). acolhedor mostrando planejamento 3D interativo do tratamento na tela. "Na ${clinicName}, nós usamos tecnologia guiada computadorizada para planejar e devolver o seu dente fixo sem dor ou traumas cirúrgicos."
  13-20s: (Benefício Percebido) Close do paciente sorrindo livremente enquanto saboreia uma boa refeição em família. "Segurança absoluta para comer o que ama com um sorriso totalmente firme e feliz."
  21-30s: (CTA Forte) Apresentação do logo moderno com dados de contato. "Clique em 'Saiba Mais' agora e inicie uma conversa com nossa equipe no WhatsApp."`;
      hashtags = "#implante #odontologiadigital #sorrisoperfeito #reabilitacao #clinicaodontologica";
    } 
    else if (specialtyLabel === "Alinhadores Estéticos Invisíveis") {
      const hooksList = [
        "Alinhe seus dentes de forma 100% invisível, higiênica e sem metais machucando seu lábio.",
        "O aparelho ortodôntico ultra moderno que ninguém percebe que você está usando.",
        "Escaneamento 3D Iterativo: Veja a evolução do seu sorriso direto na tela na primeira consulta.",
        "Liberdade total para comer o que quiser e higienizar seus dentes sem incômodos.",
        "Resultados até 2x mais rápidos que os aparelhos convencionais de ferro.",
        "Perfeito para profissionais liberais, palestrantes e jovens que prezam pela imagem.",
        "Praticidade absoluta: retire os alinhadores para festas, reuniões e eventos especiais.",
        "Tecnologia de ponta a favor do seu alinhamento dental com planejamento digital.",
        "Seu sorriso renovado de maneira confortável e imperceptível no dia a dia.",
        "Facilidades exclusivas no check-up ortodôntico digital este mês."
      ];
      hook = hooksList[(idx - 1) % hooksList.length];

      description = `Esqueça pecinhas metálicas machucando sua boca e fios soltos. Os alinhadores invisíveis são placas higiênicas e transparentes sob medida para alinhar seus dentes com rapidez e total descrição. Faça uma simulação 3D grátis na ${clinicName}!`;
      
      visualConcept = `Prompt de Mídia Estética (Otimizado para ${imgAiLabel}):
- [TRATAMENTO / ESPECIALIDADE]: Aparelhos Ortodônticos Estéticos Invisíveis na Odontologia Digital.
- [GATILHO E DIFERENCIAL CLÍNICO]: Alinhamento invisível e higiênico sem pecinhas metálicas cortando a boca, com planejamento interativo digital previsível em escaneamento 3D.
- [RECORTE DE PÚBLICO-ALVO]: Jovem executivo ou influenciador profissional (25-45 anos, vestindo roupas de design fino) sorrindo radiantemente em um ambiente moderno de escritório ou palestra de alto nível.
- [ABORDAGEM / ESTILO VISUAL]: Close-up corporativo elegante e limpo. A pessoa sorri iluminada por luzes de estúdio suaves, segurando com as pontas dos dedos o alinhador transparente limpo e brilhante. Paleta em tom azul clínico sutil e cinza moderno, enquadramento focado, alta definição 8K. (Opção de Teste ${idx})`;
      
      script = `Roteiro do Vídeo (Reels/Stories Ads) - 15s (Otimizado para ${vidAiLabel} - Opção ${idx}):
• [ESPECIALIDADE & ABORDAGEM]: Ortodontia Digital Invisível. Vídeo focado em agilidade, estilo de vida dinâmico, moderno e elegante.
• [PÚBLICO-ALVO]: Jovens profissionais, palestrantes e pessoas preocupadas com a imagem pessoal no trabalho e convívio social.
• [DIRETRIZ DE GRAVAÇÃO]:
  0-3s: (Gancho / Gatilho) Close rápido em uma pessoa retirando delicadamente um alinhador transparente perfeito para tomar seu café de manhã. "O alinhador ortodôntico invisível que se adapta à sua vida, no seu tempo."
  4-10s: (Diferencial Tecnológico) Transição fluida de dentes desalinhados para alinhados na tela digital. "Planejamento 3D inteligente que mostra todo o seu resultado antes mesmo de começar."
  11-15s: (CTA Imediato) Jovem sorrindo amplamente e guardando as plaquinhas na caixinha premium. "Fale no WhatsApp para fazer uma simulação 3D grátis!"`;
      hashtags = "#alinhadoresinvisiveis #ortodontiadigital #invisalign #esteticadental #autoestima";
    }
    else if (specialtyLabel === "Clareamento Dental Personalizado") {
      const hooksList = [
        "Dentes até 4 tons mais brancos com procedimento seguro, rápido e com proteção de esmalte.",
        "Remova manchas amarelas causadas por café ou tempo e resgate o brilho natural do sorriso.",
        "Clareamento personalizado conduzido por especialistas para evitar hipersensibilidade.",
        "Transforme a cor do seu sorriso para noivados, formaturas, entrevistas ou festas.",
        "Cuidado clínico real com géis importados de máxima eficácia e barreira de proteção.",
        "Esqueça receitas milagrosas e perigosas da web. Cuide da saúde do seu sorriso.",
        "Destaque-se com um sorriso limpo, jovial, radiante e altamente confiante.",
        "Procedimento rápido em consultório com resultados visíveis na primeira sessão.",
        "Melhor custo-benefício de estética facial: clareamento dental sob medida.",
        "Agende seu clareamento a laser e ganhe um kit de manutenção preventiva."
      ];
      hook = hooksList[(idx - 1) % hooksList.length];

      description = `Um sorriso brilhante abre portas para novas oportunidades e eleva sua autoconfiança instantaneamente. Na ${clinicName}, oferecemos clareamento profissional personalizado de última geração, garantindo dentes incrivelmente brancos e protegendo o seu esmalte de forma 100% segura.`;
      
      visualConcept = `Prompt de Mídia Estética (Otimizado para ${imgAiLabel}):
- [TRATAMENTO / ESPECIALIDADE]: Clareamento Dental Clínico Conduzido por Especialistas.
- [GATILHO E DIFERENCIAL CLÍNICO]: Sorriso limpo e dentes até 4 tons mais brancos com gel importado de alta eficácia e barreira ultra-protetora contra sensibilidade na primeira aplicação.
- [RECORTE DE PÚBLICO-ALVO]: Homem ou mulher jovem-adulto (25-35 anos, bem vestido em preparação para entrevista importante ou casamento) exibindo dentes brancos ultra-luminosos de felicidade.
- [ABORDAGEM / ESTILO VISUAL]: Close-up fotográfico lateral estético de lábios sorrindo. O sorriso projeta dentes saudáveis e radiantes. Iluminação intensa de foco ring-light, paleta de cores contemporânea realçada com azul cobalto e cinza claro, fundo clínico sutil, fotorrealismo brilhante 8K. (Opção de Teste ${idx})`;
      
      script = `Roteiro do Vídeo (Reels/Instagram Ads) - 20s (Otimizado para ${vidAiLabel} - Opção ${idx}):
• [ESPECIALIDADE & ABORDAGEM]: Estática de Sorriso Flash / Clareamento Supervisionado. Estilo rápido e focado em estética.
• [PÚBLICO-ALVO]: Pacientes insatisfeitos com dentes amarelos devido a hábitos diários, cafezinho ou cor natural do tempo.
• [DIRETRIZ DE GRAVAÇÃO]:
  0-4s: (Gatilho da Dor) Pessoa desanimada olhando dentes amarelados de café no copo, cortando rápido para sorriso limpo. "Seu sorriso está amarelado de café ou refrigerante? Descubra o método sem dor."
  5-12s: (Autoridade / Diferencial) Dr(a). pincelando gel protetor confortável na cabine elegante. "Nosso clareamento profissional protege o esmalte dente a dente, devolvendo o brilho natural em sessões rápidas."
  13-20s: (CTA Final) Paciente vibrante rindo para a câmera com dentes brancos lindos. "Toque no link abaixo e resgate um sorriso iluminado com nossa avaliação especial!"`;
      hashtags = "#clareamentodental #esteticabucal #dentesbrancos #sorrisolindo #autoestima";
    }
    else {
      const hooksList = [
        "Transforme dentes quebrados, desalinhados ou amarelados com Lentes de Contato de porcelana.",
        "Sorriso de artista com facetas de porcelana ultrafinas e naturais em poucas visitas.",
        "Corrija imperfeições e gaps (diastemas) de forma permanente com facetas de resina.",
        "Sorriso harmonioso guiado por design digital facial integrado.",
        "Rejuvenescimento do terço inferior da face através de lentes estéticas.",
        "Máxima precisão com facetas esculpidas que preservam sua estrutura dentária natural.",
        "O segredo das celebridades agora acessível com condições incríveis na nossa clínica.",
        "Tecnologia de lentes de contato para remover o formato dos seus dentes sem dor.",
        "Harmonização do sorriso de forma rápida, higiênica e de altíssima durabilidade.",
        "Garanta sua pré-avaliação estética esta semana e simule seu novo visual com scan 3D."
      ];
      hook = hooksList[(idx - 1) % hooksList.length];

      description = `As Lentes de Contato Odontológicas de porcelana são facetas ultrafinas que corrigem imperfeições de formato, lacunas e coloração permanente, devolvendo a simetria ao seu rosto. Planeje seu novo visual com a equipe de especialistas da ${clinicName}!`;
      
      visualConcept = `Prompt de Mídia Estética (Otimizado para ${imgAiLabel}):
- [TRATAMENTO / ESPECIALIDADE]: Facetas e Lentes de Contato de Porcelana Ultrafinas de Luxo.
- [GATILHO E DIFERENCIAL CLÍNICO]: Alinhamento estético perfeito, harmonização permanente dos dentes de aparência "porcelana de artista" em pouquíssimas consultas através de design facial integrado.
- [RECORTE DE PÚBLICO-ALVO]: Homem ou mulher maduro sofisticado (30-45 anos, empresário, médico ou executivo corporativo) exalando elegância, requinte e rejuvenescimento facial.
- [ABORDAGEM / ESTILO VISUAL]: Super macro fotorrealismo capturando as texturas translúcidas delicadas das lentes de porcelana sobre os dentes. Luz difusa lateral suave iluminando o rosto, tons de areia chic, cinza e off-white, profundidade de campo cinematográfica, 8K. (Opção de Teste ${idx})`;
      
      script = `Roteiro do Vídeo (TikTok/Reels Ads) - 30s (Otimizado para ${vidAiLabel} - Opção ${idx}):
• [ESPECIALIDADE & ABORDAGEM]: Odontologia Estética Reconstrutiva digital / Lentes & Facetas de Porcelana. Abordagem empática de rejuvenescimento facial completo.
• [PÚBLICO-ALVO]: Adultos decididos a investir na própria imagem, feições de liderança e estética duradoura.
• [DIRETRIZ DE GRAVAÇÃO]:
  0-3s: (Gancho Emocional) Close em uma pessoa olhando seu sorriso perfeito restaurado e brilhante de satisfação. "O dia em que descobri que mudar o meu sorriso mudaria toda a minha presença pessoal de liderança."
  4-15s: (Diferencial de Clinica) Dr(a). mostrando com muito cuidado as lentes ultrafinas com espessura de casca de ovo. "Lentes de porcelana digitais de durabilidade fantástica de até 15 anos para corrigir gaps e manchas de forma definitiva e sem desgastes invasivos."
  16-25s: (Transformação) Paciente se olhando no espelho e sorrindo com os olhos marejados de conquistas. "Minha autoestima foi totalmente esculpida à mão."
  26-30s: (CTA Rápido) Indicação de botão virtual de Whatsapp em tela refinada com o logo da clínica. "Toque no link e faça hoje sua simulação digital personalizada!"`;
      hashtags = "#lentesdecontatodental #facetasdeporcelana #sorrisonovo #odontologiaestetica #odontologiadigital";
    }

    result += `=== VARIAÇÃO ${idx} ===

### 🏛️ Campanha: **${specialtyLabel} (Rascunho Opção ${idx})**
*Desenvolvido sob o motor criativo simulado: **${creativeType === 'image' ? imgAiLabel : creativeType === 'video' ? vidAiLabel : 'Modelo de Texto Avançado'}***.
* **Plataforma:** Adesão recomendada para **${platformName}**.
* **Tom de Voz:** ${toneLabel}

---

#### 🎯 Copywriting Principal do Anúncio:
* **Título Magnético (Headline):** **${hook}** 🦷
* **Texto de Legenda do Post:**
  "${description}

  📍 Atendemos com exclusividade em: ${clinicAddress}
  👇 Clique abaixo para falar direto com nossa equipe de especialistas:"

* **Chamada de Ação Final (CTA):** 📲 **Clique em "Saiba Mais" e tire suas dúvidas no WhatsApp: ${clinicPhone}**

---

#### 📸 Diretriz Estética e Visual:
> \`${visualConcept}\`

* **Instruções Complementares:** 
  * Dedicar extremo realismo e naturalidade à tonalidade dos dentes (evitar brancos de gesso artificiais ou canais superexpostos).
  * Cores de realce sugeridas: Azul Cobalto, Cinza Fino, Areia Chic e Branco Clínico Iluminado.

---

#### 🎬 Estrutura Recomendada:
${creativeType === 'video' ? script : `* **Carrossel Estético Recomendado (Imagens Dinâmicas de Alta Conversão):**
  * **Tela 1:** Gancho Emocional / Situação real focando no "Desejo de Mudança / Impedimento Social".
  * **Tela 2:** Apresentação da Solução Tecnológica digital (escaneamento, design virtual do sorriso) oferecida pela ${clinicName}.
  * **Tela 3:** Prova Social / Depoimento do conforto do procedimento e de um tratamento rápido.
  * **Tela 4:** CTA claro com foco em agendamento imediato de consulta pelo WhatsApp.`}

---

#### 🏷️ Tags e Palavras-chave de Distribuição:
${hashtags}

`;
  }

  return `> 🔮 **Modo de Assistência Estética Ativado (Demonstração Inteligente)** 
> Para garantir que a sua clínica nunca pare devido a limitações de conexões API (${errorDetail || "Cota ou Créditos Depletados"}), o Front Odonto AI acionou sua **Fronteira de Contingência Local**. Nós geramos **${count} variações estratégicas** com base no tom **${toneLabel}** e no público-alvo **"${target}"**! Os criativos foram otimizados especialmente para os motores **${creativeType === 'image' ? imgAiLabel : creativeType === 'video' ? vidAiLabel : 'Configuração de Texto'}**!

---

` + result + `💡 *Dica de Suporte: Caso deseje reatar conexões diretas na nuvem, você pode ajustar suas credenciais de IA ou mudar o modelo na aba **"Conexão AI"** ou no painel de Configurações.*`;
}

// Ad Generation
app.post("/api/ads/generate", async (req, res) => {
  const { target, clinicInfo, platform, tone, creativeType, selectedAI, selectedImageAI, selectedVideoAI, count = 1 } = req.body;
  
  try {
    let platformContext = "";
    
    // AI names for display in instructions
    const imageAiNames: Record<string, string> = {
      midjourney_api: 'Midjourney v6 API (Paga) - famosa pela estética fotorrealista dramática profunda de estúdio',
      dalle3: 'OpenAI DALL-E 3 (Paga) - famosa pela precisão de detalhes textuais, semântica minuciosa e consistência',
      stable_diffusion_ultra: 'Stability AI Stable Diffusion Ultra (Paga) - famosa pelo realismo focado em peles, texturas anatômicas e fotorrealismo ultra sofisticado',
      adobe_firefly: 'Adobe Firefly Image v3 (Paga) - famosa pela estética limpa, luz editorial de revista e estilo impecável',
      flux_schnell: 'FLUX.1 [schnell] (Grátis / Open-Source) - famosa pelo tempo de inferência imediato, renderização perfeita de textos e coerência estrutural',
      stable_diffusion_3: 'Stable Diffusion 3 (Grátis / Hugging Face Spaces) - famosa pela composição harmoniosa, estilo moderno e controle apurado',
      pollinations_image: 'Pollinations AI (Grátis / Open-API) - geração de alta velocidade, sem limites e ótimo contraste',
      craiyon_v3: 'Craiyon V3 (Grátis) - geração simples, versátil e rápida'
    };

    const videoAiNames: Record<string, string> = {
      openai_sora: 'OpenAI Sora (Paga) - famosa pela simulação cinemática de altíssimo realismo físico e consistência temporal prolongada',
      runway_gen3: 'Runway Gen-3 Alpha (Paga) - famosa pela movimentação fluida de câmera, efeitos hollywoodianos dramáticos e simulações estéticas elegantes',
      luma_dream: 'Luma Dream Machine (Paga) - famosa pela velocidade de inferência, dinamismo acentuado e fluidez natural de ação de personagens',
      kling_ai: 'Kling AI Premium (Paga) - famosa pelas belas transições de zoom, interações físicas perfeitamente realistas e cores ricas',
      hunyuan_video: 'Tencent Hunyuan Open Video (Grátis / Spaces) - perfeita fidelidade espacial, ótimo andamento e alta resolução para shorts',
      mochi1: 'Mochi 1 High-Motion (Grátis / Open-Source) - famosa pela movimentação ágil e quebra dramática de distorção de corpo',
      stable_video_diffusion: 'Stable Video Diffusion (Grátis / Space) - animações leves em sutil paralaxe de pan com alta estética',
      open_sora: 'Open-Sora (Grátis) - renderização dinâmica leve, focada em transição estética suave'
    };

    const imgAiUsed = imageAiNames[selectedImageAI || 'midjourney_api'] || 'Midjourney v6';
    const vidAiUsed = videoAiNames[selectedVideoAI || 'runway_gen3'] || 'Runway Gen-3';

    if (platform === "google") {
      if (creativeType === "image") {
        platformContext = `Crie um anúncio focado em IMAGEM (Google Display Ads ou Campanhas de Performance Max).
REQUISITOS DE SAÍDA:
- Títulos curtos: 3 opções de até 30 caracteres cada.
- Descrição longa: 2 opções persuasivas de até 90 caracteres cada para serem exibidas junto com a imagem.
- Guia Criativo da Imagem (Visual Prompt): Um prompt de criação de imagem extremamente pertinente e descritivo em português para ser inserido na ferramenta **${imgAiUsed}**. Ele DEVE incluir expressa e detalhadamente os elementos:
  * [TRATAMENTO / ESPECIALIDADE]: A especialidade/tratamento odontológico exato.
  * [GATILHO E DIFERENCIAL CLÍNICO]: O gatilho de dor ou desejo emocional/comercial e o diferencial clínico da tecnologia ou agilidade.
  * [RECORTE DE PÚBLICO-ALVO]: O perfil demográfico detalhado (idade aproximada, postura, emoções, foco em elite ou família).
  * [ABORDAGEM / ESTILO VISUAL]: O enquadramento, iluminação (natural, estúdio), paleta de cores e atmosfera ideal para esse motor de geração.`;
      } else if (creativeType === "video") {
        platformContext = `Crie um anúncio de VÍDEO de alta conversão (Google Video/YouTube Ads ou Shorts).
REQUISITOS DE SAÍDA:
- Roteiro de Vídeo (Duração sugerida de 15 a 30 segundos) estruturado com foco em **${vidAiUsed}**:
  * Inclua [ESPECIALIDADE & ABORDAGEM] e [PÚBLICO-ALVO] nas definições iniciais do roteiro.
  * Instruções cênicas e direcionamento detalhados por segundos (0-3s, 4-12s, 13-20s, 21-30s), indicando cenas, closes, reações, falas de locução e texto de sobreposição na tela correspondentes ao tratamento e com apelo estético marcante.`;
      } else {
        platformContext = `Crie um anúncio clássico de TEXTO para a Rede de Pesquisa do Google Ads.
REQUISITOS DE SAÍDA:
- Títulos: Forneça 3 opções de títulos de alta performance (limite de 30 caracteres cada) com palavras de gatilho.
- Descrições: Forneça 2 opções de descrições persuasivas e complementares (limite de 90 caracteres cada).
- Palavras-chave sugeridas: Liste de 5 a 8 palavras-chave específicas e geolocalizadas com intenção de agendamento imediato.`;
      }
    } else if (platform === "tiktok") {
      if (creativeType === "image") {
        platformContext = `Crie uma campanha focada em carrossel dinâmico ou imagens estáticas para o TikTok Ads.
REQUISITOS DE SAÍDA:
- Ideia Visual do Carrossel (3 a 4 telas): Descreva o visual de cada imagem/tela de forma pertinente. Cada imagem deve conter a estrutura de:
  * [TRATAMENTO / ESPECIALIDADE], [GATILHO E DIFERENCIAL CLÍNICO], [RECORTE DE PÚBLICO-ALVO], [ABORDAGEM / ESTILO VISUAL] específicas para o motor de imagem **${imgAiUsed}**.
- Textos Curtos de Sobreposição (Text on Screen) para cada uma das telas.
- Legenda Rápida da Campanha com alta atratividade.
- 5 Hashtags de alto tráfego odontológico.`;
      } else if (creativeType === "video") {
        platformContext = `Crie um roteiro de vídeo dinâmico e viral para o TikTok Ads, otimizando para os movimentos da ferramenta **${vidAiUsed}**.
REQUISITOS DE SAÍDA:
- Roteiro detalhado indicando as marcações: [ESPECIALIDADE & ABORDAGEM] do tratamento de saúde, [PÚBLICO-ALVO] de nicho e instruções cênicas expressas.
- Gancho (Primeiros 3 segundos): Um gancho visual e falado irresistível, quebrando objeções e gerando curiosidade sobre o tratamento.
- Corpo do Roteiro: Instruções específicas de gravação (cenas, closes e reações) + falas ou texto explícito em tela.
- Chamada de Ação Final (CTA): Direcionamento inequívoco para iniciar conversa.
- Hashtags: 5 hashtags com alta tração para o ramo odontológico regional.`;
      } else {
        platformContext = `Crie um anúncio focado no TEXTO / COPY e legendas de legenda rápida do TikTok Ads.
REQUISITOS DE SAÍDA:
- Texto do Gancho para colar na tela (Overlay): 3 variações.
- Legenda Curta e Direta da Publicação: Com emojis e linguagem informal de alta conversão.
- 5 Hashtags estratégica odontológicas regionais.`;
      }
    } else {
      // facebook/instagram
      if (creativeType === "image") {
        platformContext = `Crie um anúncio estratégico para o Facebook & Instagram Ads focado em IMAGEM (Arte do Feed/Universo Estético/Bento ou Foto do Dr.).
REQUISITOS DE SAÍDA:
- Título Magnético (Headline da barra do link): Curto, ousado, focado na transformação.
- Texto Principal (Legenda do post): Fluido, iniciando pela dor, expandindo para os benefícios e diferenciais, CTA explícito.
- Conceito Operacional da Imagem (Visual Prompt): Instrução detalhada para ser inserida na IA **${imgAiUsed}**. Ela DEVE incluir obrigatoriamente e de forma estruturada:
  * [TRATAMENTO / ESPECIALIDADE]: <especialidade/tratamento em detalhes>
  * [GATILHO E DIFERENCIAL CLÍNICO]: <gatilho de dor/desejo e diferencial da clínica>
  * [RECORTE DE PÚBLICO-ALVO]: <informações detalhadas do público: idade, estilo de vida, postura>
  * [ABORDAGEM / ESTILO VISUAL]: <estilo de fotografia, iluminação, paleta de cores e atmosfera estética>
- Texto de Sobreposição Opcional para a imagem (overlay text).`;
      } else if (creativeType === "video") {
        platformContext = `Crie uma campanha focada em Roteiro de VÍDEO (Reels, Stories, Vídeo de Feed) para o Facebook & Instagram Ads, estruturada com ênfase no motor de geração **${vidAiUsed}**.
REQUISITOS DE SAÍDA:
- Definição clara no cabeçalho de [ESPECIALIDADE & ABORDAGEM] do tratamento nobre e seu [PÚBLICO-ALVO] focado.
- Estrutura de Reels (15-30s):
  * Cena 1 (0-3s): Hook magnético focado na quebra do medo, vergonha ou dificuldade estética ao sorrir.
  * Cena 2 (4-12s): Argumento clínico, autoridade dos especialistas e tecnologia odontológica confortável sem barulhos traumáticos.
  * Cena 3 (13-20s): Demonstração de facilidade de pagamento ou simulação digital interativa em 3D.
  * Cena 4 (21-30s): CTA forte para clicar e falar com o Dr(a) no WhatsApp.
- Narração em áudio (voz amigável e simpática) + Legenda na tela sugerida para as transições, indicando ângulos de gravação ideais para produzir o vídeo.`;
      } else {
        platformContext = `Crie uma cópia de post clássica altamente viciante e persuasiva focado em TEXTO de alto impacto para Facebook & Instagram Ads.
REQUISITOS DE SAÍDA:
- Título Magnético (Headline): Curto, ousado e focado na principal transformação estética ou de saúde.
- Texto Principal (Legenda do post): Um texto fluido estruturado com parágrafos curtos, iniciando com uma dor comum, expandindo para os benefícios do tratamento, diferenciais da clínica e fechando com oferta clara.
- Descrição da barra de link: Frase curta de urgência (limite de 35 caracteres).`;
      }
    }

    const promptText = `You are a high-performance digital marketing specialist for dental clinics. 
    Platform: ${platform || 'Facebook/Instagram'}
    Target audience: ${target}
    Tone of voice: ${tone || 'Professional'}
    Clinic info: ${JSON.stringify(clinicInfo)}
    Creative style requirement: ${creativeType ? creativeType.toUpperCase() : 'TEXT'}
    Selected Image AI: ${selectedImageAI || 'midjourney_api'} (${imgAiUsed})
    Selected Video AI: ${selectedVideoAI || 'runway_gen3'} (${vidAiUsed})
    
    Requirements:
    ${platformContext}
    
    ATENÇÃO - REQUISITO DE MULTI-GERAÇÃO:
    Por favor, gere EXATAMENTE ${count} variações de anúncios alternativas para teste de público.
    Cada variação deve ser diferente da outra (apresentando diferentes ganchos, headlines ou apelos emocionais/comerciais).
    Separe cada variação usando EXATAMENTE a tag de divisão '=== VARIAÇÃO [NÚMERO] ===' como divisor, desta forma:
    === VARIAÇÃO 1 ===
    (conteúdo da variação 1)
    === VARIAÇÃO 2 ===
    (conteúdo da variação 2)
    
    Write in Portuguese (pt-BR). Use emojis appropriately if suitable for the platform. Focus on conversion and high CTR.`;

    let generatedAdText = "";

    if (selectedAI && selectedAI.id) {
      generatedAdText = await generateWithProvider(selectedAI.id, selectedAI.apiKey, selectedAI.model, promptText, selectedAI.customUrl);
    } else {
      // Default fallback to internal Gemini Key
      const interaction = await ai.interactions.create({ 
        model: "gemini-3.5-flash",
        input: promptText
      });
      generatedAdText = interaction.output_text;
    }

    res.json({ ad: generatedAdText });
  } catch (error: any) {
    console.warn("Ad Generation API error intercepted. Activating aesthetic backup generator:", error.message);
    const fallbackCopy = generateMockAd(target, clinicInfo, platform, tone, creativeType, error.message, count, selectedImageAI, selectedVideoAI);
    res.json({ ad: fallbackCopy });
  }
});

// Vite middleware for development
async function setupVite() {
  const config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  };

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Injetar variáveis no HTML durante o desenvolvimento
    app.use(async (req, res, next) => {
      // Somente para requisições de página principal
      const isHtmlRequest = req.url === '/' || req.url?.endsWith('.html') || (!req.url?.includes('.') && req.headers.accept?.includes('text/html'));
      
      if (isHtmlRequest) {
        try {
          const indexFile = path.resolve(process.cwd(), 'index.html');
          let html = fs.readFileSync(indexFile, 'utf-8');
          html = await vite.transformIndexHtml(req.url || '/', html);
          
          const scriptTag = `<script>window.ENV_CONFIG = ${JSON.stringify(config)};</script>`;
          html = html.replace('<head>', `<head>${scriptTag}`);
          
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e: any) {
          console.error('[Server] Vite Transfrom Error:', e.message);
        }
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      try {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, 'utf-8');
          
          console.log('[Server] Injected Supabase Config (Prod):', {
            url: config.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING',
            key: config.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING'
          });
          
          const scriptTag = `<script>window.ENV_CONFIG = ${JSON.stringify(config)};</script>`;
          html = html.replace('<head>', `<head>${scriptTag}`);
          
          res.send(html);
        } else {
          res.sendFile(indexPath);
        }
      } catch (e) {
        console.error("Error injecting ENV_CONFIG:", e);
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }
}

setupVite().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (hasSavedSession()) {
      console.log("Saved WhatsApp session found. Reconnecting automatically...");
      connectToWhatsApp();
    } else {
      console.log("No saved WhatsApp session found. Awaiting manual activation...");
    }
  });
}).catch(console.error);
