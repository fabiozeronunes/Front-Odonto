import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  MessageCircle, 
  Phone,
  Plus,
  Loader2,
  X,
  User,
  Edit2,
  Trash2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, serverTimestamp, deleteDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { Patient, Clinic } from '../types';
import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';

const columns = [
  { id: 'lead', title: 'Leads Captados', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Em Atendimento', color: 'bg-amber-500' },
  { id: 'scheduled', title: 'Consulta Marcada', color: 'bg-emerald-500' },
  { id: 'lost', title: 'Perdidos', color: 'bg-neutral-400' },
];

export default function CRM({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any | null>(null);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dynamic stages state with localStorage loading
  const [stages, setStages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('wa_crm_funnel_stages');
      return saved ? JSON.parse(saved) : columns;
    } catch (e) {
      return columns;
    }
  });

  const updateStages = (newStages: any[]) => {
    setStages(newStages);
    localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(newStages));
    // Optionally sync with firestore if needed, but the requirement is to fix persistence
  };

  const getBgColorClass = (colorStr: string) => {
    if (!colorStr) return 'bg-blue-500';
    return colorStr.split(' ')[0] || 'bg-blue-500';
  };

  // Drag and drop states
  const [draggedStageIdx, setDraggedStageIdx] = useState<number | null>(null);
  const [draggedPatientId, setDraggedPatientId] = useState<string | null>(null);

  const handleDragStageStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', 'stage_' + index);
    setDraggedStageIdx(index);
  };

  const handleDragPatientStart = (e: any, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', 'patient_' + id);
    setDraggedPatientId(id);
  };

  const handleDropStage = async (e: React.DragEvent, targetIndex: number) => {
    let sourceIdx = draggedStageIdx;
    
    // Fallback if state is null but transfer data exists
    if (sourceIdx === null) {
      const data = e.dataTransfer.getData('text/plain');
      if (data.startsWith('stage_')) {
        const parsed = parseInt(data.replace('stage_', ''), 10);
        if (!isNaN(parsed)) sourceIdx = parsed;
      }
    }

    if (sourceIdx === null || sourceIdx === targetIndex) return;
    
    const reordered = [...stages];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIndex, 0, moved);
    
    // Update state to force re-render
    updateStages([...reordered]);
    setDraggedStageIdx(null);

    // Save locally
    try {
      localStorage.setItem('wa_crm_funnel_stages', JSON.stringify(reordered));
    } catch (err) {
      console.error("Erro ao salvar ordem das etapas localmente:", err);
    }

    // Update in Firestore
    if (auth.currentUser) {
      try {
        for (let i = 0; i < reordered.length; i++) {
          const stage = reordered[i];
          if (stage.id) {
            await updateDoc(doc(db, 'funnel_stages', stage.id), {
              order: i
            });
          }
        }
      } catch (err) {
        console.error("Erro ao reordenar etapas no Firestore:", err);
      }
    }
  };

  const handleDropPatient = async (e: React.DragEvent, targetStageId: string) => {
    let patientId = draggedPatientId;

    // Fallback if state is null but transfer data exists
    if (!patientId) {
      const data = e.dataTransfer.getData('text/plain');
      if (data.startsWith('patient_')) {
        patientId = data.replace('patient_', '');
      }
    }

    if (!patientId) return;
    
    // Immediate visual update
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, status: targetStageId as any } : p));
    setDraggedPatientId(null);

    try {
      await updateDoc(doc(db, 'pacientes', patientId), {
        status: targetStageId,
        lastContactAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const handleColumnDrop = (e: React.DragEvent, columnId: string, colIndex: number) => {
    e.preventDefault();
    if (draggedStageIdx !== null) {
      handleDropStage(e, colIndex);
    } else if (draggedPatientId !== null) {
      handleDropPatient(e, columnId);
    } else {
      // General fallback using dataTransfer
      const data = e.dataTransfer.getData('text/plain');
      if (data.startsWith('stage_')) {
        handleDropStage(e, colIndex);
      } else {
        handleDropPatient(e, columnId);
      }
    }
  };

  const isMatchStage = (ptStatus: string, columnId: string) => {
    if (!ptStatus) return false;
    return ptStatus === columnId || columnId.endsWith(`_${ptStatus}`) || ptStatus.endsWith(`_${columnId}`);
  };

  const addStage = () => {
    if (!newStageTitle.trim()) return;
    
    if (editingStage) {
      const updated = stages.map(s => s.id === editingStage.id ? { ...s, title: newStageTitle.trim() } : s);
      updateStages(updated);
      
      // Update in Firestore
      if (auth.currentUser) {
        updateDoc(doc(db, 'funnel_stages', editingStage.id), {
          title: newStageTitle.trim()
        }).catch(err => console.error("Error updating stage:", err));
      }
      
      setEditingStage(null);
    } else {
      const newStage = {
          id: `stage_${Date.now()}`,
          title: newStageTitle.trim(),
          color: 'bg-neutral-500',
          order: stages.length
      };
      
      const updated = [...stages, newStage];
      updateStages(updated);
      
      // Create in Firestore
      if (auth.currentUser) {
        const stageRef = doc(collection(db, 'funnel_stages'), `${auth.currentUser.uid}_${newStage.id}`);
        setDoc(stageRef, {
          title: newStage.title,
          color: newStage.color,
          order: newStage.order,
          ownerId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        }).catch(err => console.error("Error creating stage:", err));
      }
    }
    
    setIsStageModalOpen(false);
    setNewStageTitle('');
  };

  const deleteStage = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta etapa? Pacientes nesta etapa serão movidos para a primeira etapa disponível.")) return;
    
    const targetStage = stages.find(s => s.id === id);
    if (!targetStage) return;

    const filteredStages = stages.filter(s => s.id !== id);
    const defaultStageId = filteredStages[0]?.id || 'lead';

    // Move patients in this stage to the first available stage
    const pToMove = patients.filter(p => isMatchStage(p.status, id));
    for (const p of pToMove) {
      await handleUpdateStatus(p.id, defaultStageId);
    }

    updateStages(filteredStages);

    // Delete in Firestore
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'funnel_stages', id));
      } catch (err) {
        console.error("Error deleting stage from Firestore:", err);
      }
    }
  };

  // Form State
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', clinicId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chartData = stages.map(stage => ({
    name: stage.title,
    leads: patients.filter(p => p && (p.status || 'lead') === stage.id).length
  }));

  useEffect(() => {
    let unsubClinics: () => void;
    let unsubPacientes: () => void;
    let unsubFunnelStages: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Cleanup previous listeners
      if (unsubClinics) unsubClinics();
      if (unsubPacientes) unsubPacientes();
      if (unsubFunnelStages) unsubFunnelStages();
      
      if (user) {
        const clinicsQuery = query(collection(db, 'clinics'), where('ownerId', '==', user.uid));
        unsubClinics = onSnapshot(clinicsQuery, (snapshot) => {
          const clinicList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
          setClinics(clinicList);
          if (clinicList.length === 0) setLoading(false);
        }, (error) => {
          console.error("Error loading clinics in CRM:", error);
          handleFirestoreError(error, OperationType.LIST, 'clinics');
          setLoading(false);
        });

        const q = query(collection(db, 'pacientes'));
        unsubPacientes = onSnapshot(q, (ptSnapshot) => {
          setPatients(ptSnapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, status: data.status || 'lead' } as Patient;
          }));
          setLoading(false);
        }, (error) => {
          console.error("Error loading pacientes in CRM:", error);
          handleFirestoreError(error, OperationType.LIST, 'pacientes');
          setLoading(false);
        });

        // Load dynamic stages synced from db
        const funnelStagesQuery = query(collection(db, 'funnel_stages'), where('ownerId', '==', user.uid));
        unsubFunnelStages = onSnapshot(funnelStagesQuery, (snapshot) => {
          const loadedStages = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              color: getBgColorClass(data.color),
              order: data.order ?? 0,
              originalColor: data.color
            };
          });
          if (loadedStages.length > 0) {
            loadedStages.sort((a, b) => a.order - b.order);
            updateStages(loadedStages);
          } else {
            updateStages(columns);
          }
        });
      } else {
        setClinics([]);
        setPatients([]);
        try {
          const saved = localStorage.getItem('wa_crm_funnel_stages');
          if (saved) {
            updateStages(JSON.parse(saved));
          } else {
            updateStages(columns);
          }
        } catch (e) {
          updateStages(columns);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubPacientes) unsubPacientes();
      if (unsubFunnelStages) unsubFunnelStages();
    };
  }, []);

  const handleUpdateStatus = async (patientId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'pacientes', patientId), {
        status: newStatus,
        lastContactAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const handleDeleteLead = async (e: React.MouseEvent, patientId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!patientId) return;

    if (!window.confirm("Deseja realmente excluir este lead permanentemente?")) return;
    
    // Optimistic local update
    setPatients(prev => prev.filter(p => p?.id !== patientId));

    try {
      await deleteDoc(doc(db, 'pacientes', patientId));
    } catch (error) {
      console.error("Error deleting lead:", error);
      alert("Erro ao excluir do banco de dados. Tente novamente.");
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.clinicId) {
      alert("Selecione uma clínica");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'pacientes'), {
        ...newLead,
        ownerId: auth.currentUser?.uid,
        status: 'lead',
        lastContactAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setNewLead({ name: '', phone: '', email: '', clinicId: '' });
    } catch (error) {
      console.error("Error creating lead:", error);
      handleFirestoreError(error, OperationType.CREATE, 'pacientes');
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p && (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (p.phone || '').includes(searchTerm || '')
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
        <h3 className="font-semibold text-neutral-800 mb-4">Pipeline de Leads</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: '#f5f5f5'}} />
              <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar paciente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 font-medium transition-colors text-sm">
            <Filter size={18} />
            Filtros
          </button>
          <button 
            onClick={() => setIsStageModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-200 font-bold transition-all text-sm"
          >
            <Plus size={18} />
            Nova Etapa
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 text-sm"
          >
            <Plus size={18} />
            Novo Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="flex gap-6 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 flex-wrap select-none min-h-[600px]">
          {stages.map((column, colIdx) => (
            <motion.div 
              layout
              key={column.id} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleColumnDrop(e, column.id, colIdx)}
              className="space-y-4 shrink-0 w-[290px] sm:w-[320px] transition-all duration-300 border border-transparent rounded-2xl p-1"
            >
              <div 
                draggable
                onDragStart={(e) => handleDragStageStart(e, colIdx)}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-neutral-50 rounded-xl cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-neutral-200/60"
                title="Arraste por este cabeçalho para reordenar a etapa"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color || 'bg-blue-500'}`} />
                  <h4 className="font-extrabold text-xs text-neutral-500 uppercase tracking-wider">{column.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingStage(column);
                      setNewStageTitle(column.title);
                      setIsStageModalOpen(true);
                    }}
                    className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-blue-500 rounded"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteStage(column.id);
                    }}
                    className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-red-500 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                  <span className="text-xs font-black text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full ml-1">
                    {filteredPatients.filter(p => isMatchStage(p.status, column.id)).length}
                  </span>
                </div>
              </div>

              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropPatient(e, column.id)}
                className="bg-neutral-100/50 p-3 rounded-2xl min-h-[500px] space-y-3 border border-dashed border-neutral-200 hover:bg-neutral-100/80 transition-all duration-150"
              >
                {filteredPatients.filter(p => p && p.status && isMatchStage(p.status, column.id)).map((patient, idx) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={patient.id} 
                    draggable
                    onDragStart={(e) => handleDragPatientStart(e, patient.id)}
                    className="bg-white p-4 rounded-xl shadow-xs border border-neutral-200 cursor-grab active:cursor-grabbing group hover:border-blue-400 hover:shadow-xs transition-all duration-150"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-bold text-neutral-800 text-xs sm:sm">{patient.name}</h5>
                        <p className="text-[10px] text-neutral-400 font-medium">{patient.phone}</p>
                      </div>
                      <div className="flex gap-1">
                        {stages.filter(c => !isMatchStage(patient.status, c.id)).map(c => (
                           <button 
                            key={c.id}
                            onClick={() => handleUpdateStatus(patient.id, c.id)}
                            className={`w-2 h-2 rounded-full ${c.color || 'bg-blue-500'} opacity-30 hover:opacity-100 transition-opacity`}
                            title={`Mover para ${c.title}`}
                           />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold py-0.5 px-2 bg-blue-50 text-blue-600 rounded-md">
                        {clinics.find(c => c.id === patient.clinicId)?.name || 'Clínica não encontrada'}
                      </span>
                      {patient.interestedIn && patient.interestedIn.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="text-[9px] font-extrabold py-0.5 px-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                          {tag}
                        </span>
                      ))}
                      {patient.source && (
                        <span className={`text-[9px] font-black py-0.5 px-2 rounded-lg text-white uppercase select-none ${
                          patient.source === 'Facebook' ? 'bg-[#1877F2]' :
                          patient.source === 'Google Ads' ? 'bg-[#4285F4]' :
                          patient.source === 'TikTok' ? 'bg-black' :
                          patient.source === 'whatsapp_real' ? 'bg-[#128C7E]' :
                          'bg-neutral-600'
                        }`}>
                          {patient.source === 'whatsapp_real' ? 'WhatsApp' : patient.source}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-50">
                      <div className="flex -space-x-2">
                        <button 
                          onClick={async () => {
                            if (patient.phone) {
                              // Ensure number has country code (default to 55 if missing and looks like BR number)
                              let cleanPhone = patient.phone.replace(/\D/g, '');
                              if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
                                cleanPhone = '55' + cleanPhone;
                              }
                              const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

                              // Ensure persistence before navigation
                              try {
                                await updateDoc(doc(db, 'pacientes', patient.id), {
                                  lastContactAt: serverTimestamp(),
                                  phone: jid // Store as JID for better integration
                                });
                                console.log("Updated patient lastContactAt and JID before redirect:", patient.id);
                              } catch (err) {
                                console.error("Error updating patient before redirect:", err);
                              }
                              
                              localStorage.setItem('wa_active_chat_id', jid);
                              localStorage.setItem('wa_whatsapp_jump_to_chat', JSON.stringify({ 
                                phone: jid, 
                                name: patient.name,
                                source: patient.source || 'CRM'
                              }));
                              onNavigate('whatsapp');
                            }
                          }}
                          className="p-1.5 rounded-full bg-neutral-50 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 transition-colors border-2 border-white"
                        >
                          <MessageCircle size={14} />
                        </button>
                        <button className="p-1.5 rounded-full bg-neutral-50 text-neutral-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors border-2 border-white">
                          <Phone size={14} />
                        </button>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold uppercase">
                        {patient.lastContactAt ? 'Ativo' : 'Novo'}
                      </span>
                      <button 
                        onClick={(e) => handleDeleteLead(e, patient.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        draggable="false"
                        onDragStart={(e) => e.stopPropagation()}
                        className="text-[10px] text-red-500 hover:text-red-700 underline font-bold uppercase transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Lead */}
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
                <h3 className="text-xl sm:text-2xl font-bold">Cadastrar Novo Lead</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2 uppercase tracking-wide">Clínica</label>
                  <select 
                    required
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newLead.clinicId}
                    onChange={(e) => setNewLead({...newLead, clinicId: e.target.value})}
                  >
                    <option value="">Selecione uma clínica</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2 uppercase tracking-wide">Nome do Paciente</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: João da Silva"
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2 uppercase tracking-wide">WhatsApp</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="(00) 00000-0000"
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2 uppercase tracking-wide">E-mail (Opcional)</label>
                  <input 
                    type="email" 
                    placeholder="email@exemplo.com"
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                  />
                </div>

                <button 
                  disabled={isSubmitting || clinics.length === 0}
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
               >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Cadastrar Lead'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Stage */}
      <AnimatePresence>
        {isStageModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStageModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-bold mb-4">{editingStage ? 'Editar Etapa' : 'Adicionar Etapa'}</h3>
              <input 
                autoFocus
                type="text" 
                placeholder="Título da etapa"
                className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl mb-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                value={newStageTitle}
                onChange={(e) => setNewStageTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStage()}
              />
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => {
                    setIsStageModalOpen(false);
                    setEditingStage(null);
                    setNewStageTitle('');
                  }} 
                  className="px-4 py-2 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={addStage} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {editingStage ? 'Salvar Edição' : 'Salvar Etapa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

