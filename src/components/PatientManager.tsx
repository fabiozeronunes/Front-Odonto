import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Trash2, Edit2, User, Search, MessageCircle, FileText } from 'lucide-react';
import PatientForm from './PatientForm';
import { getPatientId } from '../lib/patient-utils';

export default function PatientManager() {
  const [patients, setPatients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dentists, setDentists] = useState<any[]>([]);

  useEffect(() => {
    const patientId = localStorage.getItem('selectedPatient');
    if (patientId && patients.length > 0) {
        const patient = patients.find(p => p.id === patientId);
        if (patient) {
            openForm(patient);
        }
        localStorage.removeItem('selectedPatient');
    }
  }, [patients]);
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, 'pacientes'), orderBy('createdAt', 'desc'));
        const unsubSnapshot = onSnapshot(q, (snapshot) => {
          setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubSnapshot();
      } else {
        setPatients([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, 'dentists'), where('ownerId', '==', auth.currentUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setDentists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  const filteredPatients = patients.filter(p =>
    (p.nome || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (p.cpf || '').includes(searchQuery || '')
  );

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      await deleteDoc(doc(db, 'pacientes', id));
    }
  };

  const openForm = (patient: any = null) => {
    setEditingPatient(patient);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => { setShowForm(false); setEditingPatient(null); }} 
          className="inline-flex items-center gap-2 text-neutral-600 hover:text-blue-600 font-bold text-sm bg-white px-4 py-2 sm:py-2.5 rounded-xl border border-neutral-200/85 shadow-sm transition-all hover:bg-neutral-50 active:scale-95"
        >
          <span>← Voltar para lista</span>
        </button>
        <PatientForm onSuccess={() => { setShowForm(false); setEditingPatient(null); }} initialData={editingPatient} />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center px-1 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-800">Prontuário Digital</h2>
        <button onClick={() => openForm()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold w-full sm:w-auto text-sm text-center transition-all hover:bg-blue-700 active:scale-95 shadow-sm">Novo Paciente</button>
      </div>

      <div className="relative px-1 sm:px-0">
        <Search className="absolute left-4 sm:left-3.5 top-3.5 sm:top-3 text-neutral-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome ou CPF..." 
          className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm text-neutral-700"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 min-w-0 w-full">
        {filteredPatients.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center text-neutral-400 font-semibold text-sm">
            Nenhum paciente cadastrado ou encontrado.
          </div>
        ) : (
          filteredPatients.map(p => (
            <div key={p.id} className="bg-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-neutral-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-xs min-w-0 w-full">
              <div className="flex flex-row items-center sm:items-start gap-3 sm:gap-4 flex-grow w-full min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-xs">
                  <User size={20} className="sm:hidden" />
                  <User size={24} className="hidden sm:block" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 w-full min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base sm:text-lg text-neutral-800 truncate" title={p.nome}>
                      {p.nome} <span className="text-[10px] text-neutral-400 font-mono ml-2 italic">
                        ID: {getPatientId(p)}
                      </span>
                    </h3>
                    <div className="text-neutral-500 text-[11px] sm:text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                      <span className="truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs block" title={p.email}>{p.email}</span>
                      <span className="text-neutral-300 hidden sm:inline">•</span>
                      <a href={`https://wa.me/55${p.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-green-600 hover:text-green-700 font-bold">
                        <MessageCircle size={12} /> {p.telefone}
                      </a>
                    </div>
                  </div>
                  {p.dentistaId && (() => {
                    const dentista = dentists.find(d => d.id === p.dentistaId);
                    if (!dentista) return <p className="text-blue-600 text-xs font-semibold">Dentista: Carregando...</p>;
                    return (
                      <div className="min-w-0 sm:border-l sm:border-neutral-100 sm:pl-4">
                        <p className="text-blue-600 text-[11px] sm:text-xs font-bold truncate">Dentista: {dentista.name}</p>
                        <a href={`https://wa.me/55${(dentista.telefone || dentista.phone || '')?.replace(/\D/g, '') || ''}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-green-600 hover:text-green-700 text-[10px] sm:text-xs mt-0.5 font-semibold">
                          <MessageCircle size={10} /> {dentista.telefone || dentista.phone || 'Sem telefone'}
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-end w-full sm:w-auto border-t sm:border-t-0 pt-2.5 sm:pt-0 border-neutral-100 shrink-0">
                <button 
                  onClick={() => openForm(p)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                >
                  <FileText size={16} />
                  <span>ABRIR PRONTUÁRIO</span>
                </button>
                <div className="flex gap-1.5 w-full sm:w-auto justify-end">
                  <button onClick={() => openForm(p)} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3 sm:p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-xl transition-all border border-neutral-100 sm:border-0 text-xs sm:text-sm font-bold sm:font-normal" title="Editar"><Edit2 size={16} /><span className="sm:hidden">Editar</span></button>
                  <button onClick={() => handleDelete(p.id)} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3 sm:p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all border border-neutral-100 sm:border-0 text-xs sm:text-sm font-bold sm:font-normal" title="Excluir"><Trash2 size={16} /><span className="sm:hidden">Excluir</span></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
