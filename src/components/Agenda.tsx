import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, RefreshCw, AlertCircle, X, Loader2, User, Building2, Stethoscope, Trash2, MessageCircle, Globe, MapPin } from 'lucide-react';
import { format, addDays, startOfToday, startOfWeek, startOfMonth, endOfMonth, endOfWeek, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Appointment, Clinic, Dentist, Patient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';
import { getPatientId } from '../lib/patient-utils';

interface AgendaProps {
  accessToken: string | null;
  onConnectGoogle: () => Promise<void>;
  onNavigate: (tab: string) => void;
  onDisconnectGoogle?: () => void;
  syncTrigger: number;
}

export default function Agenda({ accessToken, onConnectGoogle, onNavigate, onDisconnectGoogle, syncTrigger }: AgendaProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [hasFetchedGoogle, setHasFetchedGoogle] = useState(false);
  const [localDeletedGoogleIds, setLocalDeletedGoogleIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agenda_deleted_google_ids');
      if (!saved || saved === 'undefined') return [];
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });
  const [googleEventToDelete, setGoogleEventToDelete] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const importingEventIds = useRef<Set<string>>(new Set());

  const handleDeleteGoogleEvent = async (eventId: string) => {
    const updated = [...localDeletedGoogleIds, eventId];
    setLocalDeletedGoogleIds(updated);
    localStorage.setItem('agenda_deleted_google_ids', JSON.stringify(updated));

    const matchingLocalAppt = appointments.find(a => a.googleEventId === eventId);
    if (matchingLocalAppt) {
      try {
        await deleteDoc(doc(db, 'appointments', matchingLocalAppt.id));
      } catch (err) {
        console.error("Erro ao remover agendamento local correspondente:", err);
      }
    }

    if (accessToken && accessToken !== 'demo-token') {
      try {
        await fetch('/api/calendar/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              accessToken,
              eventId
          })
        });
      } catch (err) {
        console.warn("Falha ao comunicar exclusão ao servidor principal do Google:", err);
      }
    }
  };

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmAppt, setDeleteConfirmAppt] = useState<Appointment | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingDate, setViewingDate] = useState(startOfToday());

  // Novo módulo do Agente de Lembrete Automático WhatsApp (até 24h)
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [reminderLogs, setReminderLogs] = useState<{ id: string; name: string; dateStr: string; timeStr: string; status: 'success' | 'error'; isSimulated: boolean; message: string }[]>(() => {
    try {
      const logs = localStorage.getItem('agenda_reminder_logs');
      if (!logs || logs === 'undefined') return [];
      return JSON.parse(logs);
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('agenda_reminder_logs', JSON.stringify(reminderLogs));
  }, [reminderLogs]);

  const checkWaStatus = async () => {
    try {
      const res = await fetch('/api/wa-status');
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status || 'disconnected');
      }
    } catch (e) {
      console.warn("Falha ao consultar status do WhatsApp para os Lembretes da Agenda:", e);
    }
  };

  useEffect(() => {
    checkWaStatus();
    const interval = setInterval(checkWaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPhoneForGoogleEvent = (ge: any, patientsList: Patient[]): string | null => {
    const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/g;
    const matchDesc = (ge.description || '').match(phoneRegex);
    if (matchDesc && matchDesc[0]) return matchDesc[0].replace(/\D/g, '');
    
    const matchSum = (ge.summary || '').match(phoneRegex);
    if (matchSum && matchSum[0]) return matchSum[0].replace(/\D/g, '');

    const summaryLower = (ge.summary || '').toLowerCase();
    const descLower = (ge.description || '').toLowerCase();
    
    for (const p of patientsList) {
      const pName = (p.nome || p.name || '').toLowerCase();
      if (pName.length > 3 && (summaryLower.includes(pName) || descLower.includes(pName))) {
        const tel = p.telefone || p.phone;
        if (tel) {
          return tel.replace(/\D/g, '');
        }
      }
    }
    return null;
  };

  const getSentReminders = (): Set<string> => {
    try {
      const saved = localStorage.getItem('agenda_sent_reminders');
      return new Set(saved && saved !== 'undefined' ? JSON.parse(saved) : []);
    } catch (e) {
      return new Set();
    }
  };

  const markReminderAsSent = (id: string) => {
    try {
      const saved = localStorage.getItem('agenda_sent_reminders');
      const list = saved && saved !== 'undefined' ? JSON.parse(saved) : [];
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem('agenda_sent_reminders', JSON.stringify(list));
      }
    } catch (e) {
      console.error("Falha ao salvar UUID de lembrete enviado:", e);
    }
  };

  const triggerUpcomingReminders = async (manual = false) => {
    if (checkingReminders) return;
    setCheckingReminders(true);
    
    const isEnabled = localStorage.getItem('whatsapp_reminders_enabled') !== 'false';
    if (!isEnabled) {
      if (manual) {
        alert("O disparo automático de lembretes está desativado nas Configurações de Notificações em Conexões.");
      }
      setCheckingReminders(false);
      return;
    }

    const savedMins = localStorage.getItem('whatsapp_reminder_minutes');
    const reminderMinutes = savedMins ? parseInt(savedMins, 10) : 1440;

    // Atualiza status mais recente antes de disparar
    await checkWaStatus();

    const now = new Date();
    const targetLimit = new Date(now.getTime() + reminderMinutes * 60 * 1000);
    const sentIds = getSentReminders();
    
    let processedCount = 0;
    const newLogs: typeof reminderLogs = [];

    // 1) Disparo de lembretes para agendamentos locais do Firestore
    for (const appt of appointments) {
      if (sentIds.has(appt.id)) continue;
      
      const apptTime = new Date(appt.startTime);
      // Somente próximas M minutos e agendamento futuro
      if (apptTime > now && apptTime <= targetLimit) {
        const patient = patients.find(p => p.id === appt.patientId);
        const phone = patient?.telefone || patient?.phone;
        if (phone) {
          const formattedPhone = phone.replace(/\D/g, '');
          if (formattedPhone) {
            const patientName = patient?.nome || patient?.name || 'Paciente';
            const dateStr = format(apptTime, 'dd/MM');
            const timeStr = format(apptTime, 'HH:mm');
            const doctor = dentists.find(d => d.id === appt.dentistId)?.name || 'Especialista';
            const clinic = clinics.find(c => c.id === appt.clinicId);
            const clinicName = clinic?.name || clinics[0]?.name || 'Clínica Principal';
            const locationText = clinic?.address || clinics[0]?.address || '';
            
            const template = localStorage.getItem('whatsapp_template_local') || `Olá, *{nome_paciente}*! Passando para confirmar seu agendamento conosco no dia *{data}* às *{hora}* com Dr(a). *{dentista}*. Por favor, responda se poderá comparecer. Agradecidos!`;
            
            const messageText = template
              .replace(/{nome_paciente}/g, patientName)
              .replace(/{data}/g, dateStr)
              .replace(/{hora}/g, timeStr)
              .replace(/{dentista}/g, doctor)
              .replace(/{clinica}/g, clinicName)
              .replace(/{clínica}/g, clinicName)
              .replace(/{localizacao}/g, locationText)
              .replace(/{localização}/g, locationText);
            
            try {
              const res = await fetch('/api/wa-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formattedPhone, text: messageText })
              });
              if (res.ok) {
                const data = await res.json();
                markReminderAsSent(appt.id);
                newLogs.unshift({
                  id: `${appt.id}-${Date.now()}`,
                  name: patientName,
                  dateStr,
                  timeStr,
                  status: 'success',
                  isSimulated: !!data.simulated,
                  message: messageText
                });
                processedCount++;
              }
            } catch (err) {
              console.error("Erro ao enviar lembrete automático:", err);
            }
          }
        }
      }
    }

    // 2) Disparo de lembretes para agendamentos sincronizados do Google Calendar
    for (const ge of googleEvents) {
      if (sentIds.has(ge.id)) continue;

      const start = ge.start?.dateTime || ge.start?.date;
      if (!start) continue;

      const eventTime = new Date(start);
      // Somente próximas M minutos e agendamento futuro
      if (eventTime > now && eventTime <= targetLimit) {
        const foundPhone = getPhoneForGoogleEvent(ge, patients);
        if (foundPhone) {
          let patientName = ge.summary || 'Paciente';
          for (const p of patients) {
            const pName = (p.nome || p.name || '').toLowerCase();
            if (pName.length > 3 && (ge.summary || '').toLowerCase().includes(pName)) {
              patientName = p.nome || p.name;
              break;
            }
          }

          const dateStr = format(eventTime, 'dd/MM');
          const timeStr = format(eventTime, 'HH:mm');
          const locationText = ge.location ? ` em ${ge.location}` : '';

          // Tentar encontrar o dentista e clinica correspondentes
          const matchingAppt = appointments.find(a => a.googleEventId === ge.id);
          let doctorName = 'Especialista';
          let clinicName = 'Clínica Principal';

          if (matchingAppt) {
            const dentist = dentists.find(d => d.id === matchingAppt.dentistId);
            if (dentist) doctorName = dentist.name;
            const clinic = clinics.find(c => c.id === matchingAppt.clinicId);
            if (clinic) clinicName = clinic.name;
          } else {
            const descLower = (ge.description || '').toLowerCase();
            const summaryLower = (ge.summary || '').toLowerCase();
            
            const matchedDentist = dentists.find(d => {
              const dName = d.name.toLowerCase();
              return dName.length > 3 && (summaryLower.includes(dName) || descLower.includes(dName));
            });
            if (matchedDentist) {
              doctorName = matchedDentist.name;
            } else if (dentists[0]) {
              doctorName = dentists[0].name;
            }

            if (clinics[0]) {
              clinicName = clinics[0].name;
            }
          }
          
          const templateG = localStorage.getItem('whatsapp_template_google') || `Lembrete de consulta sincronizado do Google Calendar! Olá, *{nome_paciente}*, tudo bem? Confirmamos o agendamento de *{titulo_consulta}* para amanhã, *{data}* às *{hora}*{localizacao}. Nos vemos lá!`;

          const messageText = templateG
            .replace(/{nome_paciente}/g, patientName)
            .replace(/{titulo_consulta}/g, ge.summary || 'Consulta')
            .replace(/{data}/g, dateStr)
            .replace(/{hora}/g, timeStr)
            .replace(/{localizacao}/g, locationText)
            .replace(/{localização}/g, locationText)
            .replace(/{dentista}/g, doctorName)
            .replace(/{clinica}/g, clinicName)
            .replace(/{clínica}/g, clinicName);

          try {
            const res = await fetch('/api/wa-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: foundPhone, text: messageText })
            });
            if (res.ok) {
              const data = await res.json();
              markReminderAsSent(ge.id);
              newLogs.unshift({
                id: `${ge.id}-${Date.now()}`,
                name: patientName,
                dateStr,
                timeStr,
                status: 'success',
                isSimulated: !!data.simulated,
                message: messageText
              });
              processedCount++;
            }
          } catch (err) {
            console.error("Erro ao enviar agendamento do Google para o WhatsApp:", err);
          }
        }
      }
    }

    if (newLogs.length > 0) {
      setReminderLogs(prev => {
        const combined = [...newLogs, ...prev];
        return combined.slice(0, 15);
      });
    }

    setCheckingReminders(false);

    if (manual) {
      if (processedCount > 0) {
        alert(`Disparos Concluídos! ${processedCount} lembrete(s) automático(s) enviado(s) com sucesso para as consultas das próximas 24h.`);
      } else {
        alert("Todos os lembretes já foram disparados ou não há consultas agendadas nas próximas 24h.");
      }
    }
  };

  // Disparar verificação de lembretes silenciosa e automática sempre que dados mudarem
  useEffect(() => {
    if (appointments.length > 0 && patients.length > 0) {
      const timer = setTimeout(() => {
        triggerUpcomingReminders(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [appointments, googleEvents, patients]);

  useEffect(() => {
    // Check if we need to reset to today (set by sidebar navigation in App.tsx)
    if (sessionStorage.getItem('agenda_reset_today') === 'true') {
      setViewingDate(startOfToday());
      sessionStorage.removeItem('agenda_reset_today');
    }
  }, []);
  const sentNotifications = useRef<Set<string>>(new Set());
  const syncingEventIds = useRef<Set<string>>(new Set());
  
  const fetchGoogleEvents = async (silent = false) => {
    if (!accessToken) {
      setGoogleEvents([]);
      setHasFetchedGoogle(true);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Usamos cache buster _t para ignorar o cache do navegador e obter atualizações em tempo real
      const resp = await fetch(`/api/calendar/events?accessToken=${accessToken}&_t=${Date.now()}`);
      if (resp.ok) {
        const data = await resp.json();
        
        // No modo demo, mantemos todos os eventos fictícios para a visualização, e no modo real os eventos do Google Agenda
        const events = data || [];
        setGoogleEvents(events);
        setHasFetchedGoogle(true);
      } else {
        let serverErrorText = "";
        try {
          const respClone = resp.clone();
          try {
            const errData = await respClone.json();
            serverErrorText = errData?.error || "";
          } catch (jsonErr) {
            serverErrorText = await resp.text();
          }
        } catch (readErr) {
          console.warn("Failed to read error response content:", readErr);
        }
        console.warn("API de agenda do Google retornou erro (tratado silenciosamente):", serverErrorText || resp.status);
      }
    } catch (err: any) {
      console.warn("Falha de comunicação ao buscar eventos do Google (tratado silenciosamente):", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Mantemos useRef atualizado com a última instância da função para evitar stale closures no setInterval
  const fetchGoogleEventsRef = useRef(fetchGoogleEvents);
  useEffect(() => {
    fetchGoogleEventsRef.current = fetchGoogleEvents;
  });

  useEffect(() => {
    if (accessToken) {
      // Chamada imediata
      fetchGoogleEventsRef.current();

      // Monitoramento periódico a cada minuto (60000ms) de forma silenciosa e resiliente a closures
      const interval = setInterval(() => {
        console.log("Sincronização automática de 1 minuto: atualizando agendamentos do Google Agenda...");
        fetchGoogleEventsRef.current(true);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [accessToken, syncTrigger]);

  useEffect(() => {
    if (accessToken && syncButtonRef.current && sessionStorage.getItem('synced') !== 'true') {
        sessionStorage.setItem('synced', 'true');
        fetchGoogleEvents(true);
    }
  }, [accessToken]);

  // Push automático e inteligente de agendamentos criados localmente para o Google Agenda
  // Controlamos chamadas de concorrência com syncingEventIds para evitar instabilidades e cadastros duplicados
  useEffect(() => {
    if (accessToken && appointments.length > 0 && patients.length > 0 && currentUserId) {
      const unsyncedAppts = appointments.filter(
        appt => appt.ownerId === currentUserId && !appt.googleEventId && !syncingEventIds.current.has(appt.id)
      );

      if (unsyncedAppts.length > 0) {
        console.log(`[Ponta a Ponta] Detectados ${unsyncedAppts.length} agendamentos locais sem sincronização. Integrando com Google Agenda...`);
        unsyncedAppts.forEach(async (appt) => {
          syncingEventIds.current.add(appt.id);
          try {
            const patient = patients.find(p => p.id === appt.patientId);
            const dentist = dentists.find(d => d.id === appt.dentistId);

            const syncRes = await fetch('/api/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken,
                event: {
                  summary: `${patient?.nome || patient?.name || 'Paciente'} - Consulta Dental`,
                  description: `Dentista: ${dentist?.name || ''}`,
                  start: { dateTime: appt.startTime },
                  end: { dateTime: appt.endTime },
                }
              })
            });

            if (syncRes.ok) {
              const createdGoogleEvent = await syncRes.json();
              if (createdGoogleEvent && createdGoogleEvent.id) {
                console.log(`[Ponta a Ponta] Agendamento local ${appt.id} integrado com sucesso ao Google Agenda: ${createdGoogleEvent.id}`);
                await updateDoc(doc(db, 'appointments', appt.id), {
                  googleEventId: createdGoogleEvent.id
                });
              } else {
                syncingEventIds.current.delete(appt.id);
              }
            } else {
              syncingEventIds.current.delete(appt.id);
            }
          } catch (syncErr) {
            console.error(`Erro ao empurrar agendamento para o Google Agenda:`, syncErr);
            syncingEventIds.current.delete(appt.id);
          }
        });
      }
    }
  }, [accessToken, appointments, patients, dentists, currentUserId]);

  // Sincronização inversa: Importa eventos do Google Agenda criados lá fora para o banco local Firestore
  useEffect(() => {
    if (accessToken && accessToken !== 'demo-token' && currentUserId && googleEvents.length > 0) {
      // Filtrar agendamentos locais para ver quais ids do Google já temos salvos no Firestore
      const existingGoogleEventIds = new Set(
        appointments.map(a => a.googleEventId).filter(Boolean)
      );

      // Encontrar eventos do Google de VERDADE que ainda não existem como agendamentos no Firestore
      const newGoogleEventsToImport = googleEvents.filter(
        ge => ge.id && 
              !ge.id.startsWith('demo-') && 
              !existingGoogleEventIds.has(ge.id) &&
              !importingEventIds.current.has(ge.id)
      );

      if (newGoogleEventsToImport.length > 0) {
        console.log(`[Ponta a Ponta] Encontrados ${newGoogleEventsToImport.length} eventos no Google Agenda que não estão no Firestore. Importando...`);
        
        newGoogleEventsToImport.forEach(async (ge) => {
          importingEventIds.current.add(ge.id);
          try {
            const startStr = ge.start?.dateTime || ge.start?.date;
            const endStr = ge.end?.dateTime || ge.end?.date;
            if (!startStr) {
              importingEventIds.current.delete(ge.id);
              return;
            }

            // Tentar cruzar com algum paciente correspondente pelo nome disponível no título ou descrição
            let patientId = 'google';
            let patientDisplayId = 'G-CAL';

            const summaryLower = (ge.summary || '').toLowerCase();
            const descLower = (ge.description || '').toLowerCase();

            const matchedPatient = patients.find(p => {
              const pName = (p.nome || p.name || '').toLowerCase();
              return pName.length > 3 && (summaryLower.includes(pName) || descLower.includes(pName));
            });

            if (matchedPatient) {
              patientId = matchedPatient.id;
              patientDisplayId = getPatientId(matchedPatient);
            }

            // Associar com o dentista e clínica padrão se existirem
            const dentistId = dentists[0]?.id || 'google';
            const clinicId = clinics[0]?.id || 'google';

            const newApptData = {
              tipoAtendimento: ge.summary || 'Evento Google Agenda',
              patientId,
              patientDisplayId,
              dentistId,
              clinicId,
              ownerId: currentUserId,
              startTime: startStr,
              endTime: endStr || new Date(new Date(startStr).getTime() + 3600000).toISOString(),
              status: 'confirmed' as const,
              googleEventId: ge.id,
              location: ge.location || '',
              description: ge.description || '',
              createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'appointments'), newApptData);
            console.log(`[Ponta a Ponta] Evento do Google ${ge.id} importado com sucesso para o banco Firestore.`);
          } catch (err) {
            console.error(`Erro ao importar evento do Google ${ge.id}:`, err);
            importingEventIds.current.delete(ge.id);
          }
        });
      }
    }
  }, [accessToken, googleEvents, appointments, currentUserId, patients, dentists, clinics]);

  useEffect(() => {
      appointments.forEach(appt => {
          if (!sentNotifications.current.has(appt.id)) {
              const patient = patients.find(p => p.id === appt.patientId);
              if (patient && patient.telefone) {
                   // Automatic reminder: send only to future appts
                   if (new Date(appt.startTime) > new Date()) {
                       const message = `Olá ${patient.nome}, lembrete da sua consulta em ${format(new Date(appt.startTime), 'dd/MM')} às ${format(new Date(appt.startTime), 'HH:mm')}. Esperamos você!`;
                       const phone = patient.telefone.replace(/\D/g, '');
                       // Instead of opening, just log for automatic behavior or trigger directly if allowed?
                       // Since the request asks for automatic reminders, I'll log for now and maybe suggest a real integration.
                       // The tool 'sendMessage' actually opens a new tab.
                       console.log(`Automatic notification for ${patient.nome}: ${message}`);
                       // To prevent browser blocking, I won't open multiple tabs automatically, I will assume the user has a proper service or just log.
                       // WAIT, the requirement is "faca com que seja automatico" "nao precisa de botao".
                       // I'll call sendMessage for a few appts? No, it will prompt to open tabs.
                       // I'll just keep the function sendMessage and call it IF the user is on that screen.
                       sentNotifications.current.add(appt.id);
                   }
              }
          }
      });
  }, [appointments, patients]);

  const [newAppt, setNewAppt] = useState({
    patientId: '',
    dentistId: '',
    clinicId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    tipoAtendimento: ''
  });

  const today = startOfToday();

  useEffect(() => {
    let unsubClinics: () => void;
    let unsubDentists: () => void;
    let unsubPatients: () => void;
    let unsubAppts: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Cleanup previous
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubPatients) unsubPatients();
      if (unsubAppts) unsubAppts();

      if (user) {
        setCurrentUserId(user.uid);
        unsubClinics = onSnapshot(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)), (snapshot) => {
          const clinicList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
          setClinics(clinicList);
          if (clinicList.length === 0) setLoading(false);
        });

        unsubDentists = onSnapshot(query(collection(db, 'dentists'), where('ownerId', '==', user.uid)), (snapshot) => {
          setDentists(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dentist)));
        });

        unsubPatients = onSnapshot(query(collection(db, 'pacientes'), where('ownerId', '==', user.uid)), (snapshot) => {
          const loadedPatients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
          console.log("Loaded patients:", loadedPatients);
          setPatients(loadedPatients);
        });

        unsubAppts = onSnapshot(query(collection(db, 'appointments'), where('ownerId', '==', user.uid)), (snapshot) => {
          setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
          setLoading(false);
        });
      } else {
        setCurrentUserId(null);
        setClinics([]);
        setDentists([]);
        setPatients([]);
        setAppointments([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubPatients) unsubPatients();
      if (unsubAppts) unsubAppts();
    };
  }, []);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.clinicId || !newAppt.dentistId || !newAppt.patientId) {
      alert("Preencha todos os campos");
      return;
    }

    setIsSubmitting(true);
    try {
      const startTime = new Date(`${newAppt.date}T${newAppt.time}`).toISOString();
      const endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();
      
      const patient = patients.find(p => p.id === newAppt.patientId);
      const patientDisplayId = getPatientId(patient);

      const apptData = {
        tipoAtendimento: newAppt.tipoAtendimento,
        patientId: newAppt.patientId,
        patientDisplayId,
        dentistId: newAppt.dentistId,
        clinicId: newAppt.clinicId,
        ownerId: auth.currentUser?.uid,
        startTime,
        endTime,
        status: 'pending' as const,
        ...(editingApptId ? {} : { createdAt: serverTimestamp() }),
      };

      let oldGoogleEventId: string | null = null;
      if (editingApptId) {
        const existingAppt = appointments.find(a => a.id === editingApptId);
        if (existingAppt && existingAppt.googleEventId) {
          oldGoogleEventId = existingAppt.googleEventId;
        }
      }

      let docId = editingApptId;
      if (editingApptId) {
        await updateDoc(doc(db, 'appointments', editingApptId), apptData);
      } else {
        const docRef = await addDoc(collection(db, 'appointments'), apptData);
        docId = docRef.id;
      }

      // If we have Google access, sync it
      if (accessToken) {
        try {
          if (oldGoogleEventId) {
            console.log("Removendo evento antigo do Google Agenda antes de recriar:", oldGoogleEventId);
            try {
              await fetch('/api/calendar/events', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  accessToken,
                  eventId: oldGoogleEventId
                })
              });
            } catch (delErr) {
              console.error("Erro ao remover evento antigo na edição:", delErr);
            }
          }

          const patient = patients.find(p => p.id === newAppt.patientId);
          const dentist = dentists.find(d => d.id === newAppt.dentistId);

          const syncRes = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken,
              event: {
                summary: `${patient?.nome || 'Paciente'} - Consulta Dental`,
                description: `Dentista: ${dentist?.name}`,
                start: { dateTime: startTime },
                end: { dateTime: endTime },
              }
            })
          });

          if (syncRes.ok && docId) {
            const createdGoogleEvent = await syncRes.json();
            if (createdGoogleEvent && createdGoogleEvent.id) {
              await updateDoc(doc(db, 'appointments', docId), {
                googleEventId: createdGoogleEvent.id
              });
            }
          }
        } catch (syncErr) {
          console.error("Failed to sync calendar event:", syncErr);
        }
      }

      setIsModalOpen(false);
      setEditingApptId(null);
      setNewAppt({
        patientId: '',
        dentistId: '',
        clinicId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        tipoAtendimento: ''
      });
    } catch (err: any) {
      console.error("Error saving appointment:", err);
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (appt: Appointment) => {
    setEditingApptId(appt.id);
    setNewAppt({
      patientId: appt.patientId,
      dentistId: appt.dentistId,
      clinicId: appt.clinicId,
      date: format(new Date(appt.startTime), 'yyyy-MM-dd'),
      time: format(new Date(appt.startTime), 'HH:mm'),
      tipoAtendimento: appt.tipoAtendimento || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteAction = async (appt: Appointment) => {
    console.log("Delete triggered for appointment ID:", appt.id);
    if (!appt.id) {
       console.error("No appointment ID found!");
       return;
    }
    
    try {
      console.log("Attempting to delete document from firestore...");
      await deleteDoc(doc(db, 'appointments', appt.id));
      console.log("Document successfully deleted from Firestore.");
      
      // Optionally: Try to delete from Google Calendar if appt.googleEventId exists
      if (accessToken && appt.googleEventId) {
            console.log("Attempting to delete from Google Calendar, event ID:", appt.googleEventId);
            await fetch('/api/calendar/events', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  accessToken,
                  eventId: appt.googleEventId
              })
            });
            console.log("Successfully deleted from Google Calendar.");
      } else {
            console.log("No Google Event ID found for this appointment, skipping Google Calendar deletion.");
      }
      
    } catch (err) {
      console.error("Error deleting appointment:", err);
      handleFirestoreError(err, OperationType.DELETE, 'appointments');
    } finally {
        setDeleteConfirmAppt(null); // Close the confirmation modal
    }
  };
  
  const sendMessage = (patient: Patient, message: string) => {
      const phone = patient.telefone.replace(/\D/g, '');
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const getDayEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const activeApptGoogleEventIds = new Set(
      appointments
        .map(a => a.googleEventId)
        .filter(Boolean)
    );
    const deletedSet = new Set(localDeletedGoogleIds);
    
    const appts = appointments.filter(a => {
      // Se for do dia correto, exibe. Agendamentos criados pelo aplicativo não somem automaticamente
      return format(new Date(a.startTime), 'yyyy-MM-dd') === dateStr;
    });

    const gEvents = googleEvents.filter(e => {
      if (deletedSet.has(e.id)) return false;
      if (activeApptGoogleEventIds.has(e.id)) return false; // Evita duplicar agendamentos locais sincronizados!
      const start = e.start?.dateTime || e.start?.date;
      return start && format(new Date(start), 'yyyy-MM-dd') === dateStr;
    });

    return [...appts, ...gEvents.map(ge => ({
      id: ge.id,
      patientId: 'google',
      patientDisplayId: 'G-CAL',
      dentistId: 'google',
      clinicId: 'google',
      startTime: ge.start?.dateTime || ge.start?.date,
      endTime: ge.end?.dateTime || ge.end?.date,
      status: 'confirmed' as const,
      tipoAtendimento: ge.summary || 'Evento Externo',
      isGoogle: true,
      htmlLink: ge.htmlLink,
      calendarName: ge.calendarName || ge.organizer?.displayName || ge.organizer?.email || 'Agenda Principal (Google)',
      location: ge.location,
      description: ge.description
    }))];
  };

  const sortedEvents = getDayEvents(viewingDate).sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div>
          <h3 className="text-2xl font-bold">Agenda Centralizada</h3>
          <p className="text-neutral-500 font-medium">Sincronizada com Google Calendar em tempo real.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 w-full sm:w-auto text-sm sm:text-base"
          >
            <Plus size={20} />
            Agendar Consulta
          </button>
        </div>
      </div>

      {!accessToken && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">Conecte-se com sua conta Google para sincronizar a agenda real nos menus laterais.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Weekly Stream - Outro Modelo de Agenda */}
        <div className="lg:col-span-2 overflow-x-auto pb-6 -mx-2 px-2 hide-scrollbar">
          <div className="flex gap-4 min-w-max">
            {Array.from({ length: 7 }).map((_, i) => {
              const weekStart = startOfWeek(viewingDate, { weekStartsOn: 0 });
              const date = addDays(weekStart, i);
              const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
              const isSelected = format(date, 'yyyy-MM-dd') === format(viewingDate, 'yyyy-MM-dd');
              const dayAppts = getDayEvents(date);
              
              return (
                <div 
                  key={i} 
                  onClick={() => setViewingDate(date)}
                  className={`p-4 rounded-[2rem] border min-w-[130px] transition-all flex items-center gap-4 cursor-pointer ${isSelected ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/10 text-white' : 'bg-white border-neutral-100 hover:border-blue-200'}`}
                >
                  {/* Calendar Sheet Style Date */}
                  <div className={`flex flex-col items-center rounded-xl shadow-xs overflow-hidden min-w-[50px] h-16 shrink-0 border ${isSelected ? 'bg-white border-white/20' : 'bg-white border-neutral-100'}`}>
                    <div className={`${isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'} text-[7px] font-black w-full text-center uppercase tracking-widest py-1 leading-none`}>
                      {format(date, 'MMM', { locale: ptBR })}
                    </div>
                    <div className={`text-lg font-black leading-none py-1.5 ${isSelected ? 'text-blue-600' : 'text-neutral-900'}`}>
                      {format(date, 'dd')}
                    </div>
                    <div className={`text-[7px] font-black w-full text-center border-t py-1 leading-none uppercase ${isSelected ? 'bg-blue-50/50 border-blue-100 text-blue-700' : 'bg-neutral-50 border-neutral-100 text-neutral-400'}`}>
                      {format(date, 'EEE', { locale: ptBR })}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-blue-100' : 'text-neutral-300'}`}>
                      AGENDA
                    </div>
                    <div className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-neutral-500'}`}>
                      {dayAppts.length === 0 ? (
                        <span className="opacity-50 italic">Livre</span>
                      ) : (
                        <span className="font-black underline underline-offset-2 decoration-2 decoration-blue-400">{dayAppts.length} {dayAppts.length === 1 ? 'VAGA' : 'VAGAS'}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Calendar View */}
        <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden h-fit">
          <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-16 rounded-2xl overflow-hidden shadow-sm border border-blue-100 bg-white">
                <div className="bg-blue-600 text-white text-[8px] font-black text-center py-1 uppercase tracking-tighter">
                  {format(viewingDate, 'MMM', { locale: ptBR })}
                </div>
                <div className="text-neutral-900 font-black text-xl text-center py-1.5 leading-none">
                  {format(viewingDate, 'dd', { locale: ptBR })}
                </div>
              </div>
              <div>
                <h4 className="font-black text-neutral-800 text-lg leading-tight">Painel Mensal</h4>
                <p className="text-xs font-bold text-neutral-400 capitalize">{format(viewingDate, 'MMMM yyyy', { locale: ptBR })}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setViewingDate(today)}
                className="p-2.5 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all active:scale-95 text-[10px] font-black text-blue-600 uppercase tracking-widest"
              >
                Hoje
              </button>
            </div>
          </div>
          <div className="w-full p-4 sm:p-6">
            <div className="grid grid-cols-7 mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                <div key={`${day}-${idx}`} className="text-center text-[10px] font-black text-neutral-300 uppercase tracking-widest">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-[45px] sm:auto-rows-[55px] md:auto-rows-[65px]">
               {(() => {
                 const monthStart = startOfMonth(viewingDate);
                 const monthEnd = endOfMonth(monthStart);
                 const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
                 const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
                 
                 const days = [];
                 let currentDay = startDate;
                 while (currentDay <= endDate) {
                   days.push(currentDay);
                   currentDay = addDays(currentDay, 1);
                 }

                 return days.map((date, i) => {
                   const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                   const isSelected = format(date, 'yyyy-MM-dd') === format(viewingDate, 'yyyy-MM-dd');
                   const isCurrentMonth = isSameMonth(date, monthStart);
                   const dayAppts = getDayEvents(date);
     
                   return (
                     <div 
                      key={i} 
                      onClick={() => setViewingDate(date)}
                      className={`rounded-2xl transition-all flex flex-col items-center justify-center relative cursor-pointer group 
                        ${isSelected ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'hover:bg-neutral-50 border border-transparent hover:border-neutral-100'} 
                        ${isToday && !isSelected ? 'ring-2 ring-blue-600 ring-inset' : ''}
                        ${!isCurrentMonth && !isSelected ? 'opacity-20' : ''}`}
                     >
                       <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-neutral-600 group-hover:text-blue-600'}`}>
                         {format(date, 'd')}
                       </span>
                       
                       {dayAppts.length > 0 && (
                         <div className="absolute bottom-1.5 flex gap-0.5">
                           {dayAppts.slice(0, 3).map((_, idx) => (
                             <div key={idx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500 animate-pulse'}`} />
                           ))}
                         </div>
                       )}
                     </div>
                   );
                 });
               })()}
            </div>
          </div>
        </div>

        {/* Timeline List (Improved Space) */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-200 shadow-sm min-h-[500px]">
            <h4 className="font-bold mb-6 flex items-center justify-between text-neutral-800">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                Linha do Tempo
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-blue-100">
                {format(viewingDate, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </h4>
            
            {loading ? (
              <div className="flex justify-center pt-10">
                <Loader2 className="animate-spin text-blue-200" size={24} />
              </div>
            ) : (
              <div className="space-y-4">
                {sortedEvents.length === 0 ? (
                  <p className="text-center py-10 text-sm text-neutral-400 font-medium italic">Nenhuma consulta para esta data.</p>
                ) : (
                  sortedEvents.map((appt: any, idx) => {
                    const patient = patients.find(p => p.id === appt.patientId);
                    const dentist = dentists.find(d => d.id === appt.dentistId);
                    
                    if (appt.isGoogle) {
                      return (
                        <div key={`${appt.id}-${idx}`} className="p-3 sm:p-3.5 rounded-[1.5rem] bg-indigo-50/30 border border-indigo-100 group transition-all shadow-xs overflow-hidden">
                          <div className="flex gap-3 mb-2.5">
                            <div className="flex flex-col items-center bg-white border border-indigo-200 rounded-lg shadow-xs overflow-hidden min-w-[44px] h-fit shrink-0">
                              <div className="bg-indigo-600 text-white text-[7px] font-black w-full text-center uppercase tracking-tighter py-0.5 leading-none">
                                {format(new Date(appt.startTime), "MMM", { locale: ptBR })}
                              </div>
                              <div className="text-sm font-black text-indigo-600 leading-tight py-0.5">
                                {format(new Date(appt.startTime), "dd")}
                              </div>
                              <div className="bg-indigo-50 text-indigo-700 text-[8px] font-black w-full text-center border-t border-indigo-100 font-mono py-0.5 leading-none">
                                {format(new Date(appt.startTime), "HH:mm")}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex items-center justify-between gap-1.5 mb-1">
                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                  <Globe size={10} className="text-indigo-500 shrink-0" />
                                  <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest leading-none truncate" title={appt.calendarName}>
                                    {appt.calendarName || 'Agenda Google'}
                                  </span>
                                </div>
                                {appt.id && (
                                  <span className="text-[7px] font-mono font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-tight" title={`ID do Evento: ${appt.id}`}>
                                    ID: {appt.id.substring(0, 8).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-black text-neutral-900 text-[11px] leading-tight uppercase truncate">
                                {appt.tipoAtendimento}
                              </h4>
                              {appt.description && (
                                <p className="text-[9px] text-neutral-500 mt-1 italic leading-relaxed line-clamp-3 bg-white/50 border border-indigo-50 p-1.5 rounded-lg">
                                  {appt.description}
                                </p>
                              )}
                              {appt.location && (
                                <div className="flex items-center gap-1 mt-1.5 font-bold text-neutral-400">
                                  <MapPin size={9} className="text-indigo-400 shrink-0" />
                                  <span className="text-[9px] text-neutral-600 truncate">{appt.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Ações para Editar / Excluir no Google Calendar */}
                          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-indigo-100/40">
                             <div className="flex gap-1.5 h-7">
                               <a 
                                 href={appt.htmlLink || 'https://calendar.google.com'} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="flex-1 flex items-center justify-center gap-1.5 py-1 text-[8px] font-black bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-100 rounded-lg transition-all uppercase tracking-widest text-center"
                               >
                                 EDITAR NO GOOGLE ↗
                               </a>
                               <button 
                                 onClick={() => setGoogleEventToDelete(appt.id)} 
                                 className="w-10 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all rounded-lg border border-red-100"
                                 title="Remover Agendamento"
                                >
                                  <X size={12} />
                                </button>
                             </div>
                          </div>
                        </div>
                      );
                    }

                    const messages = [
                        `Olá ${patient?.nome}, tudo bem? Estou entrando em contato para reagendar sua consulta técnica. Qual seria um melhor horário?`,
                        `Oi ${patient?.nome}, tivemos um imprevisto na agenda. Podemos realocar seu atendimento?`
                    ];
                    
                    return (
                      <div key={`${appt.id}-${idx}`} className="p-2 sm:p-2.5 rounded-[1.5rem] bg-white border border-neutral-100 group hover:border-blue-200 transition-all shadow-xs overflow-hidden">
                        {/* Cabeçalho Ultra Compacto */}
                        <div className="flex gap-2.5 mb-2">
                          <div className="flex flex-col items-center bg-white border border-blue-200 rounded-lg shadow-xs overflow-hidden min-w-[44px] h-fit shrink-0">
                            <div className="bg-blue-600 text-white text-[7px] font-black w-full text-center uppercase tracking-tighter py-0.5 leading-none">
                              {format(new Date(appt.startTime), "MMM", { locale: ptBR })}
                            </div>
                            <div className="text-sm font-black text-blue-600 leading-tight py-0.5">
                              {format(new Date(appt.startTime), "dd")}
                            </div>
                            <div className="bg-blue-50 text-blue-700 text-[8px] font-black w-full text-center border-t border-blue-100 font-mono py-0.5 leading-none">
                              {format(new Date(appt.startTime), "HH:mm")}
                            </div>
                          </div>
                          
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <h4 className="font-black text-neutral-900 text-[11px] leading-none uppercase truncate mb-1">
                              {patient?.nome || 'Paciente'} 
                              <span className="text-[9px] font-mono font-bold text-neutral-400 ml-2">ID: {getPatientId(patient)}</span>
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <p className="text-[9px] font-bold text-neutral-400 truncate flex items-center">
                                <span className="text-blue-600/40 uppercase text-[7px] mr-1">Dentista:</span> 
                                <span className="text-neutral-600 capitalize">{dentist?.name || 'Não definido'}</span>
                              </p>
                              <div className="flex items-center gap-1 text-[9px] font-bold text-neutral-400">
                                <span className="text-blue-600/40 uppercase text-[7px]">Fone:</span> 
                                <span className="text-neutral-600">{patient?.telefone || '---'}</span>
                                {patient?.telefone && (
                                  <a 
                                    href={`https://wa.me/55${patient.telefone.replace(/\D/g, '')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-green-500 hover:scale-110 transition-transform bg-green-50 p-0.5 rounded"
                                  >
                                    <MessageCircle size={8} />
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            {/* Procedimento movido para cima conforme solicitado */}
                            <div className="mt-1 flex items-center gap-1.5">
                               <span className="text-[7px] font-black text-blue-600/40 uppercase tracking-widest whitespace-nowrap">Procedimento:</span>
                               <p className="text-[9px] font-black text-neutral-800 truncate">{appt.tipoAtendimento || '---'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Ações Compactas e mais altas */}
                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-neutral-50">
                           <div className="flex gap-1.5 h-7">
                             <button 
                               onClick={() => { localStorage.setItem('selectedPatient', patient?.id || ''); onNavigate('patients'); }} 
                               className="flex-1 py-1 text-[8px] font-black bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest border border-blue-100"
                             >
                               PRONTUÁRIO
                             </button>
                             <button 
                               onClick={() => handleEdit(appt)} 
                               className="flex-1 py-1 text-[8px] font-black bg-neutral-50 text-neutral-500 rounded-lg hover:bg-neutral-100 transition-all uppercase tracking-widest border border-neutral-200/50"
                             >
                               RE-AGENDAR
                             </button>
                             <button 
                               onClick={() => setDeleteConfirmAppt(appt)} 
                               className="w-10 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all rounded-lg border border-red-100"
                             >
                               <X size={12} />
                             </button>
                           </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          {/* Módulo Interativo do Agente de Lembretes WhatsApp */}
          <div className="bg-white p-6 sm:p-7 rounded-[2.5rem] border border-neutral-200 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-emerald-500 fill-emerald-50" />
                <h4 className="font-black text-neutral-800 text-[11px] sm:text-[12px] uppercase tracking-wider">Agente Lembretes WhatsApp</h4>
              </div>
              {waStatus === 'connected' ? (
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block mr-0.5" />
                  REAL CONECTADO
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block mr-0.5" />
                  SIMULADOR ATIVO
                </div>
              )}
            </div>

            <p className="text-[11px] font-bold text-neutral-500 leading-relaxed mb-4">
              Monitorando consultas (Agenda e Google Calendar) nas próximas <span className="text-neutral-800 font-extrabold underline decoration-emerald-400 decoration-2">24 horas</span>. O agente dispara os lembretes automaticamente em segundo plano.
            </p>

            <button 
              onClick={() => triggerUpcomingReminders(true)}
              disabled={checkingReminders}
              className={`w-full py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2
                ${checkingReminders 
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10 hover:shadow-lg'}`}
            >
              {checkingReminders ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Buscando e Disparando...
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  Verificar e Disparar Manualmente
                </>
              )}
            </button>

            {/* Logs de Lembretes Enviados */}
            <div className="mt-5 pt-4 border-t border-neutral-100">
              <h5 className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span>HISTÓRICO ÚLTIMOS DISPAROS ({reminderLogs.length})</span>
                {reminderLogs.length > 0 && (
                  <button 
                    onClick={() => { setReminderLogs([]); localStorage.removeItem('agenda_reminder_logs'); }}
                    className="text-[8px] text-neutral-400 hover:text-red-500 transition-colors underline uppercase font-bold"
                  >
                    Limpar
                  </button>
                )}
              </h5>
              
              {reminderLogs.length === 0 ? (
                <div className="text-center py-4 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-100">
                  <p className="text-[9px] text-neutral-400 font-bold italic uppercase tracking-wider">Nenhum lembrete automático disparado ainda.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {reminderLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-2 bg-neutral-50 border border-neutral-100 rounded-xl hover:border-neutral-200 transition-all flex items-center justify-between gap-3"
                      title={log.message}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-extrabold text-neutral-800 text-[10px] truncate leading-none capitalize">
                            {log.name}
                          </span>
                          <span className="text-[8px] text-neutral-400 leading-none">
                            ({log.dateStr} às {log.timeStr})
                          </span>
                        </div>
                        <p className="text-[8px] text-neutral-500 truncate italic pr-1">{log.message}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {log.isSimulated ? (
                          <span className="text-[7px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-mono">
                            Simulado
                          </span>
                        ) : (
                          <span className="text-[7px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded uppercase font-mono">
                            WhatsApp
                          </span>
                        )}
                        <span className="text-[10px] text-emerald-500 font-extrabold">✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl p-5 sm:p-8 max-h-[92vh] overflow-y-auto focus:outline-none"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold">Agendar Consulta</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleCreateAppointment} className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Clínica</label>
                  <select 
                    required
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-900"
                    value={newAppt.clinicId}
                    onChange={(e) => setNewAppt({...newAppt, clinicId: e.target.value})}
                  >
                    <option value="">Selecione a Unidade</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Paciente</label>
                    <select 
                      required
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-900"
                      value={newAppt.patientId}
                      onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})}
                    >
                      <option value="">Paciente</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id} className="text-neutral-900">
                          {p.nome} ({getPatientId(p)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Dentista</label>
                    <select 
                      required
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-900"
                      value={newAppt.dentistId}
                      onChange={(e) => setNewAppt({...newAppt, dentistId: e.target.value})}
                    >
                      <option value="">Dentista</option>
                      {dentists.filter(d => d.clinicId === newAppt.clinicId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Data</label>
                    <input 
                      required
                      type="date"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                      value={newAppt.date}
                      onChange={(e) => setNewAppt({...newAppt, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Horário</label>
                    <input 
                      required
                      type="time"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                      value={newAppt.time}
                      onChange={(e) => setNewAppt({...newAppt, time: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-widest">Tipo de Atendimento</label>
                  <select 
                    required
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-900"
                    value={newAppt.tipoAtendimento}
                    onChange={(e) => setNewAppt({...newAppt, tipoAtendimento: e.target.value})}
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="Primeiro Atendimento">Primeiro Atendimento</option>
                    <option value="Facetas/Lentes">Facetas/Lentes</option>
                    <option value="Radiografia">Radiografia</option>
                    <option value="Tratamento Canal">Tratamento Canal</option>
                    <option value="Clareamento">Clareamento</option>
                    <option value="HOF">HOF</option>
                  </select>
                </div>

                <button 
                  disabled={isSubmitting || clinics.length === 0}
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
               >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar Agendamento'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Confirmação de exclusão */}
        {deleteConfirmAppt && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Confirmar Exclusão</h3>
              <p className="text-neutral-600 mb-8">Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita e removerá o evento do Google Agenda se estiver sincronizado.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirmAppt(null)}
                  className="flex-1 py-3 font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteAction(deleteConfirmAppt)}
                  className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
                >
                  Confirmar Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirmação de exclusão para Google Event */}
        {googleEventToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Confirmar Exclusão</h3>
              <p className="text-neutral-600 mb-8">Deseja realmente remover este agendamento sincronizado do Google Agenda?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setGoogleEventToDelete(null)}
                  className="flex-1 py-3 font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    const eventId = googleEventToDelete;
                    setGoogleEventToDelete(null);
                    await handleDeleteGoogleEvent(eventId);
                  }}
                  className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
                >
                  Confirmar Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


