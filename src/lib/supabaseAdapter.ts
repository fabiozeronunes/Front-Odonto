import { getSupabase } from './supabase';

// Helper: Mapeador de tabelas de Firestore para Supabase Postgres
export function getSupabaseTable(firestoreCollection: string): string {
  if (!firestoreCollection) return '';
  const collectionName = firestoreCollection.split('/')[0];
  if (collectionName === 'agendamentos') return 'appointments';
  if (collectionName === 'pacientes') return 'pacientes';
  return collectionName;
}

// Helper: Converte campos camelCase para snake_case do Postgres
export function camelToSnakeField(field: string): string {
  if (field === 'ownerId') return 'owner_id';
  if (field === 'createdAt') return 'created_at';
  if (field === 'updatedAt') return 'updated_at';
  if (field === 'clinicId') return 'clinic_id';
  if (field === 'dentistId') return 'dentist_id';
  if (field === 'startTime') return 'start_time';
  if (field === 'endTime') return 'end_time';
  if (field === 'patientId') return 'patient_id';
  if (field === 'patientDisplayId') return 'patient_display_id';
  if (field === 'lastContactAt') return 'last_contact_at';
  if (field === 'googleEventId') return 'google_event_id';
  if (field === 'isGoogle') return 'is_google';
  if (field === 'htmlLink') return 'html_link';
  if (field === 'calendarName') return 'calendar_name';
  if (field === 'unreadCount') return 'unread_count';
  if (field === 'lastMessage') return 'last_message';
  if (field === 'lastMessageTime') return 'last_message_time';
  if (field === 'senderId') return 'sender_id';
  if (field === 'senderName') return 'sender_name';
  return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper: Converte recursivamente um objeto camelCase para snake_case
export function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }
  if (typeof obj === 'object') {
    // Se for data ou timestamp do firestore
    if (obj instanceof Date) return obj.toISOString();
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = camelToSnakeField(key);
      result[snakeKey] = camelToSnake(obj[key]);
    }
    return result;
  }
  return obj;
}

// Helper: Converte recursivamente um objeto snake_case para camelCase
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      // Evitar converter chaves de objetos internos ou JSON de arquivos diretamente
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = snakeToCamel(obj[key]);
    }
    return result;
  }
  return obj;
}

// Adaptação específica para compatibilidade de dados entre Firestore e as restrições e colunas do Supabase Postgres
export function adaptInputData(table: string, data: any): any {
  if (table === 'quick_responses') {
    const adapted = { ...data };
    if (adapted.tag !== undefined && adapted.category === undefined) {
      adapted.category = adapted.tag;
    }
    if (adapted.title === undefined) {
      adapted.title = adapted.text ? (adapted.text.length > 50 ? adapted.text.substring(0, 50) + "..." : adapted.text) : "Sem Título";
    }
    return adapted;
  }
  
  if (table === 'users') {
    const adapted = { ...data };
    
    // Mapear campos comuns de Auth que podem estar no payload
    if (adapted.displayName && !adapted.nome) adapted.nome = adapted.displayName;
    if (adapted.photoURL && !adapted.avatarUrl) adapted.avatarUrl = adapted.photoURL;

    // Lista de colunas válidas no banco de dados (em camelCase para bater com o input antes do camelToSnake)
    const validCamelFields = [
      'id', 'nome', 'email', 'cpf', 'whatsapp', 'dataNascimento', 
      'endereco', 'bairro', 'cidade', 'estado', 'dataCadastro', 'crm', 'especialidade', 
      'telefone', 'clinicName', 'logoUrl', 'avatarUrl', 'ownerId', 
      'createdAt', 'updatedAt'
    ];

    // Filtrar apenas campos válidos
    const filtered: any = {};
    for (const key of Object.keys(adapted)) {
      if (validCamelFields.includes(key)) {
        filtered[key] = adapted[key];
      }
    }
    
    return filtered;
  }
  return data;
}

export function adaptOutputData(table: string, data: any): any {
  if (table === 'quick_responses' && data) {
    const adapted = { ...data };
    if (adapted.category !== undefined && adapted.tag === undefined) {
      adapted.tag = adapted.category;
    }
    return adapted;
  }
  
  return data;
}

