import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

interface QuickResponse {
  id: string;
  text: string;
  tag: string;
}

const CATEGORIES = ['Agendamento', 'Pós-operatório', 'Dúvidas Financeiras', 'Boas-vindas'];

export default function QuickResponsesManager() {
  const [responses, setResponses] = useState<QuickResponse[]>([]);
  const [newResponse, setNewResponse] = useState('');
  const [newTag, setNewTag] = useState(CATEGORIES[0]);
  const [filterTag, setFilterTag] = useState<string>('Todas');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingTag, setEditingTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'quick_responses'), where('ownerId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setResponses(snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text, tag: doc.data().tag || 'Geral' })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async () => {
    if (!newResponse.trim() || !auth.currentUser) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'quick_responses'), { 
          text: newResponse.trim(), 
          tag: newTag,
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp() 
      });
      setNewResponse('');
      setNewTag(CATEGORIES[0]);
    } catch(e) {
        console.error(e);
    }
    setIsSaving(false);
  };

  const handleEdit = async (id: string) => {
    if (!editingText.trim()) return;
    setIsSaving(true);
    try {
        await updateDoc(doc(db, 'quick_responses', id), { text: editingText.trim(), tag: editingTag });
        setEditingId(null);
    } catch(e) {
        console.error(e);
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'quick_responses', id));
  };

  const filteredResponses = filterTag === 'Todas' 
      ? responses 
      : responses.filter(r => r.tag === filterTag);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-neutral-900">Gerenciar Respostas Rápidas</h3>
        
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="p-2 border rounded-xl text-sm">
            <option>Todas</option>
            {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
        </select>
      </div>
      
      <div className="flex gap-2">
        <input 
          value={newResponse} 
          onChange={(e) => setNewResponse(e.target.value)}
          placeholder="Nova resposta..."
          className="flex-1 p-3 border rounded-xl"
        />
        <select value={newTag} onChange={(e) => setNewTag(e.target.value)} className="p-3 border rounded-xl">
          {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
        </select>
        <button onClick={handleAdd} disabled={isSaving} className="bg-emerald-600 text-white p-3 rounded-xl">
            {isSaving ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Plus size={20} />}
        </button>
      </div>

      <div className="space-y-2">
        {filteredResponses.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                {editingId === r.id ? (
                    <>
                        <input value={editingText} onChange={(e) => setEditingText(e.target.value)} className="flex-1 p-2"/>
                        <select value={editingTag} onChange={(e) => setEditingTag(e.target.value)} className="p-2 border rounded">
                          {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                        </select>
                        <button onClick={() => handleEdit(r.id)} disabled={isSaving} className="p-2 bg-emerald-600 text-white rounded-lg">
                           {isSaving ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16}/>}
                        </button>
                        <button onClick={() => setEditingId(null)}><X size={16}/></button>
                    </>
                ) : (
                    <>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-1 rounded-full font-bold">{r.tag}</span>
                        <span className="flex-1 text-sm">{r.text}</span>
                        <button onClick={() => { setEditingId(r.id); setEditingText(r.text); setEditingTag(r.tag); }}><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-500"><Trash2 size={16}/></button>
                    </>
                )}
            </div>
        ))}
      </div>
    </div>
  );
}
