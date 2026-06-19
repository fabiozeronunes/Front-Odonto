import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from '../lib/supabaseAdapter';
import { Loader2, Camera, Save } from 'lucide-react';

export default function Profile({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    cpf: '',
    whatsapp: '',
    dataNascimento: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data() as typeof userData);
        } else {
          setUserData(prev => ({ ...prev, nome: auth.currentUser?.displayName || '', email: auth.currentUser?.email || '' }));
        }
      }
    };
    fetchUserData();
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: userData.nome });
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, userData, { merge: true });
        alert('Perfil atualizado com sucesso!');
        onNavigate('dashboard');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = () => {
    alert('Funcionalidade de upload de foto em desenvolvimento.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Meu Perfil</h2>
      
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-xs space-y-6">
        <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 relative">
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-3xl text-neutral-400 font-bold">
                    {userData.nome.substring(0, 2).toUpperCase()}
                  </span>
                )}
                <button onClick={handlePhotoUpload} className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                    <Camera size={16} />
                </button>
            </div>
            <div>
                <h3 className="text-lg font-bold">{userData.nome}</h3>
                <p className="text-neutral-500">{userData.email}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nome Completo</label>
                <input type="text" value={userData.nome} onChange={(e) => setUserData({...userData, nome: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail</label>
                <input type="email" value={userData.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-neutral-50" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">CPF</label>
                <input type="text" value={userData.cpf} onChange={(e) => setUserData({...userData, cpf: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Data de Nascimento</label>
                <input type="date" value={userData.dataNascimento} onChange={(e) => setUserData({...userData, dataNascimento: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">WhatsApp</label>
                <input type="text" value={userData.whatsapp} onChange={(e) => setUserData({...userData, whatsapp: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Endereço</label>
                <input type="text" value={userData.endereco} onChange={(e) => setUserData({...userData, endereco: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Bairro</label>
                <input type="text" value={userData.bairro} onChange={(e) => setUserData({...userData, bairro: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cidade</label>
                <input type="text" value={userData.cidade} onChange={(e) => setUserData({...userData, cidade: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
                <input type="text" value={userData.estado} onChange={(e) => setUserData({...userData, estado: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-neutral-300" />
            </div>
            <button 
                onClick={handleUpdate}
                disabled={loading}
                className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Salvar Alterações
            </button>
        </div>
      </div>
    </div>
  );
}