// Virtual storage for system collection
export const virtualSystemStore: Record<string, any> = {};

// LocalStorage Persistence Fallback for when Supabase keys are missing
function getMockStorage(table: string): any[] {
  if (typeof window === 'undefined') return [];
  const key = `sb_mock_${table}`;
  const saved = localStorage.getItem(key);
  if (!saved || saved === 'undefined' || saved === 'null') return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`[Supabase Mock] Error parsing table ${table}, resetting:`, e);
    localStorage.removeItem(key);
    return [];
  }
}

function saveMockStorage(table: string, data: any[]) {
  if (typeof window === 'undefined') return;
  const key = `sb_mock_${table}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`[Supabase Mock] Error saving table ${table}:`, e);
  }
}

// --- TIPOS DE REFERÊNCIAS ---
export interface CollectionReference {
  type: 'collection';
  path: string;
}

export interface DocumentReference {
  type: 'doc';
  path: string;
  id: string;
}

export interface QueryReference {
  type: 'query';
  collection: CollectionReference;
  filters: any[];
}

export function collection(db: any, path: string): CollectionReference {
  return { type: 'collection', path };
}

export function doc(dbOrCollection: any, path?: string, ...morePaths: string[]): DocumentReference {
  if (dbOrCollection && dbOrCollection.type === 'collection') {
    return { type: 'doc', path: dbOrCollection.path, id: path || '' };
  }
  // Se for chamado como doc(db, 'collection', 'id')
  return { type: 'doc', path: path || '', id: morePaths[0] || '' };
}

export function query(collectionRef: CollectionReference, ...filters: any[]): QueryReference {
  return {
    type: 'query',
    collection: collectionRef,
    filters
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

// Função de placeholder para manter assinatura compatível
export function serverTimestamp() {
  return new Date().toISOString();
}

// --- CENTRAL DE ESCUTA EM TEMPO REAL ---
interface ActiveListener {
  id: string;
  table: string;
  queryRef: any;
  onNext: (snapshot: any) => void;
  onError?: (error: any) => void;
}

const activeListeners: ActiveListener[] = [];

export function triggerListenersForTable(firestoreCollection: string) {
  const table = getSupabaseTable(firestoreCollection);
  for (const listener of activeListeners) {
    if (getSupabaseTable(listener.table) === table) {
      fetchAndTrigger(listener);
    }
  }
}

async function fetchAndTrigger(listener: ActiveListener) {
  try {
    const isDoc = listener.queryRef && listener.queryRef.type === 'doc';
    if (isDoc) {
      const docSnapshot = await getDoc(listener.queryRef);
      listener.onNext(docSnapshot);
    } else {
      const data = await executeSupabaseQuery(listener.queryRef);
      const docs = data.map(item => ({
        id: item.id,
        exists: () => true,
        data: () => item
      }));
      const snapshot = {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: any) => docs.forEach(callback)
      };
      listener.onNext(snapshot);
    }
  } catch (err) {
    if (listener.onError) {
      listener.onError(err);
    } else {
      console.error(`Erro ao atualizar escuta em ${listener.table}:`, err);
    }
  }
}

// --- COMANDOS CRUD ---
export async function executeSupabaseQuery(queryRef: any): Promise<any[]> {
  const isQuery = queryRef.type === 'query';
  const firestoreCollection = isQuery ? queryRef.collection.path : queryRef.path;
  if (firestoreCollection === 'system') {
    const id = isQuery ? '' : queryRef.id;
    return [virtualSystemStore[id] || { id, timestamp: new Date().toISOString() }];
  }

  const supabase = getSupabase() as any;
  if (!supabase) {
    const table = getSupabaseTable(firestoreCollection);
    const store = getMockStorage(table);
    // Simulação básica de filtros (apenas == por enquanto para o mock)
    let filtered = [...store];
    const filters = isQuery ? queryRef.filters : [];
    for (const filter of filters) {
      if (filter && filter.type === 'where' && filter.op === '==') {
        filtered = filtered.filter(item => item[filter.field] === filter.value);
      }
    }
    return filtered;
  }

  const table = getSupabaseTable(firestoreCollection);

  let q = supabase.from(table).select('*');

  const filters = isQuery ? queryRef.filters : [];

  for (const filter of filters) {
    if (!filter) continue;
    if (filter.type === 'where') {
      let filterField = filter.field;
      // Compatibilidade de filtro tag -> category para quick_responses
      if (table === 'quick_responses' && filterField === 'tag') {
        filterField = 'category';
      }
      const field = camelToSnakeField(filterField);
      const val = filter.value;
      switch (filter.op) {
        case '==':
          q = q.eq(field, val);
          break;
        case '!=':
          q = q.neq(field, val);
          break;
        case '<':
          q = q.lt(field, val);
          break;
        case '<=':
          q = q.lte(field, val);
          break;
        case '>':
          q = q.gt(field, val);
          break;
        case '>=':
          q = q.gte(field, val);
          break;
        case 'array-contains':
          // Se for filtro para PostgreSQL arrays, usamos contains
          q = q.contains(field, [val]);
          break;
        case 'in':
          q = q.in(field, Array.isArray(val) ? val : [val]);
          break;
        default:
          console.warn(`Operador de query não compatível: ${filter.op}`);
      }
    } else if (filter.type === 'orderBy') {
      let filterField = filter.field;
      if (table === 'quick_responses' && filterField === 'tag') {
        filterField = 'category';
      }
      const field = camelToSnakeField(filterField);
      q = q.order(field, { ascending: filter.direction !== 'desc' });
    } else if (filter.type === 'limit') {
      q = q.limit(filter.value);
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error(`Erro ao executar pesquisa na tabela ${table}:`, error);
    throw error;
  }

  return (data || []).map(item => {
    const camel = snakeToCamel(item);
    return adaptOutputData(table, camel);
  });
}

// 1. ADD DOC
export async function addDoc(collectionRef: any, data: any) {
  if (collectionRef.path === 'system') {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    virtualSystemStore[id] = data;
    triggerListenersForTable(collectionRef.path);
    return {
      id,
      path: `${collectionRef.path}/${id}`
    };
  }

  const supabase = getSupabase() as any;
  const table = getSupabaseTable(collectionRef.path);
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);

  if (!supabase) {
    console.warn(`[SupabaseAdapter] Supabase não configurado. Usando Mock para tabela ${table}.`);
    const store = getMockStorage(table);
    const newDoc = { id, ...data, createdAt: new Date().toISOString() };
    store.push(newDoc);
    saveMockStorage(table, store);
    triggerListenersForTable(collectionRef.path);
    return { id, path: `${collectionRef.path}/${id}` };
  }

  const adaptedData = adaptInputData(table, data);
  const pgData = camelToSnake({ id, ...adaptedData });

  if (!pgData.created_at) {
    pgData.created_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from(table)
    .insert([pgData]);

  if (error) {
    console.error(`Erro ao inserir na tabela ${table}:`, error);
    throw error;
  }

  // Notificar ouvintes locais ativos
  triggerListenersForTable(collectionRef.path);

  return {
    id,
    path: `${collectionRef.path}/${id}`
  };
}

// 2. SET DOC
export async function setDoc(docRef: any, data: any, options?: any) {
  if (docRef.path === 'system') {
    virtualSystemStore[docRef.id] = data;
    triggerListenersForTable(docRef.path);
    return;
  }

  const supabase = getSupabase() as any;
  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  if (!supabase) {
    console.warn(`[SupabaseAdapter] Supabase não configurado. Usando Mock para tabela ${table}.`);
    const store = getMockStorage(table);
    const existingIdx = store.findIndex(item => item.id === id);
    if (existingIdx !== -1) {
      if (options?.merge) {
        store[existingIdx] = { ...store[existingIdx], ...data, updatedAt: new Date().toISOString() };
      } else {
        store[existingIdx] = { id, ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      store.push({ id, ...data, createdAt: new Date().toISOString() });
    }
    saveMockStorage(table, store);
    triggerListenersForTable(docRef.path);
    return;
  }

  const adaptedData = adaptInputData(table, data);
  const pgData = camelToSnake({ id, ...adaptedData });

  console.log(`[SupabaseAdapter] Executando setDoc na tabela ${table} para ID ${id}. Dados:`, pgData);

  const { error } = await supabase
    .from(table)
    .upsert(pgData, { onConflict: table === 'users' ? 'email' : 'id' });

  if (error) {
    console.error(`[SupabaseAdapter] Erro ao upsert na tabela ${table}:`, error);
    throw error;
  }
  
  console.log(`[SupabaseAdapter] setDoc concluído com sucesso para ${table}/${id}`);

  triggerListenersForTable(docRef.path);
}

// 3. UPDATE DOC
export async function updateDoc(docRef: any, data: any) {
  if (docRef.path === 'system') {
    virtualSystemStore[docRef.id] = { ...virtualSystemStore[docRef.id], ...data };
    triggerListenersForTable(docRef.path);
    return;
  }

  const supabase = getSupabase() as any;
  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  if (!supabase) {
    const store = getMockStorage(table);
    const idx = store.findIndex(item => item.id === id);
    if (idx !== -1) {
      store[idx] = { ...store[idx], ...data, updatedAt: new Date().toISOString() };
      saveMockStorage(table, store);
    }
    triggerListenersForTable(docRef.path);
    return;
  }

  const adaptedData = adaptInputData(table, data);
  const pgData = camelToSnake(adaptedData);
  // Evita alterar o ID primário
  delete pgData.id;

  const { error } = await supabase
    .from(table)
    .update(pgData)
    .eq('id', id);

  if (error) {
    console.error(`Erro ao atualizar registro na tabela ${table}:`, error);
    throw error;
  }

  triggerListenersForTable(docRef.path);
}

// 4. DELETE DOC
export async function deleteDoc(docRef: any) {
  if (docRef.path === 'system') {
    delete virtualSystemStore[docRef.id];
    triggerListenersForTable(docRef.path);
    return;
  }

  const supabase = getSupabase() as any;
  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  if (!supabase) {
    const store = getMockStorage(table);
    const filtered = store.filter(item => item.id !== id);
    saveMockStorage(table, filtered);
    triggerListenersForTable(docRef.path);
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Erro ao deletar registro na tabela ${table}:`, error);
    throw error;
  }

  triggerListenersForTable(docRef.path);
}

