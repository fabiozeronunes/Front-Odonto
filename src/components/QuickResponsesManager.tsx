import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy } from '../lib/supabaseAdapter';
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
    if (!newResponse.trim() || !auth.currentUser) {
        alert("Erro: Usuário não autenticado ou campo vazio.");
        return;
    }
    setIsSaving(true);
    try {
        await addDoc(collection(db, 'quick_responses'), { 
            text: newResponse.trim(), 
            tag: newTag, 
            ownerId: auth.currentUser.uid, 
            createdAt: serverTimestamp() 
        });
        setNewResponse('');
        setNewTag(categories[0]);
    } catch (e) {
        console.error("Error adding doc: ", e);
        alert("Erro ao salvar mensagem: " + (e instanceof Error ? e.message : String(e)));
    }
    setIsSaving(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !auth.currentUser) {
        console.error("Missing inputs or user", { category: newCategory, user: auth.currentUser });
        return;
    }
    try {
        await addDoc(collection(db, 'response_categories'), { name: newCategory.trim(), ownerId: auth.currentUser.uid });
        setNewCategory('');
        setIsAddingCategory(false);
    } catch (e) {
        console.error("Error adding category: ", e);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editingText.trim()) return;
    try {
        await updateDoc(doc(db, 'quick_responses', id), { text: editingText.trim(), tag: editingTag });
        setEditingId(null);
    } catch (e) {
        console.error("Error updating doc: ", e);
    }
  };

  const handleDelete = async (id: string, collectionName: string) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const filteredResponses = filterTag === 'Todas' ? responses : responses.filter(r => r.tag === filterTag);

  return (
    <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-neutral-100 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-6 border-b border-neutral-100">
        <h3 className="text-xl font-bold text-neutral-900">Gerenciar Respostas Rápidas</h3>
        
        <div className="flex gap-2 items-center w-full sm:w-auto">
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="flex-1 sm:flex-initial p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:bg-white focus:border-neutral-900">
                <option>Todas</option>
                {categories.map(cat => <option key={cat}>{cat}</option>)}
            </select>
            <button onClick={() => setIsAddingCategory(true)} className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-colors cursor-pointer shrink-0" title="Nova Categoria"><Tag size={20}/></button>
        </div>
      </div>
      
      {isAddingCategory && (
          <div className="flex flex-col sm:flex-row gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria..." className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:border-neutral-900"/>
              <div className="flex gap-2 justify-end">
                <button onClick={handleAddCategory} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">Salvar</button>
                <button onClick={() => setIsAddingCategory(false)} className="text-neutral-500 hover:text-neutral-700 px-4 py-2 text-xs font-bold cursor-pointer">Cancelar</button>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input 
          value={newResponse} 
          onChange={(e) => setNewResponse(e.target.value)} 
          placeholder="Nova resposta..." 
          className="w-full sm:flex-1 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-800 focus:bg-white focus:border-neutral-900 outline-none transition-all" 
        />
        <div className="flex gap-3 w-full sm:w-auto shrink-0">
          <select 
            value={newTag} 
            onChange={(e) => setNewTag(e.target.value)} 
            className="flex-1 sm:w-48 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-800 outline-none focus:bg-white focus:border-neutral-900"
          >
            {categories.map(cat => <option key={cat}>{cat}</option>)}
          </select>
          <button 
            onClick={handleAdd} 
            disabled={isSaving} 
            className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs transition-all cursor-pointer shadow-md shadow-emerald-500/10 shrink-0"
          >
            {isSaving ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredResponses.map(r => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                {editingId === r.id ? (
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <input 
                          value={editingText} 
                          onChange={(e) => setEditingText(e.target.value)} 
                          className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl w-full text-sm font-semibold focus:border-neutral-900 outline-none"
                        />
                        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                          <select 
                            value={editingTag} 
                            onChange={(e) => setEditingTag(e.target.value)} 
                            className="flex-1 sm:w-40 p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 outline-none"
                          >
                            {categories.map(cat => <option key={cat}>{cat}</option>)}
                          </select>
                          <button onClick={() => handleEdit(r.id)} disabled={isSaving} className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer"><Save size={18}/></button>
                          <button onClick={() => setEditingId(null)} className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all cursor-pointer"><X size={18}/></button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 justify-between sm:justify-start w-full sm:w-auto shrink-0">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shrink-0">{r.tag}</span>
                          <div className="flex items-center gap-3 sm:hidden">
                            <button onClick={() => { setEditingId(r.id); setEditingText(r.text); setEditingTag(r.tag); }} className="text-neutral-400 hover:text-neutral-600 p-1"><Edit2 size={18}/></button>
                            <button onClick={() => handleDelete(r.id, 'quick_responses')} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18}/></button>
                          </div>
                        </div>
                        <span className="flex-1 text-sm font-medium text-neutral-800 break-words leading-relaxed">{r.text}</span>
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          <button onClick={() => { setEditingId(r.id); setEditingText(r.text); setEditingTag(r.tag); }} className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"><Edit2 size={18}/></button>
                          <button onClick={() => handleDelete(r.id, 'quick_responses')} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={18}/></button>
                        </div>
                    </>
                )}
            </div>
        ))}
      </div>
    </div>
  );
}

