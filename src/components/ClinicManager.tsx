import { useState, useEffect } from 'react';
import { Building2, Plus, Search, MapPin, Phone, MoreVertical, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp, updateDoc } from '../lib/supabaseAdapter';
import { Clinic } from '../types';

import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';

export default function ClinicManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    cnpj: '',
    cro: '',
    address: '', 
    cep: '',
    district: '',
    city: '',
    email: '',
    phone: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    
    if (auth.currentUser) {
      const q = query(
        collection(db, 'clinics'),
        where('ownerId', '==', auth.currentUser.uid)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
        setClinics(docs);
        setLoading(false);
      }, (error) => {
        console.error("Clinics listener error:", error);
        handleFirestoreError(error, OperationType.LIST, 'clinics');
        setLoading(false);
      });
    } else {
      const authUnsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          const q = query(
            collection(db, 'clinics'),
            where('ownerId', '==', user.uid)
          );
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
            setClinics(docs);
            setLoading(false);
          }, (error) => {
            console.error("Clinics listener error:", error);
            handleFirestoreError(error, OperationType.LIST, 'clinics');
            setLoading(false);
          });
        }
      });
      return () => {
        authUnsubscribe();
        unsubscribe();
      };
    }

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (clinic?: Clinic) => {
    if (clinic) {
      setEditingClinic(clinic);
      setFormData({
        name: clinic.name,
        cnpj: clinic.cnpj || '',
        cro: clinic.cro || '',
        address: clinic.address,
        cep: clinic.cep || '',
        district: clinic.district || '',
        city: clinic.city || '',
        email: clinic.email || '',
        phone: clinic.phone
      });
    } else {
      setEditingClinic(null);
      setFormData({ name: '', cnpj: '', cro: '', address: '', cep: '', district: '', city: '', email: '', phone: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setIsSubmitting(true);
    const path = editingClinic ? `clinics/${editingClinic.id}` : 'clinics';
    try {
      if (editingClinic) {
        await updateDoc(doc(db, 'clinics', editingClinic.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'clinics'), {
          ...formData,
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setFormData({ name: '', cnpj: '', cro: '', address: '', cep: '', district: '', city: '', email: '', phone: '' });
      setEditingClinic(null);
    } catch (error) {
      console.error("Error saving clinic:", error);
      handleFirestoreError(error, editingClinic ? OperationType.UPDATE : OperationType.CREATE, path);
      // Still close the modal or provide feedback so it doesn't "freeze"
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clinics', id));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting clinic:", error);
      handleFirestoreError(error, OperationType.DELETE, `clinics/${id}`);
      setDeletingId(null);
    }
  };

  const filteredClinics = clinics.filter(c => 
    (c.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (c.address || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar clínicas..." 
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
          Registrar Clínica
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
            {filteredClinics.map((clinic) => (
              <div key={clinic.id} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-600 shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-900 truncate text-base">{clinic.name}</p>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Endereço</span>
                    <span className="font-bold text-neutral-700 truncate max-w-[150px]">{clinic.address}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Telefone</span>
                    <span className="font-bold text-neutral-700">{clinic.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">Email</span>
                    <span className="font-semibold text-neutral-700 truncate max-w-[150px]">{clinic.email || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase tracking-wider text-[9px]">CNPJ / CRO</span>
                    <span className="font-bold text-neutral-700 uppercase tracking-tight">{clinic.cnpj || '---'} / {clinic.cro || '---'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                  <button 
                    onClick={() => handleOpenModal(clinic)}
                    className="flex-1 max-w-[100px] flex items-center justify-center gap-1.5 py-2 hover:bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 transition-all"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  {deletingId === clinic.id ? (
                    <div className="flex items-center gap-2">
                       <button onClick={() => handleDelete(clinic.id)} className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700">Sim</button>
                       <button onClick={() => setDeletingId(null)} className="px-3 py-2 bg-neutral-100 text-neutral-600 text-xs font-bold rounded-xl hover:bg-neutral-200">Não</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeletingId(clinic.id)}
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
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Clínica</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Endereço</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Contato (Fone/Email)</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider">Documentos (CNPJ/CRO)</th>
                    <th className="px-6 py-5 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredClinics.map((clinic) => (
                    <tr key={clinic.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-600 shrink-0">
                          <Building2 size={24} />
                        </div>
                        <p className="font-bold text-neutral-900 text-base">{clinic.name}</p>
                      </td>
                      <td className="px-6 py-5 font-medium text-sm text-neutral-600">
                        {clinic.address}{clinic.district ? `, ${clinic.district}` : ''}{clinic.city ? ` - ${clinic.city}` : ''}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold text-neutral-600">
                        <div className="flex flex-col gap-1">
                           <span className="font-bold">{clinic.phone}</span>
                           <span>{clinic.email || '---'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-neutral-700">
                       CNPJ: {clinic.cnpj || '---'} <br/> CRO: {clinic.cro || '---'}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(clinic)}
                            className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-blue-600 transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          {deletingId === clinic.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(clinic.id)} className="text-xs font-bold text-red-600 hover:underline">Confirmar</button>
                              <button onClick={() => setDeletingId(null)} className="text-xs font-bold text-neutral-400 hover:underline">Cancelar</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeletingId(clinic.id)}
                              className="p-2.5 hover:bg-white border-2 border-transparent hover:border-neutral-100 rounded-xl text-neutral-400 hover:text-red-600 transition-all"
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
          
          {filteredClinics.length === 0 && (
            <div className="p-20 text-center text-neutral-400">
              <Building2 size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhuma clínica encontrada.</p>
            </div>
          )}
        </div>

      )}

      {/* Modal */}
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
                <h3 className="text-2xl font-bold">{editingClinic ? 'Editar Clínica' : 'Registrar Nova Clínica'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Nome da Clínica</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Sorriso Perfeito"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CNPJ</label>
                    <input 
                      type="text" 
                      placeholder="00.000.000/0000-00"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CRO Responsável</label>
                    <input 
                      type="text" 
                      placeholder="Ex: SP-123456"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.cro}
                      onChange={(e) => setFormData({...formData, cro: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Endereço</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Rua, Número..."
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
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
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.cep}
                      onChange={(e) => setFormData({...formData, cep: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Bairro</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Centro"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.district}
                      onChange={(e) => setFormData({...formData, district: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Cidade</label>
                    <input 
                      type="text" 
                      placeholder="Ex: São Paulo"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">E-mail de Contato</label>
                    <input 
                      required
                      type="email" 
                      placeholder="Ex: contato@clinica.com"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Telefone WhatsApp</label>
                    <input 
                      required
                      type="tel" 
                      placeholder="(00) 00000-0000"
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
               >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingClinic ? 'Salvar Alterações' : 'Cadastrar Clínica')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