// 5. GET DOC
export async function getDoc(docRef: any) {
  if (docRef.path === 'system') {
    const id = docRef.id;
    const data = virtualSystemStore[id] || { timestamp: new Date().toISOString() };
    return {
      id,
      exists: () => true,
      data: () => data
    };
  }

  const supabase = getSupabase() as any;
  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  if (!supabase) {
    const store = getMockStorage(table);
    const data = store.find(item => item.id === id);
    return {
      id,
      exists: () => !!data,
      data: () => data
    };
  }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (table === 'users') {
      const { data: emailData, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', docRef.id || '')
        .maybeSingle();
      
      if (!emailError && emailData) {
        console.log(`[SupabaseAdapter] Registro encontrado via email em users: ${id}`, emailData);
        let cleanData = snakeToCamel(emailData);
        cleanData = adaptOutputData(table, cleanData);
        return {
          id: emailData.id,
          exists: () => true,
          data: () => cleanData
        };
      }
    }
  }

  if (error) {
    console.error(`[SupabaseAdapter] Erro ao buscar registro na tabela ${table} com ID ${id}:`, error);
    throw error;
  }

  if (data) {
    console.log(`[SupabaseAdapter] Registro encontrado em ${table}/${id}`, data);
  } else {
    console.log(`[SupabaseAdapter] Registro NÃO encontrado em ${table}/${id}`);
  }

  let cleanData = data ? snakeToCamel(data) : null;
  cleanData = adaptOutputData(table, cleanData);

  return {
    id,
    exists: () => !!data,
    data: () => cleanData
  };
}

