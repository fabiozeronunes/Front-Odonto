import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, Calendar, Edit2, Trash2, Loader2, X, DollarSign, Building2, Stethoscope, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp, updateDoc } from '../lib/supabaseAdapter';
import { Procedure, Dentist, Clinic } from '../types';
import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';

interface ProcedureManagerProps {
  setActiveTab?: (tab: string) => void;
}

export default function ProcedureManager({ setActiveTab }: ProcedureManagerProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form State
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [formData, setFormData] = useState({
    category: 'Clínica Geral',
    type: '',
    value: '',
    dentistId: 'geral',
    clinicId: 'geral',
    registrationDate: new Date().toISOString().substring(0, 16) // Format: YYYY-MM-DDTHH:mm
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Common pre-defined procedure types for suggestions
  const commonProcedureTypes = [
    'Limpeza Profilaxia',
    'Tratamento de Canal (Endodontia)',
    'Restauração de Resina',
    'Extração Simples',
    'Clareamento Dental',
    'Implante Dentário',
    'Aparelho Ortodôntico (Manutenção)',
    'Prótese Dentária',
    'Aplicação de Flúor',
    'Tratamento de Gengiva (Periodontia)'
  ];

  useEffect(() => {
    let unsubClinics: () => void;
    let unsubDentists: () => void;
    let unsubProcedures: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Cleanup previous standard snapshot listeners
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubProcedures) unsubProcedures();

      setCurrentUser(user);

      if (user) {
        // Load Clinics
        unsubClinics = onSnapshot(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)), (snapshot) => {
          const clinicList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
          setClinics(clinicList);
        }, (error) => {
          console.error("Error loading clinics for procedures:", error);
          handleFirestoreError(error, OperationType.LIST, 'clinics');
        });

        // Load Dentists
        unsubDentists = onSnapshot(query(collection(db, 'dentists'), where('ownerId', '==', user.uid)), (snapshot) => {
          const dentistList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dentist));
          setDentists(dentistList);
        }, (error) => {
          console.error("Error loading dentists for procedures:", error);
          handleFirestoreError(error, OperationType.LIST, 'dentists');
        });

        // Load Procedures
        unsubProcedures = onSnapshot(query(collection(db, 'procedures'), where('ownerId', '==', user.uid)), (snapshot) => {
          const procedureList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Procedure));
          setProcedures(procedureList);
          setLoading(false);
        }, (error) => {
          console.error("Error loading procedures:", error);
          handleFirestoreError(error, OperationType.LIST, 'procedures');
          setLoading(false);
        });
      } else {
        setClinics([]);
        setDentists([]);
        setProcedures([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubProcedures) unsubProcedures();
    };
  }, []);

  const handleOpenModal = (procedure?: Procedure) => {
    setFormError(null);
    if (procedure) {
      setEditingProcedure(procedure);
      setFormData({
        category: procedure.category || 'Clínica Geral',
        type: procedure.type || '',
        value: procedure.value !== undefined && procedure.value !== null ? procedure.value.toString() : '',
        dentistId: procedure.dentistId || 'geral',
        clinicId: procedure.clinicId || 'geral',
        registrationDate: procedure.registrationDate ? procedure.registrationDate.substring(0, 16) : new Date().toISOString().substring(0, 16)
      });
    } else {
      setEditingProcedure(null);
      setFormData({
        category: 'Clínica Geral',
        type: '',
        value: '',
        dentistId: 'geral',
        clinicId: 'geral',
        registrationDate: new Date().toISOString().substring(0, 16)
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!formData.type || !formData.type.trim()) {
      setFormError("Insira ou selecione um tipo de procedimento");
      return;
    }
    
    const uid = auth.currentUser?.uid || currentUser?.uid;
    if (!uid) {
      setFormError("Erro: Usuário não autenticado. Sua sessão pode ter expirado. Faça login novamente.");
      return;
    }

    setIsSubmitting(true);

    try {
      const path = editingProcedure ? `procedures/${editingProcedure.id}` : 'procedures';
      
      // Resilient value conversion to prevent undefined.replace() TypeError
      const rawValue = String(formData.value || '').trim();
      const numericValue = parseFloat(rawValue.replace(',', '.')) || 0;

      // Convert browser date format (YYYY-MM-DDTHH:mm) to complete ISO string
      let formattedRegDate = formData.registrationDate;
      if (formattedRegDate) {
        try {
          const parsedDate = new Date(formData.registrationDate);
          if (!isNaN(parsedDate.getTime())) {
            formattedRegDate = parsedDate.toISOString();
          }
        } catch (e) {
          console.warn("Could not convert registration date to ISO format, saving raw value", e);
        }
      } else {
        formattedRegDate = new Date().toISOString();
      }

      const dataToSave = {
        type: formData.type.trim(),
        category: formData.category || 'Clínica Geral',
        value: numericValue,
        dentistId: formData.dentistId || 'geral',
        clinicId: formData.clinicId || 'geral',
        registrationDate: formattedRegDate,
        ownerId: uid,
      };

      if (editingProcedure) {
        await updateDoc(doc(db, 'procedures', editingProcedure.id), {
          ...dataToSave,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'procedures'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingProcedure(null);
      // Reset form fields
      setFormData({
        category: 'Clínica Geral',
        type: '',
        value: '',
        dentistId: 'geral',
        clinicId: 'geral',
        registrationDate: new Date().toISOString().substring(0, 16)
      });
    } catch (error) {
      console.error("Save error for procedure:", error);
      const pathError = editingProcedure ? `procedures/${editingProcedure.id}` : 'procedures';
      handleFirestoreError(error, editingProcedure ? OperationType.UPDATE : OperationType.CREATE, pathError);
      setFormError("Não foi possível salvar o procedimento. Detalhes: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'procedures', id));
      setDeletingId(null);
    } catch (error) {
      console.error("Delete error for procedure:", error);
      handleFirestoreError(error, OperationType.DELETE, `procedures/${id}`);
      setDeletingId(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Data indisponível';
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Dynamic list of procedure types including default ones and custom ones logged by the user
  const dynamicProcedureTypes = Array.from(new Set([
    ...commonProcedureTypes,
    ...procedures.map(p => p.type).filter(Boolean)
  ]));

  // Filter dentists belonging to the currently selected clinic in the form
  const availableDentistsInForm = formData.clinicId && formData.clinicId !== 'geral'
    ? dentists.filter(d => d.clinicId === formData.clinicId)
    : dentists;

  const filteredProcedures = procedures.filter(p => {
    const typeLower = (p.type || '').toLowerCase();
    const dentistName = dentists.find(d => d.id === p.dentistId)?.name || '';
    const clinicName = clinics.find(c => c.id === p.clinicId)?.name || '';
    return typeLower.includes(searchTerm.toLowerCase()) ||
           dentistName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           clinicName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {setActiveTab && (
        <button 
          onClick={() => setActiveTab('specialties')}
          className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-blue-600 transition-colors uppercase tracking-widest bg-white border border-neutral-200 px-4 py-2 rounded-xl shadow-xs hover:shadow-sm"
        >
          <span>← Voltar para Cadastrar Especialidades</span>
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por tipo, dentista, clínica..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 w-full sm:w-auto text-sm sm:text-base"
        >
          <Plus size={20} />
          Novo Procedimento
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="block sm:hidden space-y-4">
            {filteredProcedures.map((proc) => {
              const dentist = dentists.find(d => d.id === proc.dentistId);
              const clinic = clinics.find(c => c.id === proc.clinicId);
              return (
                <div key={proc.id} className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-sm space-y-4">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                      <ClipboardList size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-neutral-900 leading-snug break-words">{proc.type}</p>
                      <span className="inline-block text-[10px] font-bold uppercase py-0.5 px-2 bg-neutral-100 text-neutral-600 rounded-md mt-1">
                        {proc.category || 'Clínica Geral'}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes do Procedimento */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-y border-neutral-100 py-3">
                    <div className="space-y-0.5 col-span-2">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Valor</span>
                      <p className="font-mono font-bold text-blue-600 text-base">
                        {formatCurrency(proc.value)}
                      </p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Building2 size={11} className="shrink-0" /> Clínica
                      </span>
                      <p className="font-bold text-neutral-700 truncate">
                        {clinic ? clinic.name : (proc.clinicId === 'geral' || !proc.clinicId ? 'Geral' : 'Clínica não encontrada')}
                      </p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Stethoscope size={11} className="shrink-0" /> Dentista
                      </span>
                      <p className="font-semibold text-neutral-500 truncate">
                        {dentist ? dentist.name : (proc.dentistId === 'geral' || !proc.dentistId ? 'Geral' : 'Dentista não encontrado')}
                      </p>
                    </div>
                    <div className="space-y-1 col-span-2 min-w-0">
                      <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Calendar size={11} className="shrink-0" /> Cadastrado em
                      </span>
                      <p className="font-medium text-neutral-500">
                        {formatDate(proc.registrationDate)}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button 
                      onClick={() => handleOpenModal(proc)}
                      className="p-2.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200 rounded-xl text-neutral-600 hover:text-blue-600 transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Editar Procedimento"
                    >
                      <Edit2 size={14} />
                      <span>Editar</span>
                    </button>
                    {deletingId === proc.id ? (
                      <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight">Certeza?</span>
                        <button 
                          onClick={() => handleDelete(proc.id)}
                          className="text-xs font-bold text-red-700 hover:underline"
                        >
                          Sim
                        </button>
                        <button 
                          onClick={() => setDeletingId(null)}
                          className="text-xs font-bold text-neutral-500 hover:underline"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeletingId(proc.id)}
                        className="p-2.5 bg-neutral-50 hover:bg-red-50/80 border border-neutral-200 rounded-xl text-neutral-600 hover:text-red-600 transition-all flex items-center gap-1.5 text-xs font-bold"
                        title="Excluir Procedimento"
                      >
                        <Trash2 size={14} />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden sm:block bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-neutral-50/50 border-b border-neutral-100">
                  <tr>
                    <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Tipo do Procedimento</th>
                    <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Valor</th>
                    <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Responsáveis</th>
                    <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data de Cadastro</th>
                    <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredProcedures.map((proc) => {
                    const dentist = dentists.find(d => d.id === proc.dentistId);
                    const clinic = clinics.find(c => c.id === proc.clinicId);
                    return (
                      <tr key={proc.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                              <ClipboardList size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900">{proc.type}</p>
                              <span className="text-[11px] font-bold uppercase py-0.5 px-2 bg-neutral-100 text-neutral-500 rounded-md">
                                {proc.category || 'Clínica Geral'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-mono font-bold text-neutral-900 text-base">
                            {formatCurrency(proc.value)}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-700 font-semibold">
                              <Building2 size={13} className="text-neutral-400" />
                              <span>{clinic ? clinic.name : (proc.clinicId === 'geral' || !proc.clinicId ? 'Geral' : 'Clínica não encontrada')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                              <Stethoscope size={13} className="text-neutral-400" />
                              <span>{dentist ? dentist.name : (proc.dentistId === 'geral' || !proc.dentistId ? 'Geral' : 'Dentista não encontrado')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                            <Calendar size={14} className="text-neutral-400" />
                            <span>{formatDate(proc.registrationDate)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenModal(proc)}
                              className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-blue-600 transition-all"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            {deletingId === proc.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Tem certeza?</span>
                                <button 
                                  onClick={() => handleDelete(proc.id)}
                                  className="text-xs font-bold text-red-600 hover:underline"
                                >
                                  Sim
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="text-xs font-bold text-neutral-400 hover:underline"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setDeletingId(proc.id)}
                                className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-red-600 transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredProcedures.length === 0 && (
            <div className="p-20 text-center text-neutral-400 bg-white rounded-3xl sm:rounded-[2rem] border border-neutral-200 shadow-sm w-full">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum procedimento encontrado.</p>
            </div>
          )}
        </div>
      )}

      <div className="p-6 sm:p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
            <Shield className="text-blue-600" size={32} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-blue-900">Gestão de Tabela de Preços</h4>
            <p className="text-blue-700/70 text-sm font-medium max-w-xl">Gerencie os principais procedimentos oferecidos em suas clínicas. Defina seus respectivos valores e filtre por clínicas ou dentistas específicos.</p>
          </div>
        </div>
      </div>

      {/* Modal / Formulario */}
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
              className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl p-5 sm:p-8 overflow-y-auto max-h-[92vh] focus:outline-none"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">{editingProcedure ? 'Editar Procedimento' : 'Adicionar Procedimento'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {formError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <p>{formError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Selecione a Clínica</label>
                  <select 
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    value={formData.clinicId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      // When changing clinic, clear dentist if they don't belong to the newly selected clinic
                      const dentistBelongs = dentists.some(d => d.id === formData.dentistId && d.clinicId === cid);
                      setFormData({
                        ...formData,
                        clinicId: cid,
                        dentistId: dentistBelongs ? formData.dentistId : 'geral'
                      });
                    }}
                  >
                    <option value="geral">Geral / Todas as clínicas</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Dentista Executor</label>
                  <select 
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    value={formData.dentistId}
                    onChange={(e) => setFormData({...formData, dentistId: e.target.value})}
                  >
                    <option value="geral">Geral / Todos os dentistas</option>
                    {availableDentistsInForm.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                    ))}
                  </select>
                  {formData.clinicId && formData.clinicId !== 'geral' && availableDentistsInForm.length === 0 && dentists.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1.5 font-semibold">
                      Dica: Não há dentistas cadastrados especificamente para esta clínica. Você pode deixar como Geral ou cadastrar um dentista para ela!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Categoria do Procedimento</label>
                  <select 
                    required
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Clínica Geral">Clínica Geral</option>
                    <option value="Ortodontia">Ortodontia</option>
                    <option value="Endodontia">Endodontia</option>
                    <option value="Periodontia">Periodontia</option>
                    <option value="Implantodontia">Implantodontia</option>
                    <option value="Prótese / Reabilitação">Prótese / Reabilitação</option>
                    <option value="Estética Dental">Estética Dental</option>
                    <option value="Cirurgia Oral">Cirurgia Oral</option>
                    <option value="Odontopediatria">Odontopediatria</option>
                    <option value="Outros">Outras categorias</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Tipo do Procedimento (Serviço)</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Tratamento de Canal, Clareamento..."
                    list="procedure-suggestions"
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  />
                  <datalist id="procedure-suggestions">
                    {dynamicProcedureTypes.map((type, i) => (
                      <option key={i} value={type} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="isCustomProcedure"
                    className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
                    checked={formData.type !== '' && !commonProcedureTypes.includes(formData.type)}
                    onChange={(e) => e.target.checked && setFormData({...formData, type: ''})}
                  />
                  <label htmlFor="isCustomProcedure" className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                    Cadastrar Procedimento Avulso
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Valor do Procedimento (R$)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">
                        R$
                      </div>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: 350.00"
                        className="w-full pl-11 pr-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold"
                        value={formData.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow digits, one dot or comma
                          if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                            setFormData({...formData, value: val});
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Data do Cadastro</label>
                    <input 
                      required
                      type="datetime-local" 
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold"
                      value={formData.registrationDate}
                      onChange={(e) => setFormData({...formData, registrationDate: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingProcedure ? 'Salvar Alterações' : 'Salvar Procedimento')}
                </button>
                {clinics.length === 0 && (
                  <p className="text-center text-xs text-amber-600 font-medium">Dica: Cadastre suas clínicas no menu lateral para vincular aos procedimentos!</p>
                )}
                {clinics.length > 0 && dentists.length === 0 && (
                  <p className="text-center text-xs text-amber-600 font-medium">Dica: Cadastre seus dentistas no menu lateral para vincular aos procedimentos!</p>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
