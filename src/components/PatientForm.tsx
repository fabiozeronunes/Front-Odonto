import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Save, User, Mail, Phone, Calendar, MapPin, AlertCircle, Trash2, Loader2, FileText, Maximize2, Eye, Plus, DollarSign, CheckCircle2, CheckSquare } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot } from 'firebase/firestore';
import { getPatientId, generatePatientDisplayId } from '../lib/patient-utils';

interface FileItem {
  name: string;
  url: string;
  uploadedAt?: string;
}

const formatUploadDate = (isoString?: string, fallbackIso?: string) => {
  const targetString = isoString || fallbackIso;
  if (!targetString) return 'Disponibilizado anteriormente';
  try {
    const date = new Date(targetString);
    if (isNaN(date.getTime())) return 'Data indisponível';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Data indisponível';
  }
};

const compressAndToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Se não for imagem (Ex: PDF), converte para Base64 bruto
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Limita tamanho útil proporcional
        const MAX_SIZE = 1000;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Ótima qualidade com pouquíssimo peso (~50-100KB por imagem)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.70);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export default function PatientForm({ onSuccess, initialData }: { onSuccess?: () => void, initialData?: any }) {
  const [formData, setFormData] = useState(initialData ? {
    nome: initialData.nome || '',
    cpf: initialData.cpf || '',
    dataNascimento: initialData.dataNascimento || '',
    email: initialData.email || '',
    telefone: initialData.telefone || '',
    endereco: initialData.endereco || '',
    alergias: initialData.alergias || '',
    medicamentos: initialData.medicamentos || '',
    historico: initialData.historico || '',
    planoTratamento: initialData.planoTratamento || '',
    dentistaId: initialData.dentistaId || ''
  } : {
    nome: '',
    cpf: '',
    dataNascimento: '',
    email: '',
    telefone: '',
    endereco: '',
    alergias: '',
    medicamentos: '',
    historico: '',
    planoTratamento: '',
    dentistaId: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>(initialData?.files || []);
  const [treatedTeeth, setTreatedTeeth] = useState<number[]>(initialData?.treatedTeeth || []);
  const [dentists, setDentists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentId, setCurrentId] = useState(initialData?.id || '');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [fileToDeleteIndex, setFileToDeleteIndex] = useState<number | null>(null);
  const addProcedureRef = useRef<HTMLDivElement>(null);
  const [previousTeethCount, setPreviousTeethCount] = useState(treatedTeeth.length);

  useEffect(() => {
    if (treatedTeeth.length > previousTeethCount) {
       addProcedureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setPreviousTeethCount(treatedTeeth.length);
  }, [treatedTeeth]);

  // Tratamentos e Finanças do prontuário
  const [availableProcedures, setAvailableProcedures] = useState<any[]>([]);
  const [patientProcedures, setPatientProcedures] = useState<any[]>(initialData?.plannedProcedures || []);
  const [amountPaid, setAmountPaid] = useState<number>(initialData?.amountPaid || 0);
  const [paymentHistory, setPaymentHistory] = useState<any[]>(() => {
    if (initialData?.payments && initialData.payments.length > 0) {
      return initialData.payments;
    }
    if (initialData?.amountPaid && initialData.amountPaid > 0) {
      return [{
        id: 'legacy-payment',
        date: initialData.createdAt || new Date().toISOString(),
        procedureId: '',
        procedureName: 'Histórico de Lançamento Geral',
        amount: initialData.amountPaid
      }];
    }
    return [];
  });
  const [selectedProcToAbate, setSelectedProcToAbate] = useState<string>('');
  const [paymentInputVal, setPaymentInputVal] = useState<string>('0,00');
  const [addProcState, setAddProcState] = useState({
    id: '',
    customName: '',
    customCategory: 'Clínica Geral',
    customCategoryTyped: '',
    value: '',
  });

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, 'dentists'), where('ownerId', '==', auth.currentUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setDentists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, 'procedures'), where('ownerId', '==', auth.currentUser.uid));
      const unsubscribeProcedures = onSnapshot(q, (snapshot) => {
        setAvailableProcedures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribeProcedures();
    }
  }, []);

  useEffect(() => {
    if (initialData && initialData.id !== currentId) {
      setCurrentId(initialData.id);
      setFormData({
        nome: initialData.nome || '',
        cpf: initialData.cpf || '',
        dataNascimento: initialData.dataNascimento || '',
        email: initialData.email || '',
        telefone: initialData.telefone || '',
        endereco: initialData.endereco || '',
        alergias: initialData.alergias || '',
        medicamentos: initialData.medicamentos || '',
        historico: initialData.historico || '',
        planoTratamento: initialData.planoTratamento || '',
        dentistaId: initialData.dentistaId || ''
      });
      setSelectedFiles(initialData.files || []);
      setTreatedTeeth(initialData.treatedTeeth || []);
      const plannedProcs = initialData.plannedProcedures || [];
      const paid = initialData.amountPaid || 0;
      setPatientProcedures(plannedProcs);
      setAmountPaid(paid);
      
      const loadedPayments = initialData.payments || [];
      if (loadedPayments.length === 0 && paid > 0) {
        setPaymentHistory([{
          id: 'legacy-payment',
          date: initialData.createdAt || new Date().toISOString(),
          procedureId: '',
          procedureName: 'Histórico de Lançamento Geral',
          amount: paid
        }]);
      } else {
        setPaymentHistory(loadedPayments);
      }
      setPaymentInputVal('0,00');
    }
  }, [initialData, currentId]);

  // Funções financeiras e planejamento de tratamentos
  const handleSelectProcChange = (id: string) => {
    if (id === 'custom') {
      setAddProcState({
        id: 'custom',
        customName: '',
        customCategory: 'Clínica Geral',
        customCategoryTyped: '',
        value: '',
      });
    } else if (id) {
      const selected = availableProcedures.find(p => p.id === id);
      if (selected) {
        setAddProcState({
          id,
          customName: selected.type,
          customCategory: selected.category || 'Clínica Geral',
          customCategoryTyped: '',
          value: String(selected.value || '').replace('.', ','),
        });
      }
    } else {
      setAddProcState({
        id: '',
        customName: '',
        customCategory: 'Clínica Geral',
        customCategoryTyped: '',
        value: '',
      });
    }
  };

  const handleAddProcedureToList = () => {
    let name = '';
    let category = '';
    let rawVal = addProcState.value;
    
    if (addProcState.id === 'custom') {
      name = addProcState.customName.trim();
      category = addProcState.customCategory === 'custom_input'
        ? addProcState.customCategoryTyped.trim()
        : addProcState.customCategory.trim();
    } else if (addProcState.id) {
      name = addProcState.customName;
      category = addProcState.customCategory;
    } else {
      alert("Por favor, selecione ou digite um procedimento.");
      return;
    }

    if (!name) {
      alert("Por favor, informe o nome do procedimento.");
      return;
    }

    if (addProcState.id === 'custom' && addProcState.customCategory === 'custom_input' && !category) {
      alert("Por favor, preencha o nome da nova especialidade.");
      return;
    }

    const numericValue = parseFloat(rawVal.replace(',', '.')) || 0;
    
    const newPlannedProc = {
      tempId: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type: name,
      category: category || 'Clínica Geral',
      value: numericValue,
      status: 'em_curso',
      associatedTeeth: [...treatedTeeth] // Associate current selection
    };

    setPatientProcedures(prev => [...prev, newPlannedProc]);
    setTreatedTeeth([]); // Clear selected teeth
    
    // Reset add treatment states
    setAddProcState({
      id: '',
      customName: '',
      customCategory: 'Clínica Geral',
      customCategoryTyped: '',
      value: '',
    });
  };

  const handleRemoveProcedureFromList = (index: number) => {
    setPatientProcedures(prev => prev.filter((_, i) => i !== index));
  };

  const toggleProcedureStatus = (index: number) => {
    setPatientProcedures(prev => prev.map((proc, i) => {
      if (i === index) {
        const currentStatus = proc.status || 'em_curso';
        const nextStatus = currentStatus === 'finalizado' ? 'em_curso' : 'finalizado';
        return { ...proc, status: nextStatus };
      }
      return proc;
    }));
  };

  const handlePaymentInputChange = (val: string) => {
    setPaymentInputVal(val);
  };

  const handleAddPayment = (amount: number, procId: string = '') => {
    if (amount <= 0) return;
    
    let procName = 'Abatimento Geral';
    if (procId) {
      const matched = patientProcedures.find(p => p.tempId === procId);
      if (matched) {
        procName = matched.type;
      }
    }

    const now = new Date();
    const newPayment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      date: now.toISOString(),
      procedureId: procId,
      procedureName: procName,
      amount: amount
    };

    const updatedPayments = [...paymentHistory, newPayment];
    setPaymentHistory(updatedPayments);

    // Recalculate amountPaid
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    setAmountPaid(totalPaid);
  };

  const handleRemovePayment = (payId: string) => {
    const updated = paymentHistory.filter(p => p.id !== payId);
    setPaymentHistory(updated);
    
    // Recalculate amountPaid
    const totalPaid = updated.reduce((sum, p) => sum + p.amount, 0);
    setAmountPaid(totalPaid);
  };

  const handleRegisterPayment = () => {
    const cleaned = paymentInputVal.replace(/\./g, '').replace(',', '.');
    const numeric = parseFloat(cleaned) || 0;
    if (numeric <= 0) {
      alert("Por favor, informe um valor válido maior que zero para o abatimento.");
      return;
    }
    handleAddPayment(numeric, selectedProcToAbate);
    setSelectedProcToAbate('');
    setPaymentInputVal('0,00');
  };

  const handleQuickAbate = (amount: number) => {
    handleAddPayment(amount, selectedProcToAbate);
  };

  const handleAbateAll = () => {
    const totalTreatmentValue = patientProcedures.reduce((acc, curr) => acc + (parseFloat(curr.value as any) || 0), 0);
    const paidSoFar = paymentHistory.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const amountToPay = Math.max(0, totalTreatmentValue - paidSoFar);
    if (amountToPay > 0) {
      handleAddPayment(amountToPay, selectedProcToAbate);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && auth.currentUser) {
      setUploading(true);
      console.log('Iniciando processamento e compressão local de arquivos...');
      const newFiles: FileItem[] = [];
      try {
        const filesArray = Array.from(e.target.files);
        console.log('Arquivos selecionados:', filesArray.length);

        for (const file of filesArray) {
          if (file.size > 1500000 && !file.type.startsWith('image/')) {
            alert(`O arquivo ${file.name} ultrapassa 1.5MB. Favor selecionar documentos em PDF menores para evitar lentidão.`);
            continue;
          }

          console.log(`Processando e convertendo arquivo localmente: ${file.name}`);
          const compressedDataURL = await compressAndToDataURL(file);
          console.log(`Upload local concluído: ${file.name}.`);
          newFiles.push({ 
            name: file.name, 
            url: compressedDataURL, 
            uploadedAt: new Date().toISOString() 
          });
        }
        
        console.log('Todos os uploads locais concluídos com sucesso.');
        setSelectedFiles(prev => [...prev, ...newFiles]);
      } catch (error) {
        console.error("Erro no upload local do arquivo:", error);
        alert("Erro ao fazer processar imagem: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setUploading(false);
        console.log('Upload concluído.');
      }
    }
  };

  const toggleTooth = (toothNumber: number) => {
    setTreatedTeeth(prev => 
      prev.includes(toothNumber) ? prev.filter(t => t !== toothNumber) : [...prev, toothNumber]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use existing registration number if valid (8 digits), otherwise generate/correct it
      const numeroRegistro = getPatientId({ ...initialData, ...formData });
      
      const patientData = {
        ...formData,
        numeroRegistro,
        treatedTeeth,
        files: selectedFiles,
        plannedProcedures: patientProcedures,
        amountPaid: amountPaid,
        payments: paymentHistory,
      };
      
      console.log('Salvando paciente com arquivos:', patientData.files);

      if (initialData) {
        const finalId = getPatientId({ id: initialData.id, ...formData });
        await updateDoc(doc(db, 'pacientes', initialData.id), {
          ...patientData,
          numeroRegistro: finalId,
          updatedAt: new Date().toISOString()
        });
        alert('Paciente atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'pacientes'), {
          ...patientData,
          ownerId: auth.currentUser?.uid,
          createdAt: new Date().toISOString()
        });
        
        // After creation, generate ID based on the actual doc ID
        const finalId = generatePatientDisplayId(docRef.id);
        await updateDoc(docRef, { numeroRegistro: finalId });
        
        alert('Paciente cadastrado com sucesso!');
        setFormData({
          nome: '',
          cpf: '',
          dataNascimento: '',
          email: '',
          telefone: '',
          endereco: '',
          alergias: '',
          medicamentos: '',
          historico: '',
          planoTratamento: '',
          dentistaId: ''
        });
        setSelectedFiles([]);
        setTreatedTeeth([]);
        setPatientProcedures([]);
        setAmountPaid(0);
        setPaymentHistory([]);
        setSelectedProcToAbate('');
        setPaymentInputVal('0,00');
      }
      console.log('Chamando onSuccess().');
      onSuccess?.();
    } catch (error) {
      console.error('Erro detalhado ao salvar paciente:', error);
      alert('Erro ao salvar. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const totalTreatmentValue = patientProcedures.reduce((acc, curr) => acc + (parseFloat(curr.value as any) || 0), 0);
  const remainingBalance = Math.max(0, totalTreatmentValue - amountPaid);

  const defaultCategories = [
    'Clínica Geral',
    'Ortodontia',
    'Endodontia',
    'Periodontia',
    'Implantodontia',
    'Prótese / Reabilitação',
    'Estética Dental',
    'Cirurgia Oral',
    'Odontopediatria',
    'Outros'
  ];

  // Especialidades cadastradas nos procedimentos e nos dentistas dinamicamente
  const registeredCategories = Array.from(new Set([
    ...defaultCategories,
    ...availableProcedures.map(p => p.category).filter(Boolean),
    ...dentists.map(d => d.specialty).filter(Boolean)
  ])).filter(Boolean).sort();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto bg-white p-2 sm:p-6 md:p-8 rounded-xl sm:rounded-3xl border border-neutral-200/85 shadow-sm overflow-x-hidden sm:overflow-x-visible min-w-0"
    >
      <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 text-neutral-800 px-1 sm:px-0">
        <User className="text-blue-600" /> Prontuário Digital
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Caixa Separada: Cadastro de Paciente */}
        <div className="bg-neutral-50/50 p-2.5 sm:p-6 rounded-xl sm:rounded-3xl border border-neutral-200/85 shadow-xs space-y-4 sm:space-y-6 min-w-0 w-full overflow-x-hidden">
          <h3 className="text-sm sm:text-base font-bold text-neutral-800 flex items-center gap-2 pb-3 border-b border-neutral-200/60 px-1 sm:px-0">
            <User size={18} className="text-blue-500" /> Cadastro de Paciente
            {initialData && (
                <span className="ml-auto text-[10px] text-neutral-400 font-mono italic">
                    ID: {getPatientId(initialData)}
                </span>
            )}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-1 sm:px-0">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">ID / Nº Registro</label>
              <input 
                type="text" 
                readOnly
                value={getPatientId(initialData)} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-neutral-100 border border-neutral-200 rounded-2xl outline-none font-mono text-xs font-bold text-neutral-500 cursor-not-allowed" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Dentista Responsável</label>
              <select 
                value={formData.dentistaId} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                onChange={(e) => setFormData({...formData, dentistaId: e.target.value})}
              >
                  <option value="">Selecione um dentista...</option>
                  {dentists.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Nome Completo</label>
              <input 
                type="text" 
                value={formData.nome} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                required 
                onChange={(e) => setFormData({...formData, nome: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">CPF</label>
              <input 
                type="text" 
                value={formData.cpf} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                required 
                onChange={(e) => setFormData({...formData, cpf: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Data de Nascimento</label>
              <input 
                type="date" 
                value={formData.dataNascimento} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                required 
                onChange={(e) => setFormData({...formData, dataNascimento: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Email</label>
              <input 
                type="email" 
                value={formData.email} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                required 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
              />
            </div>
            <div>
              <label className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">
                <span>Telefone</span>
                {formData.telefone && (
                  <a href={`https://wa.me/55${formData.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 text-[10px] hover:underline lowercase tracking-normal font-semibold">Abrir WhatsApp</a>
                )}
              </label>
              <input 
                type="tel" 
                value={formData.telefone} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                required 
                onChange={(e) => setFormData({...formData, telefone: e.target.value})} 
              />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Endereço</label>
              <input 
                type="text" 
                value={formData.endereco} 
                className="w-full py-2.5 px-3.5 sm:py-3 sm:px-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700" 
                onChange={(e) => setFormData({...formData, endereco: e.target.value})} 
              />
            </div>
          </div>
        </div>



        {/* Caixa Separada: Odontograma Digital Interativo */}
        <div className="bg-neutral-50/50 p-2.5 sm:p-6 rounded-xl sm:rounded-3xl border border-neutral-200/85 shadow-xs space-y-4 sm:space-y-6 min-w-0 w-full overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-neutral-200/60 dx-1 sm:dx-0">
            <h3 className="text-sm sm:text-base font-bold text-neutral-800 flex items-center gap-2">
              <span className="text-base">🦷</span> Odontograma Digital Interativo
            </h3>
            <span className="self-start sm:self-auto text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {treatedTeeth.length} dente(s) marcado(s)
            </span>
          </div>

          <p className="text-xs text-neutral-500 font-semibold leading-relaxed px-1 sm:px-0">
            Toque ou clique nos dentes da arcada (superior ou inferior) para alternar a marcação. Os dentes atualmente sob tratamento serão coloridos em azul.
          </p>

          <div className="space-y-6">
            {/* Maxila (Arcada Superior) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Maxila (Arcada Superior)</span>
              </div>
              <div className="w-full max-w-full pb-1">
                <div className="flex flex-col gap-2.5 p-3 bg-white rounded-xl sm:rounded-2xl border border-neutral-200/50 justify-center w-full max-w-xs sm:max-w-md mx-auto">
                    {/* Linha 1: 18 - 11 */}
                    <div className="flex gap-1 sm:gap-1.5 justify-center pb-2 border-b border-neutral-100/80">
                      {[18,17,16,15,14,13,12,11].map((tooth) => (
                        <button 
                          type="button" 
                          key={tooth} 
                          onClick={() => toggleTooth(tooth)} 
                          className={`w-7 h-8 xs:w-8 xs:h-10 sm:w-10 sm:h-12 rounded-md sm:rounded-lg border flex flex-col items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer ${treatedTeeth.includes(tooth) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-neutral-50/80 text-neutral-600 border-neutral-200 hover:border-blue-400 hover:text-blue-600'}`}
                        >
                          <span className="text-[7px] sm:text-[8px] opacity-70 font-normal">S</span>
                          <span>{tooth}</span>
                        </button>
                      ))}
                    </div>
                    {/* Linha 2: 28 - 21 */}
                    <div className="flex gap-1 sm:gap-1.5 justify-center">
                      {[28,27,26,25,24,23,22,21].map((tooth) => (
                        <button 
                          type="button" 
                          key={tooth} 
                          onClick={() => toggleTooth(tooth)} 
                          className={`w-7 h-8 xs:w-8 xs:h-10 sm:w-10 sm:h-12 rounded-md sm:rounded-lg border flex flex-col items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer ${treatedTeeth.includes(tooth) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-neutral-50/80 text-neutral-650 border-neutral-200 hover:border-blue-400 hover:text-blue-600'}`}
                        >
                          <span className="text-[7px] sm:text-[8px] opacity-70 font-normal">S</span>
                          <span>{tooth}</span>
                        </button>
                      ))}
                    </div>
                </div>
              </div>
            </div>

            {/* Mandíbula (Arcada Inferior) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Mandíbula (Arcada Inferior)</span>
              </div>
              <div className="w-full max-w-full pb-1">
                <div className="flex flex-col gap-2.5 p-3 bg-white rounded-xl sm:rounded-2xl border border-neutral-200/50 justify-center w-full max-w-xs sm:max-w-md mx-auto">
                    {/* Linha 1: 48 - 41 */}
                    <div className="flex gap-1 sm:gap-1.5 justify-center pb-2 border-b border-neutral-100/80">
                      {[48,47,46,45,44,43,42,41].map((tooth) => (
                        <button 
                          type="button" 
                          key={tooth} 
                          onClick={() => toggleTooth(tooth)} 
                          className={`w-7 h-8 xs:w-8 xs:h-10 sm:w-10 sm:h-12 rounded-md sm:rounded-lg border flex flex-col items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer ${treatedTeeth.includes(tooth) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-neutral-50/80 text-neutral-600 border-neutral-200 hover:border-blue-400 hover:text-blue-600'}`}
                        >
                          <span>{tooth}</span>
                          <span className="text-[7px] sm:text-[8px] opacity-70 font-normal">I</span>
                        </button>
                      ))}
                    </div>
                    {/* Linha 2: 38 - 31 */}
                    <div className="flex gap-1 sm:gap-1.5 justify-center">
                      {[38,37,36,35,34,33,32,31].map((tooth) => (
                        <button 
                          type="button" 
                          key={tooth} 
                          onClick={() => toggleTooth(tooth)} 
                          className={`w-7 h-8 xs:w-8 xs:h-10 sm:w-10 sm:h-12 rounded-md sm:rounded-lg border flex flex-col items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer ${treatedTeeth.includes(tooth) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-neutral-50/80 text-neutral-600 border-neutral-200 hover:border-blue-400 hover:text-blue-600'}`}
                        >
                          <span>{tooth}</span>
                          <span className="text-[7px] sm:text-[8px] opacity-70 font-normal">I</span>
                        </button>
                      ))}
                    </div>
                </div>
              </div>
            </div>
          </div>

          {treatedTeeth.length > 0 && (
            <div className="pt-3 border-t border-neutral-200/40">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2 px-1">Dentes Selecionados:</span>
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 px-1">
                {treatedTeeth.slice().sort((a,b)=>a-b).map(t => (
                  <span key={t} className="flex sm:inline-flex items-center justify-between sm:justify-start gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-100 shadow-3xs w-full sm:w-auto">
                    <span>Dente {t}</span>
                    <button type="button" onClick={() => toggleTooth(t)} className="text-blue-400 hover:text-blue-800 font-extrabold ml-1.5 text-xs transition-colors cursor-pointer" title="Remover dente">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Seletor e Inputs para adicionar procedimento */}
          <div ref={addProcedureRef} className="bg-white p-2.5 sm:p-5 rounded-2xl border border-neutral-200/45 shadow-xs space-y-4 min-w-0 mt-6">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Adicionar Procedimento aos Dentes Selecionados</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 md:gap-4 items-end">
              
              {/* Escolha do Procedimento */}
              <div className={`${addProcState.id === 'custom' ? 'col-span-1 md:col-span-12 lg:col-span-6' : 'col-span-1 md:col-span-7 lg:col-span-7'} flex flex-col space-y-1.5`}>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Procedimento</label>
                <select 
                  className="w-full max-w-full truncate p-2.5 sm:p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 placeholder-neutral-400 focus:bg-white focus:border-blue-500 transition-all outline-none"
                  value={addProcState.id}
                  onChange={(e) => handleSelectProcChange(e.target.value)}
                >
                  <option value="">Selecione um procedimento...</option>
                  {availableProcedures.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.type} — {p.category || 'Clínica Geral'} ({parseFloat(p.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </option>
                  ))}
                  <option value="custom">✍️ Digitar procedimento avulso...</option>
                </select>
              </div>

              {/* Nome Personalizado (Se escolher custom) */}
              {addProcState.id === 'custom' && (
                <div className="col-span-1 md:col-span-6 lg:col-span-6 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Identificação do Procedimento</label>
                  <input 
                    type="text"
                    placeholder="Ex: Remoção de Pino Metálico"
                    className="w-full p-2.5 sm:p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold placeholder-neutral-400 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={addProcState.customName}
                    onChange={(e) => setAddProcState({ ...addProcState, customName: e.target.value })}
                  />
                </div>
              )}

              {/* Categoria Personalizada (Se escolher custom) */}
              {addProcState.id === 'custom' && (
                <div className="col-span-1 md:col-span-6 lg:col-span-5 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Categoria / Especialidade</label>
                  <select 
                    className="w-full max-w-full truncate p-2.5 sm:p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    value={addProcState.customCategory}
                    onChange={(e) => setAddProcState({ ...addProcState, customCategory: e.target.value })}
                  >
                    {registeredCategories.map((cat) => (
                       <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="custom_input">✍️ Digitar outra especialidade...</option>
                  </select>

                  {addProcState.customCategory === 'custom_input' && (
                    <input 
                      type="text"
                      placeholder="Digite o nome da especialidade..."
                      className="w-full p-2.5 sm:p-3 mt-1.5 bg-white border border-blue-400 rounded-xl text-sm font-bold placeholder-neutral-400 focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                      value={addProcState.customCategoryTyped}
                      onChange={(e) => setAddProcState({ ...addProcState, customCategoryTyped: e.target.value })}
                    />
                  )}
                </div>
              )}

              {/* Preço / Valor */}
              <div className={`${addProcState.id === 'custom' ? 'col-span-1 md:col-span-8 lg:col-span-4' : 'col-span-1 md:col-span-3 lg:col-span-2'} flex flex-col space-y-1.5`}>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Valor Cobrado (R$)</label>
                <input 
                  type="text"
                  placeholder="0,00"
                  className="w-full p-2.5 sm:p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 placeholder-neutral-400 focus:bg-white focus:border-blue-500 transition-all outline-none"
                  value={addProcState.value}
                  onChange={(e) => setAddProcState({ ...addProcState, value: e.target.value })}
                />
              </div>

              {/* Botão Adicionar */}
              <div className={`${addProcState.id === 'custom' ? 'col-span-1 md:col-span-4 lg:col-span-3' : 'col-span-1 md:col-span-2 lg:col-span-3'} flex items-end`}>
                <button
                  type="button"
                  onClick={handleAddProcedureToList}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Planejamento de Tratamentos e Orçamento */}
          <div className="space-y-4 pt-6 border-t border-neutral-100">
            <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2 px-1 sm:px-0">
              <DollarSign size={18} className="text-emerald-600" /> Planejamento de Tratamento e Orçamento
            </h3>
            
            <div className="bg-neutral-50/50 p-2 sm:p-6 rounded-2xl border border-neutral-200/60 space-y-6 min-w-0 w-full">
              
              {/* Lista dos Procedimentos Planejados */}
              <div className="space-y-3">

                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Procedimentos Adicionados ao Tratamento ({patientProcedures.length})
                </h4>
                
                {patientProcedures.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-dashed border-neutral-200 rounded-2xl text-xs font-semibold text-neutral-400 leading-relaxed shadow-sm">
                    ⚠️ Nenhum procedimento adicionado ao tratamento desse paciente ainda.<br />
                    Selecione no menu de inclusão acima para iniciar o planejamento financeiro do prontuário.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {patientProcedures.map((proc, index) => {
                      const paidForThisProc = paymentHistory.filter(p => p.procedureId === proc.tempId).reduce((sum, p) => sum + (p.amount || 0), 0);
                      const balance = Math.max(0, (parseFloat(proc.value) || 0) - paidForThisProc);
                      const isCompleted = proc.status === 'finalizado';
                      
                      return (
                        <div key={proc.tempId || index} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border ${isCompleted ? 'border-green-200 bg-green-50/10' : 'border-neutral-200/50'} shadow-xs hover:border-neutral-300 transition-all gap-4 min-w-0`}>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <p className={`text-sm font-bold break-words pr-1 ${isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>{proc.type}</p>
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold">
                                  ✓ Finalizado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold">
                                  Em curso
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block text-[10px] font-bold uppercase py-0.5 px-2 bg-neutral-100 text-neutral-500 rounded-md">
                                {proc.category || 'Clínica Geral'}
                              </span>
                              {proc.associatedTeeth && proc.associatedTeeth.length > 0 && (
                                <span className="inline-block text-[10px] font-bold uppercase py-0.5 px-2 bg-blue-100 text-blue-700 rounded-md">
                                  Dentes: {proc.associatedTeeth.sort((a:number, b:number) => a - b).join(', ')}
                                </span>
                              )}
                              {balance <= 0 && (parseFloat(proc.value) || 0) > 0 && (
                                <span className="inline-block text-[10px] font-bold py-0.5 px-2 bg-emerald-100 text-emerald-700 rounded-md">
                                  Totalmente Quitado
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            {/* Valores do procedimento e abatimento */}
                            <div className="text-left sm:text-right space-y-0.5 min-w-[110px]">
                              <div className="text-xs font-bold text-neutral-400">
                                Valor: {(parseFloat(proc.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                              {paidForThisProc > 0 && (
                                <div className="text-[11px] font-bold text-emerald-600">
                                  Abatido: {paidForThisProc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              )}
                              {balance > 0 && paidForThisProc > 0 && (
                                <div className="text-xs font-black text-neutral-800">
                                  Restante: {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                              {/* Botão de Finalizar */}
                              <button
                                type="button"
                                onClick={() => toggleProcedureStatus(index)}
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 border ${
                                  isCompleted 
                                    ? 'bg-neutral-50 border-neutral-200 text-neutral-400 hover:bg-neutral-100' 
                                    : 'bg-green-600 border-green-700 text-white hover:bg-green-700 shadow-sm active:scale-95'
                                }`}
                                title="Marcar status do tratamento"
                              >
                                <CheckSquare size={13} />
                                <span>{isCompleted ? 'Finalizado' : 'Finalizar'}</span>
                                <span className="hidden sm:inline">{!isCompleted && ' Tratamento'}</span>
                              </button>

                              {/* Quick link button to record an instant abatement for this exact procedure */}
                              {balance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProcToAbate(proc.tempId);
                                    setPaymentInputVal(String(balance).replace('.', ','));
                                  }}
                                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                                  title="Preparar abatimento para este procedimento"
                                >
                                  <DollarSign size={13} /> Abater
                                </button>
                              )}

                              {/* Botão de Excluir */}
                              <button
                                type="button"
                                onClick={() => handleRemoveProcedureFromList(index)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remover procedimento do planejamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bloco de Totais de Resumo e Abatimentos */}
              <div className="pt-4 border-t border-neutral-200/80">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start min-w-0">
                  
                  {/* Custos Totais e Histórico de Abatimentos */}
                  <div className="space-y-4">
                    {/* Custos Totais */}
                    <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-neutral-200/40 flex flex-col justify-between space-y-1 shadow-xs min-w-0">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Soma Total do Orçamento</span>
                      <span className="text-xl font-black tracking-tight text-neutral-800">
                        {totalTreatmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    {/* Histórico dos Valores Abatidos */}
                    <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-neutral-200/40 space-y-3 sm:space-y-3.5 shadow-xs min-w-0">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        💵 Valores Abatidos (Histórico)
                      </span>
                      
                      {paymentHistory.length === 0 ? (
                        <p className="text-[11px] font-semibold text-neutral-400 italic leading-relaxed">
                          Nenhum abatimento cadastrado no prontuário ainda.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                          {paymentHistory.map((pay) => {
                            const dateObj = new Date(pay.date);
                            const formattedDate = isNaN(dateObj.getTime()) ? 'Data indisponível' : dateObj.toLocaleDateString('pt-BR');
                            const formattedTime = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            return (
                              <div key={pay.id} className="text-left border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0">
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                  <span className="text-xs font-bold text-neutral-800 leading-tight break-words flex-1 min-w-0 pr-2">
                                    {pay.procedureName || 'Abatimento Geral'}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-black text-emerald-600">
                                      -{pay.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                    {pay.id !== 'legacy-payment' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePayment(pay.id)}
                                        className="p-0.5 text-neutral-400 hover:text-red-500 rounded-md hover:bg-neutral-50 transition-colors"
                                        title="Remover lançamento"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight block mt-0.5">
                                  {formattedDate} {formattedTime ? `às ${formattedTime}` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lançamento / Abatimento de Pagamentos */}
                  <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-neutral-200/40 space-y-3 sm:space-y-4 shadow-xs min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">Registrar Valor Pago (Abatimento)</span>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Vincular a Procedimento</label>
                      <select 
                        className="w-full max-w-full truncate p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                        value={selectedProcToAbate}
                        onChange={(e) => setSelectedProcToAbate(e.target.value)}
                      >
                        <option value="">-- Abatimento Geral (Sem vincular) --</option>
                        {patientProcedures.map((proc, idx) => {
                          const paidForThisProc = paymentHistory.filter(p => p.procedureId === proc.tempId).reduce((sum, p) => sum + (p.amount || 0), 0);
                          const balance = Math.max(0, (parseFloat(proc.value) || 0) - paidForThisProc);
                          return (
                            <option key={proc.tempId || idx} value={proc.tempId} disabled={balance <= 0}>
                              {proc.type} (Restante: {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Valor do Lançamento</label>
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <span className="text-neutral-400 text-xs font-bold">R$</span>
                          </div>
                          <input 
                            type="text"
                            placeholder="0,00"
                            className="w-full pl-8 pr-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all text-center"
                            value={paymentInputVal}
                            onChange={(e) => handlePaymentInputChange(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterPayment}
                          className="h-[42px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shadow-sm shrink-0"
                        >
                          Lançar
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickAbate(50)}
                        className="text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 bg-emerald-50 py-1.5 px-2 rounded-lg transition-all select-none"
                      >
                        + R$ 50
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAbate(100)}
                        className="text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 bg-emerald-50 py-1.5 px-2 rounded-lg transition-all select-none"
                      >
                        + R$ 100
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAbate(500)}
                        className="text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 bg-emerald-50 py-1.5 px-2 rounded-lg transition-all select-none"
                      >
                        + R$ 500
                      </button>
                      <button
                        type="button"
                        onClick={handleAbateAll}
                        className="text-[9px] font-bold text-blue-700 hover:bg-blue-100 bg-blue-50 py-1.5 px-2 rounded-lg transition-all select-none"
                      >
                        Quitar Tudo
                      </button>
                    </div>
                  </div>

                  {/* Saldo Restante Devedor */}
                  <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-neutral-200/40 flex flex-col justify-between space-y-1 shadow-xs self-stretch min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Saldo Restante</span>
                    <div className="flex flex-col gap-1">
                      <span className={`text-xl font-black tracking-tight ${remainingBalance <= 0 && totalTreatmentValue > 0 ? 'text-green-600' : 'text-neutral-800'}`}>
                        {remainingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <div>
                        {remainingBalance <= 0 && totalTreatmentValue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-bold">
                            <CheckCircle2 size={10} /> Tratamento Totalmente Quitado!
                          </span>
                        ) : totalTreatmentValue > 0 ? (
                          <span className="inline-block text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold">
                            Pendência de {( (remainingBalance / totalTreatmentValue) * 100 ).toFixed(0)}% do valor total
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-md font-bold">
                            Total zerado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 px-1 sm:px-0">Radiografias e Documentos</label>
            <div className="relative border-2 border-dashed border-neutral-300 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors min-w-0">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} disabled={uploading}/>
                <div className="p-3 bg-neutral-100 rounded-full text-neutral-600">
                    <Save size={20} />
                </div>
                <div className="text-sm font-bold text-neutral-600">Clique para enviar ou arraste e solte</div>
                <div className="text-xs text-neutral-400">arquivos JPEG, PNG ou PDF</div>
                {uploading && <div className="text-xs text-blue-600 flex items-center gap-1 font-bold mt-2"><Loader2 className="animate-spin" size={14}/> Enviando...</div>}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4 min-w-0">
                {selectedFiles.map((file, i) => {
                    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.url.startsWith('data:application/pdf');
                    return (
                        <div key={i} className="border border-neutral-200 bg-neutral-50 p-2.5 rounded-xl shadow-xs flex flex-col gap-2.5 min-w-0">
                            {/* Visual Preview */}
                            <div className="w-full h-28 sm:h-32 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-neutral-100 shrink-0 relative group">
                                {isPDF ? (
                                    <div className="flex flex-col items-center justify-center gap-1 text-neutral-500 p-2">
                                        <FileText className="text-red-500" size={32} />
                                        <span className="text-[10px] font-medium text-center truncate max-w-[130px]" title={file.name}>
                                            {file.name}
                                        </span>
                                    </div>
                                ) : (
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                )}
                            </div>
                            
                            {/* File labels and date of upload */}
                            <div className="flex-1 space-y-0.5">
                                <span className="text-xs font-bold text-neutral-800 line-clamp-1 block" title={file.name}>
                                    {file.name}
                                </span>
                                <span className="text-[9px] font-semibold text-neutral-400 block">
                                    Enviado em: {formatUploadDate(file.uploadedAt, initialData?.createdAt)}
                                </span>
                            </div>
                            
                            {/* Action Buttons Outside Image */}
                            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-neutral-100">
                                {!isPDF ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setPreviewFile(file)} 
                                        className="bg-blue-50 text-blue-600 font-bold px-1.5 py-2 rounded-xl text-[10px] sm:text-xs hover:bg-blue-100 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors"
                                    >
                                        <Maximize2 size={12} /> Aumentar
                                    </button>
                                ) : (
                                    <a 
                                        href={file.url} 
                                        download={file.name}
                                        className="bg-blue-50 text-blue-600 font-bold px-1.5 py-2 rounded-xl text-[10px] sm:text-xs hover:bg-blue-100 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors text-center"
                                    >
                                        <Eye size={12} /> Ver/Baixar
                                    </a>
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => setFileToDeleteIndex(i)} 
                                    className="bg-red-50 text-red-600 font-bold px-1.5 py-2 rounded-xl text-[10px] sm:text-xs hover:bg-red-100 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors"
                                >
                                    <Trash2 size={12} /> Excluir
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

        {/* Caixa Separada: Informações Médicas e Prontuário */}
        <div className="bg-neutral-50/50 p-2.5 sm:p-6 rounded-xl sm:rounded-3xl border border-neutral-200/85 shadow-xs space-y-4 sm:space-y-6 min-w-0 w-full overflow-x-hidden">
          <h3 className="text-sm sm:text-base font-bold text-neutral-800 flex items-center gap-2 pb-3 border-b border-neutral-200/60 px-1 sm:px-0">
            <AlertCircle size={18} className="text-amber-500" /> Informações Médicas e Prontuário
          </h3>
          
          {/* Planejamento de Tratamentos e Orçamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest px-1 sm:px-0">Alergias</label>
              <textarea 
                value={formData.alergias} 
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700 min-h-[90px]" 
                onChange={(e) => setFormData({...formData, alergias: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest px-1 sm:px-0">Medicamentos em uso</label>
              <textarea 
                value={formData.medicamentos} 
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700 min-h-[90px]" 
                onChange={(e) => setFormData({...formData, medicamentos: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest px-1 sm:px-0">Histórico de procedimentos completo</label>
            <textarea 
              value={formData.historico} 
              className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700 min-h-[110px]" 
              onChange={(e) => setFormData({...formData, historico: e.target.value})} 
            />
          </div>
          
          <div className="space-y-4 pt-4 border-t border-neutral-100 mt-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest px-1 sm:px-0">Plano de tratamento com orçamento</label>
              <textarea 
                value={formData.planoTratamento} 
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm text-neutral-700 min-h-[110px]" 
                onChange={(e) => setFormData({...formData, planoTratamento: e.target.value})} 
              />
            </div>
          </div>
        </div>

          {/* Lightbox / Visualizador Ampliado de Fotos */}
          {previewFile && (
            <div 
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-opacity"
              onClick={() => setPreviewFile(null)}
            >
              <div 
                className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header com nome e fechar */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl shrink-0">
                  <span className="font-bold text-sm text-neutral-800 truncate pr-4 max-w-[170px] sm:max-w-md">
                    {previewFile.name}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setPreviewFile(null)}
                    className="text-neutral-500 hover:text-neutral-800 font-bold text-base p-1.5 transition-colors border border-neutral-200 bg-white rounded-lg shadow-sm hover:shadow"
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>
                {/* Imagem Ampliada */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-neutral-900 max-h-[75vh]">
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.name} 
                    className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-lg border border-neutral-700"
                  />
                </div>
                {/* Rodapé com Download e Fechar */}
                <div className="px-4 sm:px-6 py-4 bg-neutral-50 text-xs text-neutral-500 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center rounded-b-2xl shrink-0">
                  <span className="font-semibold text-neutral-500">Enviado em: {formatUploadDate(previewFile.uploadedAt, initialData?.createdAt)}</span>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <a 
                      href={previewFile.url} 
                      download={previewFile.name}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm text-center"
                    >
                      Download
                    </a>
                    <button 
                      type="button" 
                      onClick={() => setPreviewFile(null)}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Confirmação de Exclusão de Arquivo */}
          {fileToDeleteIndex !== null && (
            <div 
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setFileToDeleteIndex(null)}
            >
              <div 
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-neutral-100 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-red-600 mb-4">
                  <div className="p-2.5 bg-red-50 rounded-xl">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">Confirmar Exclusão</h3>
                </div>
                <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                  Tem certeza de que deseja excluir o arquivo <strong className="text-neutral-800 break-all">"{selectedFiles[fileToDeleteIndex]?.name}"</strong>? Esta ação removerá definitivamente o arquivo deste prontuário ao salvar as alterações do paciente.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFileToDeleteIndex(null)}
                    className="flex-1 py-3 px-4 font-bold text-sm text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles(selectedFiles.filter((_, idx) => idx !== fileToDeleteIndex));
                      setFileToDeleteIndex(null);
                    }}
                    className="flex-1 py-3 px-4 font-bold text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            </div>
          )}



        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
          <Save size={20} /> {loading ? (initialData ? 'Atualizando...' : 'Cadastrando...') : (initialData ? 'Atualizar Paciente' : 'Cadastrar Paciente')}
        </button>
      </form>
    </motion.div>
  );
}
