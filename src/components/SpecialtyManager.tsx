import { useState, useEffect } from 'react';
import { 
  Award, 
  Users, 
  ClipboardList, 
  ChevronRight, 
  Stethoscope, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Loader2, 
  Info,
  RefreshCw
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch 
} from '../lib/supabaseAdapter';
import { Dentist, Procedure, Specialty } from '../types';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'get',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const colorPresets = [
  { id: 'blue', label: 'Azul', iconColor: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-100', dotColor: 'bg-blue-500' },
  { id: 'emerald', label: 'Verde', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-100', dotColor: 'bg-emerald-500' },
  { id: 'purple', label: 'Roxo', iconColor: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-100', dotColor: 'bg-purple-500' },
  { id: 'amber', label: 'Laranja', iconColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100', dotColor: 'bg-amber-500' },
  { id: 'rose', label: 'Cereja', iconColor: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-100', dotColor: 'bg-rose-500' },
  { id: 'cyan', label: 'Ciano', iconColor: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-100', dotColor: 'bg-cyan-500' },
  { id: 'indigo', label: 'Índigo', iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-100', dotColor: 'bg-indigo-500' },
  { id: 'pink', label: 'Rosa', iconColor: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-100', dotColor: 'bg-pink-500' },
  { id: 'neutral', label: 'Cinza', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-50 border-neutral-200', dotColor: 'bg-neutral-600' },
];

const defaultSpecialtiesPreset = [
  { name: 'Ortodontia', description: 'Correção da posição dos dentes e dos ossos maxilares.', iconColor: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-100' },
  { name: 'Implantodontia', description: 'Reabilitação muco-suportada por implantes dentários.', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-100' },
  { name: 'Endodontia', description: 'Tratamento das lesões e doenças da polpa e da raiz do dente.', iconColor: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-100' },
  { name: 'Odontopediatria', description: 'Tratamento e prevenção da saúde bucal de bebês, crianças e adolescentes.', iconColor: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-100' },
  { name: 'Periodontia', description: 'Tratamento de doenças gengivais e sustentação dos dentes.', iconColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100' },
  { name: 'Prótese Dentária', description: 'Substituição de tecidos bucais e dentes perdidos (coroas, pontes, etc).', iconColor: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-100' },
  { name: 'Odontologia Estética', description: 'Melhoria na aparência dos dentes, como facetas e lentes de contato.', iconColor: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-100' },
  { name: 'Harmonização Orofacial', description: 'Equilíbrio estético e funcional entre o sorriso e o rosto do paciente.', iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-100' },
  { name: 'Cirurgia Bucomaxilofacial', description: 'Tratamento cirúrgico de doenças e deformidades na cavidade bucal.', iconColor: 'text-violet-600', bgColor: 'bg-purple-50 border-purple-100' },
  { name: 'Clínica Geral', description: 'Prevenção, diagnóstico e tratamento de uma ampla variedade de condições bucais.', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-50 border-neutral-200' },
];

export default function SpecialtyManager() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal and Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    colorPresetId: 'blue'
  });

  useEffect(() => {
    let unsubSpecialties: () => void;
    let unsubDentists: () => void;
    let unsubProcedures: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (unsubSpecialties) unsubSpecialties();
      if (unsubDentists) unsubDentists();
      if (unsubProcedures) unsubProcedures();

      if (user) {
        // Load Specialties
        unsubSpecialties = onSnapshot(query(collection(db, 'specialties'), where('ownerId', '==', user.uid)), (snapshot) => {
          const specialtyList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Specialty));
          setSpecialties(specialtyList);
          setLoading(false);
        }, (error) => {
          console.error("Error loading specialties:", error);
          setLoading(false);
          // Don't crash hard, let the user know via log and continue with local clean slate if needed
        });

        // Load Dentists
        unsubDentists = onSnapshot(query(collection(db, 'dentists'), where('ownerId', '==', user.uid)), (snapshot) => {
          const dentistList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dentist));
          setDentists(dentistList);
        }, (error) => {
          console.error("Error loading dentists for specialties index calculation:", error);
        });

        // Load Procedures
        unsubProcedures = onSnapshot(query(collection(db, 'procedures'), where('ownerId', '==', user.uid)), (snapshot) => {
          const procedureList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Procedure));
          setProcedures(procedureList);
        }, (error) => {
          console.error("Error loading procedures for specialties index calculation:", error);
        });
      } else {
        setSpecialties([]);
        setDentists([]);
        setProcedures([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubSpecialties) unsubSpecialties();
      if (unsubDentists) unsubDentists();
      if (unsubProcedures) unsubProcedures();
    };
  }, []);

  const handleOpenModal = (spec?: Specialty) => {
    setErrorMessage(null);
    if (spec) {
      setEditingSpecialty(spec);
      // Try to find preset by comparing iconColor
      const preset = colorPresets.find(p => p.iconColor === spec.iconColor) || colorPresets[0];
      setFormData({
        name: spec.name,
        description: spec.description,
        colorPresetId: preset.id
      });
    } else {
      setEditingSpecialty(null);
      setFormData({
        name: '',
        description: '',
        colorPresetId: 'blue'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSpecialty(null);
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setActionLoading(true);
    setErrorMessage(null);
    const preset = colorPresets.find(p => p.id === formData.colorPresetId) || colorPresets[0];

    try {
      if (editingSpecialty) {
        // Update
        const docRef = doc(db, 'specialties', editingSpecialty.id);
        const updateData = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          iconColor: preset.iconColor,
          bgColor: preset.bgColor,
        };
        await updateDoc(docRef, updateData);
      } else {
        // Create
        await addDoc(collection(db, 'specialties'), {
          name: formData.name.trim(),
          description: formData.description.trim(),
          iconColor: preset.iconColor,
          bgColor: preset.bgColor,
          ownerId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving specialty document:", error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(msg.includes("permission") ? "Erro de permissão no banco: verifique se você está conectado corretamente." : msg);
      handleFirestoreError(error, editingSpecialty ? OperationType.UPDATE : OperationType.CREATE, 'specialties');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'specialties', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `specialties/${id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoadDefaults = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      defaultSpecialtiesPreset.forEach((p) => {
        const docRef = doc(collection(db, 'specialties'));
        batch.set(docRef, {
          name: p.name,
          description: p.description,
          iconColor: p.iconColor,
          bgColor: p.bgColor,
          ownerId: auth.currentUser!.uid,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'specialties/defaults');
    } finally {
      setLoading(false);
    }
  };

  // Compute stats for merged dataset
  const getSpecialtyStats = () => {
    return specialties.map(spec => {
      const dentistsCount = dentists.filter(dr => {
        if (!dr.specialty) return false;
        const specs = dr.specialty.split(',').map(s => s.trim().toLowerCase());
        return specs.includes(spec.name.toLowerCase());
      }).length;

      const proceduresCount = procedures.filter(proc => {
        if (!proc.category) return false;
        return proc.category.toLowerCase() === spec.name.toLowerCase();
      }).length;

      return {
        ...spec,
        dentistsCount,
        proceduresCount
      };
    });
  };

  const specialtyStats = getSpecialtyStats();
  const totalDentists = dentists.length;
  const activeSpecialtiesCount = specialtyStats.filter(s => s.dentistsCount > 0).length;

  return (
    <div className="space-y-8 animate-fade-in text-neutral-800">
      {/* Bento Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Especialidades</p>
            <h3 className="text-2xl font-black text-neutral-900 mt-1">
              {loading ? (
                <div className="h-7 w-12 bg-neutral-100 rounded animate-pulse" />
              ) : (
                specialties.length
              )}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Cadastradas no sistema</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Em Atendimento</p>
            <h3 className="text-2xl font-black text-neutral-900 mt-1">
              {loading ? (
                <div className="h-7 w-12 bg-neutral-100 rounded animate-pulse" />
              ) : (
                activeSpecialtiesCount
              )}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Ativas com dentista associado</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shrink-0 border border-purple-100">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Profissionais</p>
            <h3 className="text-2xl font-black text-neutral-900 mt-1">
              {loading ? (
                <div className="h-7 w-12 bg-neutral-100 rounded animate-pulse" />
              ) : (
                totalDentists
              )}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Total de dentistas ativos</p>
          </div>
        </div>
      </div>

      {/* Specialty Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-neutral-900">Especialidades Clínicas</h3>
          <p className="text-sm text-neutral-500 mt-1">Gerencie as áreas de atendimento odontológico oferecidas pelas clínicas.</p>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest animate-pulse">Carregando Especialidades...</p>
        </div>
      ) : specialties.length === 0 ? (
        /* Empty State with Seed Buttons */
        <div className="bg-white rounded-3xl sm:rounded-[2rem] border border-neutral-200 shadow-sm p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
            <Award size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-neutral-900">Nenhuma Especialidade Cadastrada</h4>
            <p className="text-neutral-500 text-sm max-w-md mx-auto leading-relaxed">
              Você ainda não cadastrou especialidades clínicas. Registre suas próprias especialidades personalizadas ou carregue nosso pacote de sugestões padrão para começar rapidamente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition-all shadow-xs"
            >
              <Plus size={18} />
              <span>Registrar Nova</span>
            </button>
            <button
              onClick={handleLoadDefaults}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-bold rounded-2xl text-sm border border-neutral-200 transition-all"
            >
              <RefreshCw size={16} />
              <span>Importar 10 Especialidades Padrão</span>
            </button>
          </div>
        </div>
      ) : (
        /* Specialties Grid (Responsive mobile cards with integrated creator card) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card estático para Registrar Nova Especialidade */}
          <button
            onClick={() => handleOpenModal()}
            className="bg-neutral-50/50 hover:bg-white hover:border-blue-400 rounded-[2rem] p-6 border-2 border-dashed border-neutral-200 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center group cursor-pointer min-h-[220px]"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform shadow-xs">
              <Plus size={24} className="stroke-[3]" />
            </div>
            <div className="mt-4">
              <h4 className="font-extrabold text-neutral-900 text-sm">Registrar Nova Especialidade</h4>
              <p className="text-neutral-500 text-xs mt-1 max-w-[200px]">Crie uma especialidade personalizada para as suas clínicas.</p>
            </div>
          </button>

          {specialtyStats.map((spec) => (
            <div 
              key={spec.id} 
              className="bg-white hover:bg-neutral-50/20 rounded-[2rem] p-6 border border-neutral-200 shadow-xs transition-all duration-300 hover:shadow-md flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header Icon container */}
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 ${spec.bgColor || 'bg-blue-50/80 border-blue-100'} border rounded-2xl flex items-center justify-center ${spec.iconColor || 'text-blue-600'} shrink-0 shadow-xs`}>
                    <Award size={22} className="stroke-[2.5]" />
                  </div>
                </div>

                {/* Info Text */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-neutral-900 text-base md:text-lg truncate group-hover:text-blue-600 transition-colors">
                      {spec.name}
                    </h4>
                    {spec.dentistsCount > 0 && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-500 text-xs leading-relaxed min-h-[40px] break-words">
                    {spec.description || 'Nenhuma descrição detalhada fornecida para esta especialidade clínica.'}
                  </p>
                </div>
              </div>

              {/* Stats & Actions */}
              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-full border border-neutral-100" title="Profissionais">
                    <Stethoscope size={13} className="text-neutral-400" />
                    <span className="text-neutral-700">{spec.dentistsCount}</span>
                  </span>
                  <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-full border border-neutral-100" title="Procedimentos">
                    <ClipboardList size={13} className="text-neutral-400" />
                    <span className="text-neutral-700">{spec.proceduresCount}</span>
                  </span>
                </div>
                
                {/* Real buttons for Edit and Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenModal(spec)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-50 hover:bg-blue-50 hover:text-blue-600 border border-neutral-200 hover:border-blue-200 rounded-xl transition-all text-[11px] font-bold"
                    title="Editar especialidade"
                  >
                    <Edit2 size={11} />
                    <span>Editar</span>
                  </button>

                  {deletingId === spec.id ? (
                    <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-2 py-1 z-10">
                      <span className="text-[10px] font-bold text-red-650 uppercase">Apagar?</span>
                      <button 
                        onClick={() => handleDelete(spec.id)}
                        className="text-[10px] font-black text-red-700 hover:underline"
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="text-[10px] font-medium text-neutral-500 hover:underline"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(spec.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-50 hover:bg-red-50 hover:text-red-600 border border-neutral-200 hover:border-red-200 rounded-xl transition-all text-[11px] font-bold"
                      title="Excluir especialidade"
                    >
                      <Trash2 size={11} />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Adicionar/Editar Especialidade (Responsive with Framer Motion) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-[2rem] border border-neutral-100 shadow-xl overflow-hidden w-full max-w-lg flex flex-col my-auto"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-950 text-lg leading-tight">
                      {editingSpecialty ? 'Editar Especialidade' : 'Nova Especialidade'}
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider mt-0.5">Clínica & Profissionais</p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-6 space-y-5">
                {/* Nome */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Nome da Especialidade</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Ortodontia, Harmonização Orofacial"
                    className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Descrição</label>
                  <textarea
                    rows={3}
                    placeholder="Descrição simples de tratamentos incluídos nesta especialidade..."
                    className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-sm resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Tema Visual (Selector de cores) */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Paleta de Cores do Card</label>
                  <div className="grid grid-cols-3 gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, colorPresetId: preset.id })}
                        className={`
                          py-3.5 px-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer
                          ${formData.colorPresetId === preset.id 
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs' 
                            : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                          }
                        `}
                      >
                        <span className="text-[10px] font-bold leading-none">{preset.label}</span>
                        <div className="flex items-center justify-between w-full">
                          <div className={`w-3.5 h-3.5 rounded-full ${preset.dotColor}`} />
                          {formData.colorPresetId === preset.id && (
                            <Check size={12} className="text-white bg-blue-600 rounded-full p-0.5 shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-650 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2.5 animate-pulse">
                    <Info size={16} className="shrink-0 text-red-550 mt-0.5" />
                    <span className="break-words">{errorMessage}</span>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {actionLoading && <Loader2 className="animate-spin" size={12} />}
                    <span>{editingSpecialty ? 'Salvar Alterações' : 'Criar Especialidade'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
