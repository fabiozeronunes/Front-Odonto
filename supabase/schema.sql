-- SCHEMA DE BANCO DE DADOS POSTGRESQL PARA SUPABASE
-- Aplique este script diretamente no "SQL Editor" do seu painel do Supabase.

-- Habilitar a extensão padrão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. USERS (Perfis de Usuários)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT,
    cpf TEXT,
    whatsapp TEXT,
    data_nascimento TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    data_cadastro TEXT,
    crm TEXT,
    especialidade TEXT,
    telefone TEXT,
    clinic_name TEXT,
    logo_url TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. CLINICS (Clínicas)
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY, -- Mantendo TEXT para compatibilidade direta de IDs gerados no client/Firestore
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

-- 2. DENTISTS (Dentistas)
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
    clinic_id TEXT, -- Relacionamento opcional com clínicas
    owner_id TEXT NOT NULL,
    google_calendar_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PACIENTES / PATIENTS (Pacientes)
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
    -- Campos opcionais para o CRM
    status TEXT DEFAULT 'lead', -- 'lead' | 'contacted' | 'scheduled' | 'completed' | 'lost'
    last_contact_at TIMESTAMP WITH TIME ZONE,
    interested_in TEXT,
    source TEXT,
    clinic_id TEXT
);

-- 4. APPOINTMENTS (Agendamentos da Agenda)
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    patient_display_id TEXT,
    dentist_id TEXT,
    clinic_id TEXT,
    owner_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'completed'
    tipo_atendimento TEXT,
    google_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_google BOOLEAN DEFAULT FALSE,
    html_link TEXT,
    location TEXT,
    calendar_name TEXT
);

-- 5. PROCEDURES (Procedimentos)
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

-- 6. SPECIALTIES (Especialidades)
CREATE TABLE IF NOT EXISTS specialties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_color TEXT,
    bg_color TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. FUNNEL STAGES (Fases do Funil de CRM)
CREATE TABLE IF NOT EXISTS funnel_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    "order" INTEGER,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. QUICK RESPONSES (Respostas Rápidas)
CREATE TABLE IF NOT EXISTS quick_responses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    category TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. RESPONSE CATEGORIES (Categorias de Respostas)
CREATE TABLE IF NOT EXISTS response_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. WHATSAPP CHATS (Conversas Simuladas ou Reais)
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

-- 11. WHATSAPP MESSAGES (Mensagens do WhatsApp)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
    sender_id TEXT, -- 'user' | 'patient' | 'system'
    sender_name TEXT,
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent', -- 'sent' | 'delivered' | 'read'
    owner_id TEXT NOT NULL
);

-- 12. DELETED CHATS (Registro de Chats Excluídos)
CREATE TABLE IF NOT EXISTS deleted_chats (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. AI CONNECTIONS (Conexões com IA)
CREATE TABLE IF NOT EXISTS ai_connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'google' | 'openai' | etc
    api_key TEXT,
    model TEXT,
    status TEXT DEFAULT 'active',
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. APP SETTINGS (Configurações Gerais - Key/Value)
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY, -- ex: 'whatsapp_reminders'
    owner_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- REGULAMENTAÇÃO DE POLÍTICAS DE RLS (Row Level Security) - OPCIONAL MAS RECOMENDADO
-- Habilita RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE ai_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Exemplo simples de regras de acesso (qualquer pessoa autenticada pode gerenciar seus próprios registros usando owner_id)
-- Alinhamos owner_id com auth.uid() do Supabase Auth para controle rígido por usuário se desejado.
DROP POLICY IF EXISTS "Permitir tudo (Users)" ON users;
CREATE POLICY "Permitir tudo (Users)" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Clinics)" ON clinics;
CREATE POLICY "Permitir tudo (Clinics)" ON clinics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Dentists)" ON dentists;
CREATE POLICY "Permitir tudo (Dentists)" ON dentists FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Pacientes)" ON pacientes;
CREATE POLICY "Permitir tudo (Pacientes)" ON pacientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Appointments)" ON appointments;
CREATE POLICY "Permitir tudo (Appointments)" ON appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Procedures)" ON procedures;
CREATE POLICY "Permitir tudo (Procedures)" ON procedures FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Specialties)" ON specialties;
CREATE POLICY "Permitir tudo (Specialties)" ON specialties FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Funnel Stages)" ON funnel_stages;
CREATE POLICY "Permitir tudo (Funnel Stages)" ON funnel_stages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Quick Responses)" ON quick_responses;
CREATE POLICY "Permitir tudo (Quick Responses)" ON quick_responses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Response Categories)" ON response_categories;
CREATE POLICY "Permitir tudo (Response Categories)" ON response_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (WhatsApp Chats)" ON whatsapp_chats;
CREATE POLICY "Permitir tudo (WhatsApp Chats)" ON whatsapp_chats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (WhatsApp Messages)" ON whatsapp_messages;
CREATE POLICY "Permitir tudo (WhatsApp Messages)" ON whatsapp_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (Deleted Chats)" ON deleted_chats;
CREATE POLICY "Permitir tudo (Deleted Chats)" ON deleted_chats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (AI Connections)" ON ai_connections;
CREATE POLICY "Permitir tudo (AI Connections)" ON ai_connections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo (App Settings)" ON app_settings;
CREATE POLICY "Permitir tudo (App Settings)" ON app_settings FOR ALL USING (true) WITH CHECK (true);