// 6. GET DOCS
export async function getDocs(queryRef: any) {
  const data = await executeSupabaseQuery(queryRef);
  const docs = data.map(item => ({
    id: item.id,
    exists: () => true,
    data: () => item
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: any) => docs.forEach(callback)
  };
}

// 7. ONSNAPSHOT (EM TEMPO REAL)
export function onSnapshot(
  queryRef: any, 
  onNext: (snapshot: any) => void, 
  onError?: (error: any) => void
) {
  const isQuery = queryRef.type === 'query';
  const isDoc = queryRef.type === 'doc';
  const firestoreCollection = isQuery ? queryRef.collection.path : queryRef.path;
  const table = getSupabaseTable(firestoreCollection);

  const listenerId = Math.random().toString(36).substring(2, 11);
  const listener: ActiveListener = {
    id: listenerId,
    table: firestoreCollection,
    queryRef,
    onNext,
    onError
  };

  // Cadastra no array de escutas ativas para atualização instantânea em escritas locais
  activeListeners.push(listener);

  // Executa uma vez de forma imediata
  fetchAndTrigger(listener);

  // Inscreve no canal realtime do Supabase para alterações externas no banco de dados
  const supabase = getSupabase() as any;
  let channel: any = null;

  if (supabase && firestoreCollection !== 'system') {
    channel = supabase
      .channel(`rt:${table}:${listenerId}`)
      .on(
        'postgres_changes',
        { event: '*', scheme: 'public', table },
        () => {
          // Quando ocorrer alteração remota, atualiza a query e notifica a tela
          fetchAndTrigger(listener);
        }
      )
      .subscribe();
  }

  // Retorna função desinscrever
  return () => {
    const idx = activeListeners.findIndex(l => l.id === listenerId);
    if (idx !== -1) {
      activeListeners.splice(idx, 1);
    }
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
  };
}

// --- BATCH WRITES ---
class SupabaseBatch {
  private operations: Array<() => Promise<void>> = [];
  private impactedTables: Set<string> = new Set();

  set(docRef: DocumentReference, data: any, options?: any) {
    this.operations.push(async () => {
      await setDoc(docRef, data, options);
    });
    this.impactedTables.add(docRef.path);
  }

  update(docRef: DocumentReference, data: any) {
    this.operations.push(async () => {
      await updateDoc(docRef, data);
    });
    this.impactedTables.add(docRef.path);
  }

  delete(docRef: DocumentReference) {
    this.operations.push(async () => {
      await deleteDoc(docRef);
    });
    this.impactedTables.add(docRef.path);
  }

  async commit() {
    for (const op of this.operations) {
      await op();
    }
    for (const table of Array.from(this.impactedTables)) {
      triggerListenersForTable(table);
    }
  }
}

export function writeBatch(db: any) {
  return new SupabaseBatch();
}

// --- FIREBASE AUTH COMPATIBILITY LAYER ---

export const db = { type: 'supabase_mock_firestore_db' };

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  getIdToken?: () => Promise<string>;
  getIdTokenResult?: () => Promise<any>;
  reload?: () => Promise<void>;
  providerId?: string;
  toJSON?: () => any;
  tenantId?: string | null;
  providerData?: any[];
}

