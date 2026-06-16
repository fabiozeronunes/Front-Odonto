import { useState, useEffect } from 'react';
import { Stethoscope, Plus, Search, Calendar, MoreVertical, Edit2, Shield, X, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import { Dentist, Clinic } from '../types';
import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="inline-block shrink-0">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.335 4.963L2 22l5.233-1.371a9.957 9.957 0 0 0 4.779 1.229h.005c5.503 0 9.986-4.479 9.988-9.986.002-2.67-1.036-5.18-2.924-7.07a9.923 9.923 0 0 0-7.074-2.918H12.012zm-.006 1.616c2.235 0 4.337.87 5.92 2.454a8.318 8.318 0 0 1 2.45 5.918h.001c-.001 4.61-3.753 8.361-8.367 8.361a8.354 8.354 0 0 1-4.26-1.161l-.305-.181-3.16.828.843-3.08-.198-.316A8.328 8.328 0 0 1 3.63 11.983c0-4.612 3.753-8.362 8.369-8.362h.007zm-2.122 3.125c-.158-.352-.324-.359-.475-.365-.124-.005-.265-.005-.407-.005a.782.782 0 0 0-.568.261C8.243 6.845 7.7 7.355 7.7 8.397s.758 2.046.864 2.188c.106.143 1.491 2.277 3.612 3.195.505.218 1.002.348 1.408.477.508.162.97.139 1.336.084.407-.061 1.25-.51 1.427-1.003s.178-.916.124-1.003c-.053-.087-.195-.14-.408-.246-.213-.106-1.25-.618-1.444-.687s-.337-.106-.479.106c-.143.213-.55.688-.674.829-.124.14-.249.158-.462.052s-.9-.331-1.714-1.057c-.633-.564-1.06-1.261-1.184-1.473-.124-.212-.013-.327.093-.432.096-.095.213-.247.319-.37.106-.124.142-.213.213-.354s.035-.266-.018-.372c-.053-.106-.465-1.119-.64-1.536z"/>
  </svg>
);

