import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Copy, 
  Loader2, 
  Server, 
  RefreshCcw,
  Sparkles,
  Link
} from 'lucide-react';

interface MigrationStatus {
  table: string;
  count: number;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export default function SupabaseMigration() {
  const metaEnv = (import.meta as any).env || {};
  const [supabaseUrl, setSupabaseUrl] = useState(metaEnv.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(metaEnv.VITE_SUPABASE_ANON_KEY || '');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progressBar, setProgressBar] = useState(0);

  const [migrationStates, setMigrationStates] = useState<MigrationStatus[]>([
    { table: 'users', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'clinics', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'dentists', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'pacientes', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'appointments', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'procedures', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'specialties', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'funnel_stages', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'quick_responses', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'whatsapp_chats', count: 0, status: 'pending', message: 'Aguardando início' },
    { table: 'whatsapp_messages', count: 0, status: 'pending', message: 'Aguardando início' }
  ]);

  // Exemplo de código SQL que criamos para exibir ao usuário
  const sqlSchema = `-- SCHEMA DE BANCO DE DADOS POSTGRESQL PARA SUPABASE
-- Execute este bloco diretamente no SQL Editor do Supabase antes de iniciar a migração

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLINICS
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    cro TEXT,
    address TEXT,
    cep TEXT,
    district TEXT,
    city TEXT,
    email TEXT,
    phone TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DENTISTS
CREATE TABLE IF NOT EXISTS dentists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT,
    cro TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    cep TEXT,
    district TEXT,
    city TEXT,
    specialty TEXT,
    clinic_id TEXT,
    owner_id TEXT NOT NULL,
    google_calendar_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PACIENTES (PATIENTS)
CREATE TABLE IF NOT EXISTS pacientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    data_nascimento TEXT,
    endereco TEXT,
    alergias TEXT,
    medicamentos TEXT,
    historico TEXT,
    plano_tratamento TEXT,
    dentista_id TEXT,
    numero_registro TEXT,
    treated_teeth INTEGER[] DEFAULT '{}',
    files JSONB DEFAULT '[]'::jsonb,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    planned_procedures JSONB DEFAULT '[]'::jsonb,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    payments JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'lead',
    last_contact_at TIMESTAMP WITH TIME ZONE,
    interested_in TEXT,
    source TEXT,
    clinic_id TEXT
);

-- 4. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    patient_display_id TEXT,
    dentist_id TEXT,
    clinic_id TEXT,
    owner_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tipo_atendimento TEXT,
    google_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_google BOOLEAN DEFAULT FALSE,
    html_link TEXT,
    location TEXT,
    calendar_name TEXT
);

-- 5. PROCEDURES
CREATE TABLE IF NOT EXISTS procedures (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT,
    value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    dentist_id TEXT,
    clinic_id TEXT,
    registration_date TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SPECIALTIES
CREATE TABLE IF NOT EXISTS specialties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_color TEXT,
    bg_color TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. FUNNEL STAGES
CREATE TABLE IF NOT EXISTS funnel_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    "order" INTEGER,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. QUICK RESPONSES
CREATE TABLE IF NOT EXISTS quick_responses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    category TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. RESPONSE CATEGORIES
CREATE TABLE IF NOT EXISTS response_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. WHATSAPP CHATS
CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    unread_count INTEGER DEFAULT 0,
    avatar TEXT,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
    sender_id TEXT,
    sender_name TEXT,
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent',
    owner_id TEXT NOT NULL
);

-- 12. DELETED CHATS
CREATE TABLE IF NOT EXISTS deleted_chats (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS e criar políticas de acesso livre para facilitar testes iniciais
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura/escrita pública" ON clinics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON dentists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON pacientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON appointments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON procedures FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON specialties FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON funnel_stages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON quick_responses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON response_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON whatsapp_chats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON whatsapp_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura/escrita pública" ON deleted_chats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
`;

  // Função para testar conexão com o Supabase
  const testConnection = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setConnectionStatus('failed');
      setConnectionError('Por favor, informe a URL e a Chave Anon (key) do Supabase.');
      return;
    }

