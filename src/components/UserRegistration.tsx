import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc } from '../lib/supabaseAdapter';
import { robustSetDoc, robustGetDoc } from '../lib/FirestoreUtils';
import { motion } from 'motion/react';
import { User, Save, ClipboardList, MapPin, Calendar, Mail, UserCheck, Phone } from 'lucide-react';

interface UserRegistrationProps {
  onComplete: () => void;
}

export default function UserRegistration({ onComplete }: UserRegistrationProps) {
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    cpf: '',
    whatsapp: '',
    dataNascimento: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: 'SP',
    dataCadastro: new Date().toLocaleDateString('pt-BR')
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        console.log('[UserRegistration] Buscando dados para UID:', uid);
        
        try {
          // 1. Tentar carregar do banco de dados (Supabase)
          const userDocRef = doc(db, 'users', uid);
          const userDocSnap = await robustGetDoc(userDocRef);
          
          let data: any = null;
          
          if (userDocSnap.exists()) {
            data = userDocSnap.data();
            console.log('[UserRegistration] Dados carregados do banco:', data);
          } else {
            console.log('[UserRegistration] Nenhum dado no banco, tentando cache local...');
            // 2. Tentar carregar do cache local (localStorage fallback)
            const cached = localStorage.getItem(`user_profile_${uid}`);
            if (cached) {
              data = JSON.parse(cached);
              console.log('[UserRegistration] Dados carregados do cache local:', data);
            }
          }
          
          if (data) {
            setUserData(prev => ({
              ...prev,
              nome: data.nome || prev.nome || auth.currentUser?.displayName || '',
              email: data.email || prev.email || auth.currentUser?.email || '',
              cpf: data.cpf || prev.cpf || '',
              whatsapp: data.whatsapp || prev.whatsapp || '',
              dataNascimento: data.dataNascimento || prev.dataNascimento || '',
              endereco: data.endereco || prev.endereco || '',
              bairro: data.bairro || prev.bairro || '',
              cidade: data.cidade || prev.cidade || '',
              estado: data.estado || prev.estado || 'SP',
              dataCadastro: data.dataCadastro || (data.createdAt ? new Date(data.createdAt).toLocaleDateString('pt-BR') : prev.dataCadastro)
            }));
          } else {
            console.log('[UserRegistration] Iniciando com dados básicos do Auth');
            setUserData(prev => ({
              ...prev,
              nome: auth.currentUser?.displayName || '',
              email: auth.currentUser?.email || ''
            }));
          }
        } catch (err) {
          console.error('[UserRegistration] Erro ao carregar dados:', err);
        }
      }
    };

    fetchInitialData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    setLoading(true);
    const uid = auth.currentUser.uid;
    console.log('[UserRegistration] Salvando dados para:', uid, userData);
    
    try {
      const payload = {
        ...userData,
        id: uid,
        ownerId: uid,
        updatedAt: new Date().toISOString()
      };
      
      // 1. Salvar no Banco (Supabase via Adapter)
      const userDocRef = doc(db, 'users', uid);
      await robustSetDoc(userDocRef, payload);
      
      // 2. Salvar no Cache Local (Backup)
      localStorage.setItem(`user_profile_${uid}`, JSON.stringify(payload));
      
      console.log('[UserRegistration] Sucesso total ao salvar');
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error('[UserRegistration] Erro ao salvar:', error);
      alert(`Erro ao salvar os dados: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-neutral-100 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-neutral-900 px-8 py-10 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <UserCheck className="text-blue-400" />
              Cadastro de Usuário
            </h2>
            <p className="text-neutral-400 mt-2">Complete suas informações para continuar</p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {/* Sessão: Informações Pessoais */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-neutral-900 font-bold border-b border-neutral-100 pb-2">
              <ClipboardList size={20} className="text-blue-600" />
              <h3>Dados Pessoais</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <User size={14} /> Nome Completo
                </label>
                <input 
                  type="text"
                  value={userData.nome}
                  onChange={(e) => setUserData({...userData, nome: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="Nome Completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <Mail size={14} /> Email
                </label>
                <input 
                  type="email" 
                  value={userData.email}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <ClipboardList size={14} /> CPF
                </label>
                <input 
                  type="text"
                  value={userData.cpf}
                  onChange={(e) => setUserData({...userData, cpf: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <Phone size={14} /> WhatsApp / Telefone
                </label>
                <input 
                  type="text"
                  value={userData.whatsapp}
                  onChange={(e) => setUserData({...userData, whatsapp: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <Calendar size={14} /> Data de Nascimento
                </label>
                <input 
                  type="date"
                  value={userData.dataNascimento}
                  onChange={(e) => setUserData({...userData, dataNascimento: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <Calendar size={14} /> Data de Cadastro
                </label>
                <input 
                  type="text"
                  value={userData.dataCadastro}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sessão: Endereço */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-neutral-900 font-bold border-b border-neutral-100 pb-2">
              <MapPin size={20} className="text-blue-600" />
              <h3>Localização</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3 space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1 flex items-center gap-2">
                  <MapPin size={14} /> Endereço
                </label>
                <input 
                  type="text"
                  value={userData.endereco}
                  onChange={(e) => setUserData({...userData, endereco: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="Rua, Número, Complemento"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1">Bairro</label>
                <input 
                  type="text"
                  value={userData.bairro}
                  onChange={(e) => setUserData({...userData, bairro: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="Bairro"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1">Cidade</label>
                <input 
                  type="text"
                  value={userData.cidade}
                  onChange={(e) => setUserData({...userData, cidade: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50"
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 ml-1">Estado</label>
                <select
                  value={userData.estado}
                  onChange={(e) => setUserData({...userData, estado: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none bg-neutral-50 font-medium"
                >
                  <option value="AC">Acre</option>
                  <option value="AL">Alagoas</option>
                  <option value="AP">Amapá</option>
                  <option value="AM">Amazonas</option>
                  <option value="BA">Bahia</option>
                  <option value="CE">Ceará</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="ES">Espírito Santo</option>
                  <option value="GO">Goiás</option>
                  <option value="MA">Maranhão</option>
                  <option value="MT">Mato Grosso</option>
                  <option value="MS">Mato Grosso do Sul</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PA">Pará</option>
                  <option value="PB">Paraíba</option>
                  <option value="PR">Paraná</option>
                  <option value="PE">Pernambuco</option>
                  <option value="PI">Piauí</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="RN">Rio Grande do Norte</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="RO">Rondônia</option>
                  <option value="RR">Roraima</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="SP">São Paulo</option>
                  <option value="SE">Sergipe</option>
                  <option value="TO">Tocantins</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-8 flex items-center justify-end gap-4 border-t border-neutral-100">
            {saveSuccess && (
              <motion.span 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-green-600 font-bold flex items-center gap-2"
              >
                <UserCheck size={18} /> Dados salvos com sucesso!
              </motion.span>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save size={20} />
              )}
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