export default function DentistManager() {
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingDentist, setEditingDentist] = useState<Dentist | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    cpf: '',
    cro: '',
    phone: '',
    email: '',
    address: '',
    cep: '',
    district: '',
    city: '',
    specialty: '', 
    clinicId: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multiple Specialties Support
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [dbSpecialties, setDbSpecialties] = useState<string[]>([]);

  const predefinedSpecialties = [
    'Ortodontia',
    'Implantodontia',
    'Endodontia',
    'Odontopediatria',
    'Periodontia',
    'Prótese Dentária',
    'Odontologia Estética',
    'Harmonização Orofacial',
    'Cirurgia Bucomaxilofacial',
    'Clínica Geral'
  ];

  const availableSpecialties = dbSpecialties.length > 0 ? dbSpecialties : predefinedSpecialties;

  const handleAddSpecialty = (spec: string) => {
    const trimmed = spec.trim();
    if (trimmed && !selectedSpecialties.includes(trimmed)) {
      setSelectedSpecialties([...selectedSpecialties, trimmed]);
    }
    setCustomSpecialty('');
  };

  const handleRemoveSpecialty = (spec: string) => {
    setSelectedSpecialties(selectedSpecialties.filter(s => s !== spec));
  };

  useEffect(() => {
    let unsubClinics: () => void;
    let unsubDentists: () => void;
    let unsubSpecialties: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Cleanup previous
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubSpecialties) unsubSpecialties();

      if (user) {
        unsubClinics = onSnapshot(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)), (snapshot) => {
          const clinicList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
          setClinics(clinicList);
          if (clinicList.length === 0) setLoading(false);
        }, (error) => {
          console.error("Error loading clinics:", error);
          handleFirestoreError(error, OperationType.LIST, 'clinics');
          setLoading(false);
        });

        unsubDentists = onSnapshot(query(collection(db, 'dentists'), where('ownerId', '==', user.uid)), (snapshot) => {
          setDentists(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dentist)));
          setLoading(false);
        }, (error) => {
          console.error("Error loading dentists:", error);
          handleFirestoreError(error, OperationType.LIST, 'dentists');
          setLoading(false);
        });

        unsubSpecialties = onSnapshot(query(collection(db, 'specialties'), where('ownerId', '==', user.uid)), (snapshot) => {
          const names = snapshot.docs.map(d => d.data().name as string);
          setDbSpecialties(names);
        }, (error) => {
          console.error("Error loading specialties:", error);
        });
      } else {
        setClinics([]);
        setDentists([]);
        setDbSpecialties([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubDentists) unsubDentists();
      if (unsubSpecialties) unsubSpecialties();
    };
  }, []);

  const handleOpenModal = (dentist?: Dentist) => {
    if (dentist) {
      setEditingDentist(dentist);
      setFormData({
        name: dentist.name,
        cpf: dentist.cpf || '',
        cro: dentist.cro || '',
        phone: dentist.phone || '',
        email: dentist.email,
        address: dentist.address || '',
        cep: dentist.cep || '',
        district: dentist.district || '',
        city: dentist.city || '',
        specialty: dentist.specialty,
        clinicId: dentist.clinicId
      });
      // Parse multi specialty from comma-separated string
      const specs = dentist.specialty 
        ? dentist.specialty.split(',').map(s => s.trim()).filter(Boolean) 
        : [];
      setSelectedSpecialties(specs);
    } else {
      setEditingDentist(null);
      setFormData({ 
        name: '', 
        cpf: '', 
        cro: '', 
        phone: '', 
        email: '', 
        address: '', 
        cep: '',  
        district: '', 
        city: '', 
        specialty: '', 
        clinicId: '' 
      });
      setSelectedSpecialties([]);
    }
    setCustomSpecialty('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicId) {
      alert("Selecione uma clínica");
      return;
    }

    if (selectedSpecialties.length === 0) {
      alert("Selecione ou adicione pelo menos uma especialidade!");
      return;
    }
    
    const finalSpecialty = selectedSpecialties.join(', ');
    const submissionData = {
      ...formData,
      specialty: finalSpecialty
    };

    console.log("Submitting dentist data...", submissionData);
    setIsSubmitting(true);
    const path = editingDentist ? `dentists/${editingDentist.id}` : 'dentists';
    try {
      if (editingDentist) {
        await updateDoc(doc(db, 'dentists', editingDentist.id), {
          ...submissionData,
          ownerId: auth.currentUser?.uid, // Ensure ownerId is preserved/set
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'dentists'), {
          ...submissionData,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingDentist(null);
      setFormData({ 
        name: '', 
        cpf: '', 
        cro: '', 
        phone: '', 
        email: '', 
        address: '', 
        cep: '', 
        district: '', 
        city: '', 
        specialty: '', 
        clinicId: '' 
      });
      setSelectedSpecialties([]);
      setCustomSpecialty('');
    } catch (error) {
      console.error("Save error for dentist:", error);
      handleFirestoreError(error, editingDentist ? OperationType.UPDATE : OperationType.CREATE, path);
      // Close modal on error to prevent UI "freeze"
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dentists', id));
      setDeletingId(null);
    } catch (error) {
      console.error("Save error for dentist delete:", error);
      handleFirestoreError(error, OperationType.DELETE, `dentists/${id}`);
      setDeletingId(null);
    }
  };

  const filteredDentists = dentists.filter(d => 
    (d.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (d.specialty || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar dentistas..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 w-full sm:w-auto"
        >
          <Plus size={20} />
          Adicionar Dentista
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 sm:hidden">
            {filteredDentists.map((dr) => (
              <div key={dr.id} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold uppercase shrink-0">
                    {dr.name[0]}{dr.name.split(' ')[1]?.[0] || ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-900 truncate text-base">{dr.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(dr.specialty || '').split(',').map((s) => s.trim()).filter(Boolean).map((spec, index) => (
                        <span key={index} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-100">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Clínica</span>
                    <span className="font-bold text-neutral-700">
                      {clinics.find(c => c.id === dr.clinicId)?.name || 'Clínica não encontrada'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Email</span>
                    <span className="font-semibold text-neutral-700 truncate max-w-[180px]">{dr.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Telefone</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-700">{dr.phone || 'Sem Telefone'}</span>
                      {dr.phone && (
                        <a 
                          href={`https://wa.me/55${dr.phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-lg transition-colors"
                          title="Enviar mensagem no WhatsApp"
                        >
                          <WhatsAppIcon size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Status</span>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                      <Calendar size={12} />
                      Sincronizado
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">CRO</span>
                    <span className="font-bold text-neutral-700 uppercase tracking-tight">{dr.cro}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                  <button 
                    onClick={() => handleOpenModal(dr)}
                    className="flex-1 max-w-[100px] flex items-center justify-center gap-1.5 py-2 hover:bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 transition-all"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  {deletingId === dr.id ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDelete(dr.id)}
                        className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-2 bg-neutral-100 text-neutral-600 text-xs font-bold rounded-xl hover:bg-neutral-200"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeletingId(dr.id)}
                      className="flex-1 max-w-[100px] flex items-center justify-center gap-1.5 py-2 hover:bg-red-50 border border-transparent rounded-xl text-xs font-bold text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden sm:block bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[850px] border-collapse">
                <thead className="bg-neutral-50/50 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Dentista / Especialidade(s)</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Clínica</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">CRO</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredDentists.map((dr) => (
                    <tr key={dr.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold uppercase shrink-0">
                            {dr.name[0]}{dr.name.split(' ')[1]?.[0] || ''}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-neutral-900 truncate text-base">{dr.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1 max-w-[280px]">
                              {(dr.specialty || '').split(',').map((s) => s.trim()).filter(Boolean).map((spec, index) => (
                                <span key={index} className="bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-blue-100">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-sm text-neutral-700">
                        {clinics.find(c => c.id === dr.clinicId)?.name || 'Clínica não encontrada'}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold text-neutral-600">
                        {dr.email}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-700">{dr.phone || 'Sem Telefone'}</span>
                          {dr.phone && (
                            <a 
                              href={`https://wa.me/55${dr.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-lg transition-colors"
                              title="Enviar mensagem no WhatsApp"
                            >
                              <WhatsAppIcon size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                          <Calendar size={14} />
                          Sincronizado
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-neutral-700 uppercase tracking-wide">
                        {dr.cro}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(dr)}
                            className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-blue-600 transition-all"
                            title="Editar Dentista"
                          >
                            <Edit2 size={16} />
                          </button>
                          {deletingId === dr.id ? (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleDelete(dr.id)}
                                className="text-xs font-bold text-red-600 hover:underline"
                              >
                                Confirmar
                              </button>
                              <button 
                                onClick={() => setDeletingId(null)}
                                className="text-xs font-bold text-neutral-400 hover:underline"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeletingId(dr.id)}
                              className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-red-600 transition-all"
                              title="Excluir Dentista"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {filteredDentists.length === 0 && (
            <div className="p-20 text-center text-neutral-400">
              <Stethoscope size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum dentista encontrado.</p>
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
            <h4 className="text-xl font-bold text-blue-900">Gestão de Equipe</h4>
            <p className="text-blue-700/70 font-medium max-w-xl">Cada dentista pode ter sua própria agenda Google conectada para marcações automáticas via WhatsApp.</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold">{editingDentist ? 'Editar Dentista' : 'Adicionar Dentista'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Clínica</label>
                    <select 
                      required
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.clinicId}
                      onChange={(e) => setFormData({...formData, clinicId: e.target.value})}
                    >
                      <option value="">Selecione uma clínica</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Nome Completo</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Dra. Juliana Silva"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CPF</label>
                    <input 
                      required
                      type="text" 
                      placeholder="000.000.000-00"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CRO</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: SP-123456"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.cro}
                      onChange={(e) => setFormData({...formData, cro: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">Especialidades</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select 
                        className="flex-1 py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddSpecialty(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Selecione Especialidade...</option>
                        {availableSpecialties.map((spec) => (
                          <option key={spec} value={spec} disabled={selectedSpecialties.includes(spec)}>
                            {spec}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-2 flex-1">
                        <input 
                          type="text" 
                          placeholder="Outra Especialidade..."
                          className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                          value={customSpecialty}
                          onChange={(e) => setCustomSpecialty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSpecialty(customSpecialty);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSpecialty(customSpecialty)}
                          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-colors"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedSpecialties.map((spec, index) => (
                        <div 
                          key={index}
                          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 py-1.5 px-3 rounded-full text-xs font-bold"
                        >
                          <span>{spec}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecialty(spec)}
                            className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {selectedSpecialties.length === 0 && (
                        <span className="text-[11px] text-neutral-400 font-medium">Nenhuma especialidade selecionada. Adicione pelo menos uma.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Telefone / WhatsApp</label>
                    <input 
                      required
                      type="tel" 
                      placeholder="(00) 00000-0000"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Email Profissional</label>
                    <input 
                      required
                      type="email" 
                      placeholder="email@clinica.com"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Endereço</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Rua, Número..."
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CEP</label>
                    <input 
                      required
                      type="text" 
                      placeholder="00000-000"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.cep}
                      onChange={(e) => setFormData({...formData, cep: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Bairro</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Centro"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.district}
                      onChange={(e) => setFormData({...formData, district: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Cidade</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: São Paulo"
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm sm:text-base"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  disabled={isSubmitting || clinics.length === 0}
                  type="submit"
                  className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 text-sm sm:text-base"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingDentist ? 'Salvar Alterações' : 'Salvar Dentista')}
                </button>
                {clinics.length === 0 && (
                  <p className="text-center text-xs text-red-500 font-bold">Cadastre uma clínica primeiro!</p>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