// Global subscribers for onAuthStateChanged
const authStateListeners: Array<(user: User | null) => void> = [];

// Helper to get or create demo/logged-in user from localStorage
function getSavedUser(): User | null {
  const saved = localStorage.getItem('supabase_mock_user');
  if (saved && saved !== 'undefined' && saved !== 'null') {
    try {
      return JSON.parse(saved);
    } catch {
      console.warn("Falha ao parsear usuário salvo, limpando...");
      localStorage.removeItem('supabase_mock_user');
      return null;
    }
  }
  // Try to check if google demo session is active
  const isDemo = localStorage.getItem('google_demo_logged_in_v1') === 'true';
  if (isDemo) {
    const defaultUser: User = {
      uid: 'demo-user-id-supabase',
      email: 'clinica.demo@gmail.com',
      displayName: 'Clínica Demo',
      photoURL: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=120',
      phoneNumber: null,
      emailVerified: true,
      isAnonymous: false,
    };
    localStorage.setItem('supabase_mock_user', JSON.stringify(defaultUser));
    return defaultUser;
  }
  return null;
}

let currentUserInMock: User | null = getSavedUser();

export const auth = {
  get currentUser() {
    return currentUserInMock;
  },
  onAuthStateChanged(callback: (user: User | null) => void) {
    authStateListeners.push(callback);
    // Call immediately with current state
    callback(currentUserInMock);
    return () => {
      const idx = authStateListeners.indexOf(callback);
      if (idx !== -1) authStateListeners.splice(idx, 1);
    };
  },
  async signOut() {
    currentUserInMock = null;
    localStorage.removeItem('supabase_mock_user');
    localStorage.removeItem('google_demo_logged_in_v1');
    localStorage.removeItem('google_access_token');
    authStateListeners.forEach(listener => listener(null));
  }
};