    setConnectionStatus('testing');
    setConnectionError('');
    
    try {
      // Cria uma instância temporária do Supabase para verificar a conexão
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(supabaseUrl, supabaseKey);
      
      // Tenta listar clínicas ou fazer uma query rústica segura
      const { error } = await tempClient.from('clinics').select('id').limit(1);
      
      if (error) {
        // Se o erro for que a tabela não existe, a conexão deu certo (as chaves são válidas), mas as tabelas ainda não foram criadas!
        if (error.code === 'PGRST116' || error.message.includes('relation "clinics" does not exist') || error.code === '42P01') {
          setConnectionStatus('connected');
          addLog('🌐 Conectado ao Supabase! Mas atenção: as tabelas do schema ainda não foram detectadas. Crie as tabelas clicando no Passo 2 acima.');
        } else {
          setConnectionStatus('failed');
          setConnectionError(`Erro do Supabase: ${error.message} (Código ${error.code})`);
        }
      } else {
        setConnectionStatus('connected');
        addLog('🌐 Conexão estabelecida com sucesso! Tabelas detectadas.');
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setConnectionError(`Falha na conexão: ${err.message || err}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Função para mapear chaves e formatar campos compatíveis com Postgres
  const sanitizeDocument = (col: string, data: any) => {
    const cleaned: any = { ...data };

    // Substituir camelCase por snake_case se necessário
    if (cleaned.ownerId !== undefined) {
      cleaned.owner_id = cleaned.ownerId;
      delete cleaned.ownerId;
    }
    if (cleaned.createdAt !== undefined) {
      cleaned.created_at = typeof cleaned.createdAt?.toDate === 'function' 
        ? cleaned.createdAt.toDate().toISOString() 
        : new Date(cleaned.createdAt).toISOString();
      delete cleaned.createdAt;
    }
    if (cleaned.updatedAt !== undefined) {
      cleaned.updated_at = typeof cleaned.updatedAt?.toDate === 'function' 
        ? cleaned.updatedAt.toDate().toISOString() 
        : new Date(cleaned.updatedAt).toISOString();
      delete cleaned.updatedAt;
    }

    // Mapeamento específico por tabela
    if (col === 'users') {
      if (cleaned.dataNascimento !== undefined) { cleaned.data_nascimento = cleaned.dataNascimento; delete cleaned.dataNascimento; }
    } else if (col === 'clinics') {
      // no changes needed
    } else if (col === 'dentists') {
      if (cleaned.clinicId !== undefined) { cleaned.clinic_id = cleaned.clinicId; delete cleaned.clinicId; }
      if (cleaned.googleCalendarId !== undefined) { cleaned.google_calendar_id = cleaned.googleCalendarId; delete cleaned.googleCalendarId; }
    } else if (col === 'pacientes') {
      if (cleaned.dataNascimento !== undefined) { cleaned.data_nascimento = cleaned.dataNascimento; delete cleaned.dataNascimento; }
      if (cleaned.dentistaId !== undefined) { cleaned.dentista_id = cleaned.dentistaId; delete cleaned.dentistaId; }
      if (cleaned.numeroRegistro !== undefined) { cleaned.numero_registro = cleaned.numeroRegistro; delete cleaned.numeroRegistro; }
      if (cleaned.lastContactAt !== undefined) { 
        cleaned.last_contact_at = typeof cleaned.lastContactAt?.toDate === 'function' 
          ? cleaned.lastContactAt.toDate().toISOString() 
          : new Date(cleaned.lastContactAt).toISOString(); 
        delete cleaned.lastContactAt; 
      }
      if (cleaned.clinicId !== undefined) { cleaned.clinic_id = cleaned.clinicId; delete cleaned.clinicId; }
      if (cleaned.treatedTeeth !== undefined) { cleaned.treated_teeth = cleaned.treatedTeeth; delete cleaned.treatedTeeth; }
      if (cleaned.plannedProcedures !== undefined) { cleaned.planned_procedures = cleaned.plannedProcedures; delete cleaned.plannedProcedures; }
      if (cleaned.amountPaid !== undefined) { cleaned.amount_paid = cleaned.amountPaid; delete cleaned.amountPaid; }
    } else if (col === 'appointments') {
      if (cleaned.patientId !== undefined) { cleaned.patient_id = cleaned.patientId; delete cleaned.patientId; }
      if (cleaned.patientDisplayId !== undefined) { cleaned.patient_display_id = cleaned.patientDisplayId; delete cleaned.patientDisplayId; }
      if (cleaned.dentistId !== undefined) { cleaned.dent_id = cleaned.dentistId; cleaned.dentist_id = cleaned.dentistId; delete cleaned.dentistId; }
      if (cleaned.clinicId !== undefined) { cleaned.clinic_id = cleaned.clinicId; delete cleaned.clinicId; }
      if (cleaned.startTime !== undefined) { cleaned.start_time = new Date(cleaned.startTime).toISOString(); delete cleaned.startTime; }
      if (cleaned.endTime !== undefined) { cleaned.end_time = new Date(cleaned.endTime).toISOString(); delete cleaned.endTime; }
      if (cleaned.googleEventId !== undefined) { cleaned.google_event_id = cleaned.googleEventId; delete cleaned.googleEventId; }
      if (cleaned.isGoogle !== undefined) { cleaned.is_google = cleaned.isGoogle; delete cleaned.isGoogle; }
      if (cleaned.htmlLink !== undefined) { cleaned.html_link = cleaned.htmlLink; delete cleaned.htmlLink; }
      if (cleaned.calendarName !== undefined) { cleaned.calendar_name = cleaned.calendarName; delete cleaned.calendarName; }
    } else if (col === 'procedures') {
      if (cleaned.dentistId !== undefined) { cleaned.dentist_id = cleaned.dentistId; delete cleaned.dentistId; }
      if (cleaned.clinicId !== undefined) { cleaned.clinic_id = cleaned.clinicId; delete cleaned.clinicId; }
      if (cleaned.registrationDate !== undefined) { cleaned.registration_date = cleaned.registrationDate; delete cleaned.registrationDate; }
    } else if (col === 'specialties') {
      if (cleaned.iconColor !== undefined) { cleaned.icon_color = cleaned.iconColor; delete cleaned.iconColor; }
      if (cleaned.bgColor !== undefined) { cleaned.bg_color = cleaned.bgColor; delete cleaned.bgColor; }
    } else if (col === 'whatsapp_chats') {
      if (cleaned.unreadCount !== undefined) { cleaned.unread_count = cleaned.unreadCount; delete cleaned.unreadCount; }
      if (cleaned.lastMessage !== undefined) { cleaned.last_message = cleaned.lastMessage; delete cleaned.lastMessage; }
      if (cleaned.lastMessageTime !== undefined) { cleaned.last_message_time = new Date(cleaned.lastMessageTime).toISOString(); delete cleaned.lastMessageTime; }
    } else if (col === 'whatsapp_messages') {
      if (cleaned.chatId !== undefined) { cleaned.chat_id = cleaned.chatId; delete cleaned.chatId; }
      if (cleaned.senderId !== undefined) { cleaned.sender_id = cleaned.senderId; delete cleaned.senderId; }
      if (cleaned.senderName !== undefined) { cleaned.sender_name = cleaned.senderName; delete cleaned.senderName; }
      if (cleaned.timestamp !== undefined) { cleaned.timestamp = new Date(cleaned.timestamp).toISOString(); delete cleaned.timestamp; }
    }

    return cleaned;
  };

  // Processo principal de migração
  const runMigration = async () => {
    if (connectionStatus !== 'connected') {
      alert('Por favor, estabeleça e confirme a conexão com o Supabase antes de iniciar.');
      return;
    }

    setIsMigrating(true);
    setProgressBar(0);
    setLogs([]);
    addLog('🚀 Iniciando processo de migração de dados do Firestore para Supabase...');

    const { createClient } = await import('@supabase/supabase-js');
    const tempClient = createClient(supabaseUrl, supabaseKey);

    const currentUser = auth.currentUser;
    const isMock = localStorage.getItem('google_demo_logged_in_v1') === 'true';
    const ownerUid = currentUser ? currentUser.uid : 'google-demo-user-123';

    addLog(`🔑 Vinculando registros migrados ao Owner ID atual: ${ownerUid}`);

    // Map das coleções do Firestore
    const collectionsToMigrate = [
      { firestore: 'users', supabase: 'users' },
      { firestore: 'clinics', supabase: 'clinics' },
      { firestore: 'dentists', supabase: 'dentists' },
      { firestore: 'pacientes', supabase: 'pacientes' },
      { firestore: 'appointments', supabase: 'appointments' },
      { firestore: 'procedures', supabase: 'procedures' },
      { firestore: 'specialties', supabase: 'specialties' },
      { firestore: 'funnel_stages', supabase: 'funnel_stages' },
      { firestore: 'quick_responses', supabase: 'quick_responses' },
      { firestore: 'whatsapp_chats', supabase: 'whatsapp_chats' },
      { firestore: 'whatsapp_messages', supabase: 'whatsapp_messages' }
    ];

    let totalCollectionsMapped = collectionsToMigrate.length;
    let successCount = 0;

    for (let i = 0; i < collectionsToMigrate.length; i++) {
      const item = collectionsToMigrate[i];
      addLog(`📁 Lendo coleção Firestore: '${item.firestore}'...`);

      // Atualiza status da tabela específica
      updateTableStatus(item.firestore, 'running', 0, 'Baixando dados do Firestore...');

      try {
        let documents: any[] = [];
        
        // No Firestore v9/v10
        const colRef = collection(db, item.firestore);
        // Sempre buscar registros pertencentes ao usuário ou todos para pacientes/chats
        const snap = await getDocs(colRef);
        
        snap.forEach(docSnap => {
          documents.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Filtrar apenas se houver filtros de owner_id para garantir sandbox correto,
        // mas carregar tudo o que estiver no Firestore local do App para facilitar
        addLog(`📥 Encontrados ${documents.length} documentos na coleção '${item.firestore}'.`);

        if (documents.length === 0) {
          updateTableStatus(item.firestore, 'success', 0, 'Coleção vazia. Concluída.');
          addLog(`✅ Coleção '${item.firestore}' não possui dados para exportar.`);
          successCount++;
          setProgressBar(Math.round(((i + 1) / totalCollectionsMapped) * 100));
          continue;
        }

        addLog(`📤 Gravando ${documents.length} itens no Supabase na tabela '${item.supabase}'...`);

        // Fazer sanitização de tipos adicionando timestamp correto e limpando arrays
        const sanitizedData = documents.map(doc => {
          const clean = sanitizeDocument(item.firestore, doc);
          // Garantir owner_id
          if (!clean.owner_id) clean.owner_id = ownerUid;
          return clean;
        });

        // Loop ou Upsert em Massa
        // Como o Supabase permite upsert em lote:
        const { error: upsertError } = await tempClient
          .from(item.supabase)
          .upsert(sanitizedData, { onConflict: 'id' });

        if (upsertError) {
          throw new Error(upsertError.message);
        }

        updateTableStatus(item.firestore, 'success', documents.length, 'Migrado com sucesso!');
        addLog(`✅ Tabela '${item.supabase}' migrada com ${documents.length} registro(s).`);
        successCount++;
      } catch (e: any) {
        console.error(`Erro ao migrar ${item.firestore}:`, e);
        updateTableStatus(item.firestore, 'error', 0, `Falha: ${e.message || e}`);
        addLog(`❌ Falha ao migrar '${item.firestore}': ${e.message || e}`);
      }

      setProgressBar(Math.round(((i + 1) / totalCollectionsMapped) * 100));
    }

    setIsMigrating(false);
    if (successCount === totalCollectionsMapped) {
      addLog('🎉 MIGRAÇÃO CONCLUÍDA! Todos os dados do Firestore estão seguros no Supabase.');
    } else {
      addLog('⚠️ Migração finalizada com alguns erros. Revise acima.');
    }
  };

  const updateTableStatus = (key: string, status: MigrationStatus['status'], count: number, message: string) => {
    setMigrationStates(prev => prev.map(item => {
      if (item.table === key) {
        return { ...item, status, count: count || item.count, message };
      }
      return item;
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8" id="supabase-migrator-container">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-emerald-950 via-neutral-950 to-neutral-950 text-white rounded-3xl p-8 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database size={240} className="text-emerald-500" />
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold w-max mb-6">
          <Sparkles size={14} />
          <span>Fácil & Seguro</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-neutral-50 mb-3">
          Migrador Oficial Firestore → Supabase
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Transfira todos os seus registros de clínicas, dentistas, pacientes, agendamentos, tratamentos e conversas do WhatsApp do Firebase Firestore para o seu banco de dados PostgreSQL hospedado no Supabase.
        </p>
      </div>

      {/* Grid de Passos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Passo 1 */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm mb-4">
              1
            </div>
            <h3 className="font-bold text-neutral-800 text-base mb-2">Conectar Supabase</h3>
            <p className="text-neutral-500 text-xs leading-relaxed mb-4">
              Informe as credenciais do seu projeto Supabase abaixo ou adicione-as ao seu arquivo <strong>.env</strong> para vincular o sistema.
            </p>
          </div>
        </div>

        {/* Passo 2 */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm mb-4">
              2
            </div>
            <h3 className="font-bold text-neutral-800 text-base mb-2">Criação do Schema</h3>
            <p className="text-neutral-500 text-xs leading-relaxed mb-4">
              Copie o código SQL estruturado no Passo 2 e cole diretamente no <strong>SQL Editor</strong> do painel Supabase para criar as tabelas compatíveis.
            </p>
          </div>
        </div>

        {/* Passo 3 */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm mb-4">
              3
            </div>
            <h3 className="font-bold text-neutral-800 text-base mb-2">Executar Migração</h3>
            <p className="text-neutral-500 text-xs leading-relaxed mb-4">
              Clique no botão de migração e assista o robô duplicar todos os seus dados do Firestore diretamente para as tabelas selecionadas.
            </p>
          </div>
        </div>
      </div>

      {/* Passo 1 - Form de Conexão */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-100 pb-5">
          <Server className="text-emerald-600" size={24} />
          <div>
            <h2 className="font-bold text-lg text-neutral-800">Passo 1: Estabelecer Conexão com o Supabase</h2>
            <p className="text-xs text-neutral-400">Verifique os dados de acesso públicos de API do seu projeto Supabase</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">URL do Projeto Supabase</label>
            <input 
              type="text" 
              placeholder="Ex: https://xxxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => {
                setSupabaseUrl(e.target.value);
                setConnectionStatus('idle');
              }}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Chave Anon Key (Chave Pública)</label>
            <input 
              type="password" 
              placeholder="Ex: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey..."
              value={supabaseKey}
              onChange={(e) => {
                setSupabaseKey(e.target.value);
                setConnectionStatus('idle');
              }}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Alertas e Botão de Teste */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60">
          <div className="flex-1">
            {connectionStatus === 'idle' && (
              <p className="text-xs text-neutral-500">Informe suas credenciais e clique em <strong>Testar Conexão</strong> para validar seu banco de dados.</p>
            )}
            {connectionStatus === 'testing' && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                <Loader2 className="animate-spin text-emerald-600" size={16} />
                <span>Testando autenticação de chaves com o servidor Supabase...</span>
              </div>
            )}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Conexão bem-sucedida! Pronto para migrar.</span>
              </div>
            )}
            {connectionStatus === 'failed' && (
              <div className="flex items-start gap-2 text-xs text-red-600 font-semibold">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span className="break-all">{connectionError}</span>
              </div>
            )}
          </div>

          <button
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0"
          >
            Testar Conexão
          </button>
        </div>
      </div>

      {/* Passo 2 - Código SQL */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-3">
            <Database className="text-indigo-600" size={24} />
            <div>
              <h2 className="font-bold text-lg text-neutral-800">Passo 2: Criar Tabelas no Supabase</h2>
              <p className="text-xs text-neutral-400">Copie o script SQL completo abaixo para estruturar sua base no Postgres de forma idêntica</p>
            </div>
          </div>

          <button
            onClick={() => copyToClipboard(sqlSchema, 1)}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-600 text-xs font-bold transition-all"
          >
            {copiedIndex === 1 ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-emerald-700">Copiado</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copiar SQL</span>
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <textarea
            readOnly
            value={sqlSchema}
            className="w-full h-60 p-4 bg-neutral-900 text-neutral-200 font-mono text-xs rounded-2xl border border-neutral-800 focus:outline-none focus:ring-0 overflow-y-auto leading-relaxed resize-none"
          />
          <div className="absolute bottom-3 right-3 bg-neutral-850 px-2 py-1 rounded text-[10px] uppercase font-black text-neutral-500 border border-neutral-800">
            Dica: Cole no SQL Editor
          </div>
        </div>
      </div>

      {/* Passo 3 - Painel de Migração de Dados */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-3">
            <RefreshCcw className="text-emerald-500 animate-spin-slow" size={24} />
            <div>
              <h2 className="font-bold text-lg text-neutral-800">Passo 3: Mapeamento e Transferência Ativa</h2>
              <p className="text-xs text-neutral-400">Transfira os registros diretamente em lote com segurança garantida</p>
            </div>
          </div>

          <button
            onClick={runMigration}
            disabled={isMigrating || connectionStatus !== 'connected'}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-400 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/10"
          >
            {isMigrating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Migrando...</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Iniciar Migração Ativa</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {isMigrating && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-emerald-700">Progresso Geral</span>
              <span className="font-black text-neutral-600">{progressBar}%</span>
            </div>
            <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-2.5 transition-all duration-300 rounded-full" 
                style={{ width: `${progressBar}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabela de Lote */}
        <div className="border border-neutral-200/60 rounded-2xl overflow-hidden">
          <div className="table-header-group">
            <div className="grid grid-cols-3 bg-neutral-50 px-5 py-3 border-b border-neutral-200 text-[10px] font-black text-neutral-400 uppercase tracking-wider">
              <span>Tabela</span>
              <span className="text-center">Quantidade Detectada</span>
              <span className="text-right">Status do Processamento</span>
            </div>
          </div>
          
          <div className="divide-y divide-neutral-100">
            {migrationStates.map((itm) => (
              <div key={itm.table} className="grid grid-cols-3 px-5 py-3.5 items-center text-xs">
                <span className="font-semibold text-neutral-800 capitalize flex items-center gap-2">
                  <Database size={14} className="text-neutral-400" />
                  {itm.table.replace('_', ' ')}
                </span>
                
                <span className="text-center font-bold text-neutral-500">
                  {itm.status === 'success' ? `${itm.count} registros` : '-'}
                </span>

                <div className="text-right">
                  {itm.status === 'pending' && (
                    <span className="inline-block px-2.5 py-1 bg-neutral-100 text-neutral-500 font-bold rounded-lg uppercase text-[9px] tracking-wider">
                      Pendente
                    </span>
                  )}
                  {itm.status === 'running' && (
                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-600 font-bold rounded-lg uppercase text-[9px] tracking-wider animate-pulse">
                      Processando...
                    </span>
                  )}
                  {itm.status === 'success' && (
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg uppercase text-[9px] tracking-wider">
                      Sucesso
                    </span>
                  )}
                  {itm.status === 'error' && (
                    <span className="inline-block px-2.5 py-1 bg-red-50 text-red-600 font-bold rounded-lg uppercase text-[9px] tracking-wider" title={itm.message}>
                      Erro
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Logs de Processamento em Tempo Real</label>
          <div className="w-full h-40 p-4 bg-neutral-950 text-emerald-400 font-mono text-[11px] rounded-2xl border border-neutral-900 overflow-y-auto leading-relaxed flex flex-col-reverse">
            {logs.length === 0 ? (
              <p className="text-neutral-600 italic">O console está aguardando o início das ações de conexão ou transferência...</p>
            ) : (
              logs.map((logStr, lIdx) => (
                <div key={lIdx} className="border-b border-neutral-900/40 py-1">{logStr}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
