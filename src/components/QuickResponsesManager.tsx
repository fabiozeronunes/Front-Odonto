import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Edit2, Save, X, Tag } from 'lucide-react';

interface QuickResponse {
  id: string;
  text: string;
  tag: string;
}

export default function QuickResponsesManager() {
  const [responses, setResponses] = useState<QuickResponse[]>([]);
  const [categories, setCategories] = useState<string[]>(['Agendamento', 'Pós-operatório', 'Dúvidas Financeiras', 'Boas-vindas']);
  const [newResponse, setNewResponse] = useState('');
  const [newTag, setNewTag] = useState(categories[0]);
  const [filterTag, setFilterTag] = useState<string>('Todas');
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingTag, setEditingTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const qResponses = query(collection(db, 'quick_responses'), where('ownerId', '==', auth.currentUser.uid));
    const unsubResponses = onSnapshot(qResponses, (snapshot) => {
      setResponses(snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text, tag: doc.data().tag || 'Geral' })));
    });

    const qCategories = query(collection(db, 'response_categories'), where('ownerId', '==', auth.currentUser.uid));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().name);
      setCategories(prev => [...new Set([...['Agendamento', 'Pós-operatório', 'Dúvidas Financeiras', 'Boas-vindas'], ...cats])]);
    });

    return () => { unsubResponses(); unsubCategories(); };
  }, []);

  const handleAdd = async () => {
    if (!newResponse.trim() || !auth.currentUser) return;
    setIsSaving(true);
    await addDoc(collection(db, 'quick_responses'), { text: newResponse.trim(), tag: newTag, ownerId: auth.currentUser.uid, createdAt: serverTimestamp() });
    setNewResponse('');
    setIsSaving(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !auth.currentUser) return;
    await addDoc(collection(db, 'response_categories'), { name: newCategory.trim(), ownerId: auth.currentUser.uid });
    setNewCategory('');
    setIsAddingCategory(false);
  };

  const handleEdit = async (id: string) => {
    if (!editingText.trim()) return;
    await updateDoc(doc(db, 'quick_responses', id), { text: editingText.trim(), tag: editingTag });
    setEditingId(null);
  };

  const handleDelete = async (id: string, collectionName: string) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const filteredResponses = filterTag === 'Todas' ? responses : responses.filter(r => r.tag === filterTag);

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-neutral-100 space-y-8">
      <div className="flex justify-between items-center pb-6 border-b border-neutral-100">
        <h3 className="text-xl font-bold text-neutral-900">Gerenciar Respostas Rápidas</h3>
        
        <div className="flex gap-2 items-center">
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800">
                <option>Todas</option>
                {categories.map(cat => <option key={cat}>{cat}</option>)}
            </select>
            <button onClick={() => setIsAddingCategory(true)} className="p-3 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200"><Tag size={20}/></button>
        </div>
      </div>
      
      {isAddingCategory && (
          <div className="flex gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria..." className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl"/>
              <button onClick={handleAddCategory} className="bg-emerald-600 text-white px-4 py-2 rounded-xl">Salvar</button>
              <button onClick={() => setIsAddingCategory(false)} className="text-neutral-500 px-4 py-2">Cancelar</button>
          </div>
      )}

      <div className="flex gap-3">
        <input value={newResponse} onChange={(e) => setNewResponse(e.target.value)} placeholder="Nova resposta..." className="flex-1 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-800" />
        <select value={newTag} onChange={(e) => setNewTag(e.target.value)} className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-800">
          {categories.map(cat => <option key={cat}>{cat}</option>)}
        </select>
        <button onClick={handleAdd} disabled={isSaving} className="bg-emerald-600 text-white px-6 rounded-2xl font-black uppercase text-xs">{isSaving ? '...' : 'Adicionar'}</button>
      </div>

      <div className="space-y-3">
        {filteredResponses.map(r => (
            <div key={r.id} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                {editingId === r.id ? (
                    <>
                        <input value={editingText} onChange={(e) => setEditingText(e.target.value)} className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl"/>
                        <select value={editingTag} onChange={(e) => setEditingTag(e.target.value)} className="p-3 bg-white border border-neutral-200 rounded-xl">
                          {categories.map(cat => <option key={cat}>{cat}</option>)}
                        </select>
                        <button onClick={() => handleEdit(r.id)} disabled={isSaving} className="p-3 bg-emerald-600 text-white rounded-xl"><Save size={18}/></button>
                        <button onClick={() => setEditingId(null)} className="p-3 bg-red-100 text-red-600 rounded-xl"><X size={18}/></button>
                    </>
                ) : (
                    <>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-wider">{r.tag}</span>
                        <span className="flex-1 text-sm font-medium text-neutral-800">{r.text}</span>
                        <button onClick={() => { setEditingId(r.id); setEditingText(r.text); setEditingTag(r.tag); }} className="text-neutral-400 hover:text-neutral-600"><Edit2 size={18}/></button>
                        <button onClick={() => handleDelete(r.id, 'quick_responses')} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                    </>
                )}
            </div>
        ))}
      </div>
    </div>
  );
}

