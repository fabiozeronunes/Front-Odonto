export interface Clinic {
  id: string;
  name: string;
  cnpj: string;
  cro: string;
  address: string;
  cep: string;
  district: string;
  city: string;
  email: string;
  phone: string;
  ownerId: string;
  createdAt: string;
}

export interface Dentist {
  id: string;
  name: string;
  cpf: string;
  cro: string;
  phone: string;
  email: string;
  address: string;
  cep: string;
  district: string;
  city: string;
  specialty: string;
  clinicId: string;
  ownerId: string;
  googleCalendarId?: string;
}

export interface Patient {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  endereco: string;
  alergias: string;
  medicamentos: string;
  historico: string;
  planoTratamento: string;
  dentistaId: string;
  numeroRegistro?: string;
  treatedTeeth: number[];
  files: { name: string; url: string }[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  plannedProcedures?: any[];
  amountPaid?: number;
  payments?: any[];
  // CRM fields (optional)
  name?: string;
  phone?: string;
  clinicId?: string;
  status?: 'lead' | 'contacted' | 'scheduled' | 'completed' | 'lost';
  lastContactAt?: any;
  interestedIn?: string;
  source?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientDisplayId?: string;
  dentistId: string;
  clinicId: string;
  ownerId: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  tipoAtendimento: string;
  googleEventId?: string;
  createdAt: any;
  isGoogle?: boolean;
  htmlLink?: string;
  location?: string;
  calendarName?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Procedure {
  id: string;
  type: string;
  category?: string;
  value: number;
  dentistId: string;
  clinicId: string;
  registrationDate: string;
  ownerId: string;
}

export interface Specialty {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  bgColor: string;
  ownerId: string;
  createdAt: string;
}