// Dispatch auth state change
function setAuthenticatedUser(user: User | null) {
  currentUserInMock = user;
  if (user) {
    localStorage.setItem('supabase_mock_user', JSON.stringify(user));
    localStorage.setItem('google_demo_logged_in_v1', 'true');
    localStorage.setItem('google_access_token', 'demo-token');
  } else {
    localStorage.removeItem('supabase_mock_user');
    localStorage.removeItem('google_demo_logged_in_v1');
    localStorage.removeItem('google_access_token');
  }
  authStateListeners.forEach(listener => listener(user));
}

// Google Auth Provider mock class
export class GoogleAuthProvider {
  static credentialFromResult(result: any) {
    return { accessToken: result?.accessToken || 'demo-token' };
  }
}

export async function getRedirectResult(authObj?: any) {
  return null;
}

// Google Sign-In helper
export const signInWithGoogle = async (allowRedirect = true) => {
  const user: User = {
    uid: 'demo-user-id-supabase',
    email: 'clinica.demo@gmail.com',
    displayName: 'Clínica Demo',
    photoURL: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=120',
    phoneNumber: null,
    emailVerified: true,
    isAnonymous: false,
  };
  setAuthenticatedUser(user);
  return {
    user,
    accessToken: 'demo-token'
  };
};

// Email-Password Credentials Sign-In
export async function signInWithEmailAndPassword(authObj: any, email: string, pass: string) {
  const user: User = {
    uid: 'user_' + Math.abs(email.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(16),
    email: email,
    displayName: email.split('@')[0],
    photoURL: null,
    phoneNumber: null,
    emailVerified: true,
    isAnonymous: false,
  };
  setAuthenticatedUser(user);
  return { user };
}

// Email-Password Signup
export async function createUserWithEmailAndPassword(authObj: any, email: string, pass: string) {
  const user: User = {
    uid: 'user_' + Math.abs(email.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(16),
    email: email,
    displayName: email.split('@')[0],
    photoURL: null,
    phoneNumber: null,
    emailVerified: true,
    isAnonymous: false,
  };
  setAuthenticatedUser(user);
  return { user };
}

// Anonymous logic
export async function signInAnonymously(authObj: any) {
  const user: User = {
    uid: 'anonymous_' + Math.random().toString(36).substring(2, 11),
    email: null,
    displayName: 'Usuário Anônimo',
    photoURL: null,
    phoneNumber: null,
    emailVerified: false,
    isAnonymous: true,
  };
  setAuthenticatedUser(user);
  return { user };
}

// Password reset mock
export async function sendPasswordResetEmail(authObj: any, email: string) {
  console.log(`Password reset email sent to: ${email}`);
  return true;
}

// Update profile mock
export async function updateProfile(userObj: any, data: { displayName?: string, photoURL?: string }) {
  if (currentUserInMock) {
    if (data.displayName) currentUserInMock.displayName = data.displayName;
    if (data.photoURL) currentUserInMock.photoURL = data.photoURL;
    setAuthenticatedUser(currentUserInMock);
  }
  return true;
}
