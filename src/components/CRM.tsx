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
  User
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Patient, Clinic } from '../types';
import { handleFirestoreError, OperationType } from '../lib/FirestoreUtils';

const columns = [
  { id: 'lead', title: 'Leads Captados', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Em Atendimento', color: 'bg-amber-500' },
  { id: 'scheduled', title: 'Consulta Marcada', color: 'bg-emerald-500' },
  { id: 'lost', title: 'Perdidos', color: 'bg-neutral-400' },
];

export default function CRM() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', clinicId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let unsubClinics: () => void;
    let unsubPacientes: () => void;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Cleanup previous listeners
      if (unsubClinics) unsubClinics();
      if (unsubPacientes) unsubPacientes();
      
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
          setPatients(ptSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
          setLoading(false);
        }, (error) => {
          console.error("Error loading pacientes in CRM:", error);
          handleFirestoreError(error, OperationType.LIST, 'pacientes');
          setLoading(false);
        });
      } else {
        setClinics([]);
        setPatients([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubClinics) unsubClinics();
      if (unsubPacientes) unsubPacientes();
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
    (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (p.phone || '').includes(searchTerm || '')
  );

  return (
    <div className="space-y-6">
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
        <div className="flex lg:grid lg:grid-cols-4 gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap lg:flex-wrap lg:overflow-x-visible">
          {columns.map((column) => (
            <div key={column.id} className="space-y-4 shrink-0 w-[290px] sm:w-[320px] lg:w-auto lg:flex-1">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${column.color}`} />
                  <h4 className="font-bold text-sm text-neutral-500 uppercase tracking-wider">{column.title}</h4>
                </div>
                <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {filteredPatients.filter(p => p.status === column.id).length}
                </span>
              </div>

              <div className="bg-neutral-100/50 p-3 rounded-2xl min-h-[500px] space-y-3 border border-dashed border-neutral-200">
                {filteredPatients.filter(p => p.status === column.id).map((patient, idx) => (
                  <motion.div 
                    layoutId={patient.id}
                    key={`${patient.id}-${idx}`} 
                    className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-grab active:cursor-grabbing group hover:border-blue-300 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-bold text-neutral-800">{patient.name}</h5>
                        <p className="text-[10px] text-neutral-400 font-medium">{patient.phone}</p>
                      </div>
                      <div className="flex gap-1">
                        {columns.filter(c => c.id !== patient.status).map(c => (
                           <button 
                            key={c.id}
                            onClick={() => handleUpdateStatus(patient.id, c.id)}
                            className={`w-2 h-2 rounded-full ${c.color} opacity-20 hover:opacity-100 transition-opacity`}
                            title={`Mover para ${c.title}`}
                           />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold py-0.5 px-2 bg-blue-50 text-blue-600 rounded-md">
                        {clinics.find(c => c.id === patient.clinicId)?.name || 'Clínica não encontrada'}
                      </span>
                      {patient.interestedIn && (
                        <span className="text-[10px] font-bold py-0.5 px-2 bg-amber-50 text-amber-600 rounded-md">
                          {patient.interestedIn}
                        </span>
                      )}
                      {patient.source && (
                        <span className={`text-[10px] font-bold py-0.5 px-2 rounded-md ${patient.source === 'whatsapp_real' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-600'}`}>
                          {patient.source === 'whatsapp_real' ? 'WhatsApp Real' : 'Simulador'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-50">
                      <div className="flex -space-x-2">
                        <button className="p-1.5 rounded-full bg-neutral-50 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 transition-colors border-2 border-white">
                          <MessageCircle size={14} />
                        </button>
                        <button className="p-1.5 rounded-full bg-neutral-50 text-neutral-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors border-2 border-white">
                          <Phone size={14} />
                        </button>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold uppercase">
                        {patient.lastContactAt ? 'Ativo' : 'Novo'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
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
    </div>
  );
}

