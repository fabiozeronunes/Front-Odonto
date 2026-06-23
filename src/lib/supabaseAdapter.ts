import { getSupabase } from './supabase';

// Helper: Mapeador de tabelas de Firestore para Supabase Postgres
export function getSupabaseTable(firestoreCollection: string): string {
  if (!firestoreCollection) return '';
  const collectionName = firestoreCollection.split('/')[0];
  if (collectionName === 'agendamentos') return 'appointments';
  if (collectionName === 'pacientes') return 'pacientes';
  if (collectionName === 'ai_connections') return 'ai_connections';
  if (collectionName === 'app_settings') return 'app_settings';
  if (collectionName === 'clinics') return 'clinics';
  if (collectionName === 'dentists') return 'dentists';
  if (collectionName === 'procedures') return 'procedures';
  if (collectionName === 'specialties') return 'specialties';
  if (collectionName === 'quick_responses') return 'quick_responses';
  if (collectionName === 'response_categories') return 'response_categories';
  if (collectionName === 'whatsapp_chats') return 'whatsapp_chats';
  if (collectionName === 'whatsapp_messages') return 'whatsapp_messages';
  if (collectionName === 'users') return 'users';
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
  if (field === 'apiKey') return 'api_key';
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

// LocalStorage Persistence for Production Data Cache
function getSupabaseCache(table: string): any[] {
  if (typeof window === 'undefined') return [];
  const key = `sb_prod_cache_${table}`;
  const saved = localStorage.getItem(key);
  if (!saved || saved === 'undefined' || saved === 'null') return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function setSupabaseCache(table: string, data: any[]) {
  if (typeof window === 'undefined') return;
  const key = `sb_prod_cache_${table}`;
  try {
    // Limitamos o cache aos últimos 500 registros para evitar estourar o localStorage
    localStorage.setItem(key, JSON.stringify(data.slice(0, 500)));
  } catch (e) {
    console.warn(`[Supabase Cache] Error saving cache for ${table}:`, e);
  }
}

// Helper: Aplica filtros básicos localmente em arrays (usado por Mock e Cache)
function applyLocalFilters(data: any[], queryRef: any): any[] {
  if (!queryRef || queryRef.type !== 'query' || !queryRef.filters) return data;
  
  let filtered = [...data];
  const filters = queryRef.filters;

  for (const filter of filters) {
    if (!filter) continue;
    if (filter.type === 'where') {
      const field = filter.field;
      const val = filter.value;
      const op = filter.op;
      
      switch (op) {
        case '==': filtered = filtered.filter(item => item[field] === val); break;
        case '!=': filtered = filtered.filter(item => item[field] !== val); break;
        case '>':  filtered = filtered.filter(item => item[field] > val); break;
        case '>=': filtered = filtered.filter(item => item[field] >= val); break;
        case '<':  filtered = filtered.filter(item => item[field] < val); break;
        case '<+': filtered = filtered.filter(item => item[field] <= val); break;
        case 'array-contains': 
          filtered = filtered.filter(item => Array.isArray(item[field]) && item[field].includes(val)); 
          break;
        case 'in':
          filtered = filtered.filter(item => Array.isArray(val) && val.includes(item[field]));
          break;
      }
    } else if (filter.type === 'orderBy') {
      const field = filter.field;
      const desc = filter.direction === 'desc';
      filtered.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    } else if (filter.type === 'limit') {
      filtered = filtered.slice(0, filter.value);
    }
  }
  return filtered;
}

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

function saveDocToCache(table: string, doc: any) {
  if (typeof window === 'undefined') return;
  
  // 1. Atualiza cache de produção
  const current = getSupabaseCache(table);
  const idx = current.findIndex(item => item.id === doc.id);
  const docWithSyncFlag = { ...doc, _synced: doc._synced !== undefined ? doc._synced : false };
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...docWithSyncFlag };
  } else {
    current.push(docWithSyncFlag);
  }
  setSupabaseCache(table, current);

  // 2. Atualiza armazenamento local mock
  const store = getMockStorage(table);
  const storeIdx = store.findIndex(item => item.id === doc.id);
  if (storeIdx !== -1) {
    store[storeIdx] = { ...store[storeIdx], ...doc };
  } else {
    store.push(doc);
  }
  saveMockStorage(table, store);
}

function removeDocFromCache(table: string, id: string) {
  if (typeof window === 'undefined') return;
  
  // 1. Remove do cache de produção
  const current = getSupabaseCache(table);
  const updated = current.filter(item => item.id !== id);
  setSupabaseCache(table, updated);

  // 2. Remove do armazenamento local mock
  const store = getMockStorage(table);
  const storeFiltered = store.filter(item => item.id !== id);
  saveMockStorage(table, storeFiltered);
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

/**
 * Valida explicitamente a conexão com o Supabase e o estado da sessão.
 * Útil para diagnosticar falhas de sincronização em ambientes de produção.
 */
export async function validateSupabaseConnection() {
  const metaEnv = (import.meta as any).env || {};
  const url = metaEnv.VITE_SUPABASE_URL;
  const key = metaEnv.VITE_SUPABASE_ANON_KEY;

  console.group('[Supabase Diagnostic]');
  console.log('Environment:', {
    hasUrl: !!url,
    hasKey: !!key,
    isLocalhost: window.location.hostname === 'localhost',
    origin: window.location.origin
  });

  const supabase = getSupabase();
  if (!supabase) {
    console.error('CRITICAL: Supabase client failed to initialize. Check your VITE_ vars.');
    console.groupEnd();
    return { status: 'error', message: 'Client not initialized' };
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth Session Error:', error.message);
      console.groupEnd();
      return { status: 'error', message: error.message };
    }

    if (session) {
      console.log('Session Active:', {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
      });
      console.groupEnd();
      return { status: 'ok', userId: session.user.id };
    } else {
      console.warn('No active Supabase session. Data fetching will use fallback/mock mode if RLS is strict.');
      console.groupEnd();
      return { status: 'unauthenticated' };
    }
  } catch (err: any) {
    console.error('Unexpected Diagnostic Error:', err);
    console.groupEnd();
    return { status: 'error', message: err.message };
  }
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
    const firestoreCollection = isDoc ? listener.queryRef.path : (listener.queryRef.type === 'query' ? listener.queryRef.collection.path : listener.table);
    const table = getSupabaseTable(firestoreCollection);

    // --- CAMADA DE CACHE IMEDIATA ---
    // Se não for um documento específico, tentamos entregar o cache primeiro para latência zero
    if (!isDoc && firestoreCollection !== 'system') {
      const cachedData = getSupabaseCache(table);
      if (cachedData.length > 0) {
        const filteredCache = applyLocalFilters(cachedData, listener.queryRef);
        if (filteredCache.length > 0) {
          console.log(`[SupabaseAdapter] [Cache] Entrega otimista: ${table} (${filteredCache.length} itens)`);
          const cachedDocs = filteredCache.map(item => ({
            id: item.id,
            exists: () => true,
            data: () => item
          }));
          listener.onNext({
            docs: cachedDocs,
            empty: cachedDocs.length === 0,
            size: cachedDocs.length,
            forEach: (callback: any) => cachedDocs.forEach(callback)
          });
        }
      }
    }

    if (isDoc) {
      const docSnapshot = await getDoc(listener.queryRef);
      listener.onNext(docSnapshot);
    } else {
      const data = await executeSupabaseQuery(listener.queryRef);
      
      if (firestoreCollection !== 'system') {
        const currentCache = getSupabaseCache(table);
        const serverIds = new Set(data.map(item => item.id));
        
        // 1. Identifica itens que combinam com os filtros da query atual no cache local
        const matchingCachedItems = applyLocalFilters(currentCache, listener.queryRef);
        const matchingCachedIds = new Set(matchingCachedItems.map(item => item.id));
        
        // 2. Constrói a nova lista consolidada do cache
        const updatedCacheList: any[] = [];
        
        // Mantém intocados todos os itens que NÃO pertencem a esta query específica
        currentCache.forEach(item => {
          if (!matchingCachedIds.has(item.id)) {
            updatedCacheList.push(item);
          }
        });
        
        // Para os itens desta query, mescla inteligentemente os dados remotos e locais
        matchingCachedItems.forEach(item => {
          if (serverIds.has(item.id)) {
            // Existe no servidor: atualiza com os dados do servidor e marca como sincronizado
            const serverItem = data.find(s => s.id === item.id);
            updatedCacheList.push({ ...item, ...serverItem, _synced: true });
          } else if (item._synced === false) {
            // Criado/editado localmente mas ainda não persistido na nuvem: mantém visível
            updatedCacheList.push(item);
          }
          // Caso contrário, se estava marcado como sincronizado anteriormente mas sumiu do servidor,
          // consideramos que foi deletado remotamente e não o reinserimos no cache.
        });
        
        // Adiciona itens novos que estão no servidor mas por algum motivo não estavam no cache
        const cacheIds = new Set(updatedCacheList.map(item => item.id));
        data.forEach(item => {
          if (!cacheIds.has(item.id)) {
            updatedCacheList.push({ ...item, _synced: true });
          }
        });
        
        setSupabaseCache(table, updatedCacheList);
        
        // Sincroniza também o storage do mock local para consistência perfeita
        saveMockStorage(table, updatedCacheList);
      }

      // Agora entregamos os dados resultantes do cache consolidado e devidamente filtrados.
      // Isso garante que registros criados/editados localmente persistam na tela sob qualquer estado assíncrono!
      const finalItems = firestoreCollection !== 'system'
        ? applyLocalFilters(getSupabaseCache(table), listener.queryRef)
        : data;

      const docs = finalItems.map(item => ({
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
    console.log(`[SupabaseAdapter] [Query] No Supabase instance. Using LOCAL MOCK for table: ${firestoreCollection}`);
    const table = getSupabaseTable(firestoreCollection);
    const store = getMockStorage(table);
    return applyLocalFilters(store, queryRef);
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
    console.error(`[SupabaseAdapter] [Query] Error executing search on table ${table}:`, error);
    throw error;
  }

  console.log(`[SupabaseAdapter] [Query] Results for ${table}:`, data?.length || 0, "rows found.");

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

  // Salva no cache local e de mock imediatamente antes de enviar para o servidor
  saveDocToCache(table, { id, ...data, createdAt: pgData.created_at, _synced: false });

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

  // Salva no cache local e de mock imediatamente antes de enviar para o servidor
  const existingCache = getSupabaseCache(table).find(item => item.id === id);
  const mergedData = options?.merge && existingCache ? { ...existingCache, ...data } : { id, ...data };
  saveDocToCache(table, { ...mergedData, _synced: false });

  console.log(`[SupabaseAdapter] Executando setDoc na tabela ${table} para ID ${id}. Dados:`, pgData);

  const { error } = await supabase
    .from(table)
    .upsert(pgData, { onConflict: 'id' });

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

  // Salva no cache local e de mock imediatamente antes de enviar para o servidor
  const existingCache = getSupabaseCache(table).find(item => item.id === id);
  const mergedData = existingCache ? { ...existingCache, ...data } : { id, ...data };
  saveDocToCache(table, { ...mergedData, _synced: false });

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

  // Deleta do cache local e de mock imediatamente antes de enviar para o servidor
  removeDocFromCache(table, id);

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
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.error(`[SupabaseAdapter] CRITICAL: Table "${table}" does not exist in Supabase!`);
      if (table === 'users') {
        console.warn(`[SupabaseAdapter] Please run this SQL in your Supabase SQL Editor:
        
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          owner_id UUID REFERENCES auth.users(id),
          email TEXT UNIQUE,
          nome TEXT,
          cpf TEXT,
          whatsapp TEXT,
          data_nascimento DATE,
          endereco TEXT,
          bairro TEXT,
          cidade TEXT,
          estado TEXT,
          data_cadastro TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can manage their own data" ON users FOR ALL USING (auth.uid() = id);
        `);
      }
    }
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
  console.log(`[SupabaseAdapter] [Subscription] New onSnapshot for: ${firestoreCollection} (Table: ${table})`);

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
    // Tenta extrair ownerId dos filtros para limitar o tráfego do Realtime
    let filterStr = '';
    const filters = isQuery ? queryRef.filters : [];
    const ownerFilter = filters.find((f: any) => (f.type === 'where' && (f.field === 'ownerId' || f.field === 'owner_id')) && f.op === '==');
    
    if (ownerFilter) {
      filterStr = `owner_id=eq.${ownerFilter.value}`;
      console.log(`[SupabaseAdapter] [Realtime] Applying owner filter to subscription for ${table}: ${filterStr}`);
    }

    console.log(`[SupabaseAdapter] [Realtime] Connecting to channel: rt:${table}:${listenerId}`);
    channel = supabase
      .channel(`rt:${table}:${listenerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: filterStr || undefined },
        (payload: any) => {
          console.log(`[SupabaseAdapter] [Realtime] Event received for ${table}:`, payload.eventType, payload.new?.id);
          // Quando ocorrer alteração remota, atualiza a query e notifica a tela
          fetchAndTrigger(listener);
        }
      )
      .subscribe((status: string) => {
        console.log(`[SupabaseAdapter] [Realtime] Status for ${table}:`, status);
      });
  } else if (!supabase) {
    console.warn(`[SupabaseAdapter] [Realtime] No Supabase instance. Realtime updates for ${table} will only happen on LOCAL changes.`);
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

// Sincronização imediata na inicialização se já houver um usuário salvo
if (currentUserInMock) {
  console.log('[SupabaseAdapter] Usuário detectado na inicialização. Agendando sincronização de dados...');
  setTimeout(() => syncLegacyData(), 1500);
}

// Inicialização do listener real do Supabase caso configurado
const sb = getSupabase();
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    console.log(`[Supabase Auth Adapter] EVENT: ${event} | USER: ${session?.user?.email || 'Nenhum'}`);
    
    if (session?.user) {
      const u = session.user;
      const firebaseUser: User = {
        uid: u.id,
        email: u.email || null,
        displayName: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Usuário',
        photoURL: u.user_metadata?.avatar_url || null,
        phoneNumber: u.phone || null,
        emailVerified: !!u.email_confirmed_at,
        isAnonymous: false,
      };
      // Evita loops infinitos verificando se o ID mudou
      if (!currentUserInMock || currentUserInMock.uid !== u.id) {
        setAuthenticatedUser(firebaseUser);
      }
    } else if (event === 'SIGNED_OUT') {
      if (currentUserInMock) {
        setAuthenticatedUser(null);
      }
    }
  });
}

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
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    
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
    // Sincronização automática para converter dados locais em dados de nuvem
    setTimeout(() => syncLegacyData(), 1200);
  } else {
    localStorage.removeItem('supabase_mock_user');
    localStorage.removeItem('google_demo_logged_in_v1');
    localStorage.removeItem('google_access_token');
  }
  authStateListeners.forEach(listener => listener(user));
}

// Function to sync legacy data from individual localStorage keys to the adapters/database
export async function syncLegacyData() {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[SupabaseAdapter] Sincronização cancelada: Supabase não está configurado.');
    return;
  }

  const user = currentUserInMock;
  if (!user) {
    console.log('[SupabaseAdapter] Sincronização adiada: nenhum usuário logado.');
    return;
  }
  const uid = user.uid;

  // Evita múltiplas execuções simultâneas
  const syncKey = `sb_sync_in_progress_${uid}`;
  if (sessionStorage.getItem(syncKey)) return;
  sessionStorage.setItem(syncKey, 'true');

  console.log('[SupabaseAdapter] [Sync] Iniciando varredura completa de dados locais para migração...');

  try {
    // 1. CRM Stages
    const legacyCrm = localStorage.getItem('wa_crm_funnel_stages');
    if (legacyCrm && legacyCrm !== 'undefined' && legacyCrm !== 'null' && legacyCrm !== '[]') {
      try {
        const stages = JSON.parse(legacyCrm);
        if (Array.isArray(stages) && stages.length > 0) {
          console.log(`[Sync] Migrando ${stages.length} estágios do funil...`);
          for (const s of stages) {
            await setDoc(doc(db, 'funnel_stages', s.id || Math.random().toString(36).substring(2, 11)), {
              ...s,
              ownerId: uid
            }, { merge: true });
          }
          localStorage.removeItem('wa_crm_funnel_stages');
        }
      } catch (e) {
        console.warn('[Sync] Falha ao sincronizar CRM:', e);
      }
    }

    // 2. AI Connections
    const legacyAI = localStorage.getItem('ai_connections_v1');
    if (legacyAI && legacyAI !== 'undefined' && legacyAI !== 'null' && legacyAI !== '[]') {
      try {
        const conns = JSON.parse(legacyAI);
        if (Array.isArray(conns) && conns.length > 0) {
          console.log(`[Sync] Migrando ${conns.length} conexões de IA...`);
          for (const c of conns) {
            await setDoc(doc(db, 'ai_connections', c.id || Math.random().toString(36).substring(2, 11)), {
              ...c,
              ownerId: uid
            }, { merge: true });
          }
          localStorage.removeItem('ai_connections_v1');
        }
      } catch (e) {
        console.warn('[Sync] Falha ao sincronizar AI:', e);
      }
    }

    // 3. App Settings (Lembretes WhatsApp)
    const waRemEnabled = localStorage.getItem('whatsapp_reminders_enabled');
    const waRemMins = localStorage.getItem('whatsapp_reminder_minutes');
    const waTemplateLocal = localStorage.getItem('whatsapp_template_local');
    
    if (waRemEnabled !== null || waRemMins !== null || waTemplateLocal !== null) {
       console.log('[Sync] Migrando configurações de lembretes...');
       await setDoc(doc(db, 'app_settings', 'whatsapp_config'), {
         ownerId: uid,
         payload: {
           enabled: waRemEnabled !== 'false',
           minutes: parseInt(waRemMins || '1440', 10),
           template: waTemplateLocal || ''
         }
       }, { merge: true });
       localStorage.removeItem('whatsapp_reminders_enabled');
       localStorage.removeItem('whatsapp_reminder_minutes');
       localStorage.removeItem('whatsapp_template_local');
    }

    // 4. Migração Genérica de Tabelas Mock (sb_mock_*) E Tabelas Brutas (variantes PT/EN)
    const tableMappings = [
      { local: 'pacientes', remote: 'pacientes' },
      { local: 'patients', remote: 'pacientes' },
      { local: 'prontuarios', remote: 'pacientes' },
      { local: 'clinics', remote: 'clinics' },
      { local: 'clinicas', remote: 'clinics' },
      { local: 'dentists', remote: 'dentists' },
      { local: 'dentistas', remote: 'dentists' },
      { local: 'appointments', remote: 'agendamentos' },
      { local: 'agendamentos', remote: 'agendamentos' },
      { local: 'procedures', remote: 'procedures' },
      { local: 'procedimentos', remote: 'procedures' },
      { local: 'specialties', remote: 'specialties' },
      { local: 'especialidades', remote: 'specialties' },
      { local: 'quick_responses', remote: 'quick_responses' },
      { local: 'response_categories', remote: 'response_categories' },
      { local: 'whatsapp_chats', remote: 'whatsapp_chats' },
      { local: 'whatsapp_messages', remote: 'whatsapp_messages' }
    ];

    for (const mapping of tableMappings) {
      const { local, remote } = mapping;
      
      // Tenta varrer: sb_mock_TABLE e TABLE (bruto legado)
      const storageKeys = [`sb_mock_${local}`, local];
      
      for (const key of storageKeys) {
        const raw = localStorage.getItem(key);
        if (!raw || raw === 'undefined' || raw === 'null' || raw === '[]') continue;
        
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[Sync] Migrando ${parsed.length} itens de "${key}" para "${remote}"...`);
            
            for (const item of parsed) {
              const finalId = item.id || Math.random().toString(36).substring(2, 11);
              await setDoc(doc(db, remote, finalId), {
                ...item,
                ownerId: uid,
                updatedAt: item.updatedAt || item.created_at || new Date().toISOString()
              }, { merge: true });
            }
            // Sucesso! Remove apenas se conseguirmos processar
            localStorage.removeItem(key);
          }
        } catch (e) {
          console.warn(`[Sync] Erro na tabela ${key}:`, e);
        }
      }
    }

    console.log('[SupabaseAdapter] [Sync] Sincronização finalizada com sucesso.');
  } catch (err) {
    console.error('[SupabaseAdapter] [Sync] Erro fatal durante a sincronização:', err);
  } finally {
    sessionStorage.removeItem(syncKey);
  }
}

/**
 * Realiza o processo inverso: baixa todos os dados da nuvem e atualiza a "rede local" (MockStorage).
 * Útil para sincronizar ambientes de desenvolvimento com os dados reais de produção.
 */
export async function syncCloudToLocal() {
  const supabase = getSupabase() as any;
  if (!supabase) {
    const errorMsg = 'Configuração do Supabase ausente. Adicione as chaves em "Settings > Secrets" para permitir baixar dados da nuvem.';
    console.error(`[SupabaseAdapter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log('[SupabaseAdapter] [Sync-Pull] Iniciando sincronização NUVEM -> LOCAL...');

  const tables = [
    'pacientes', 'clinics', 'dentists', 'agendamentos', 
    'procedures', 'specialties', 'quick_responses', 
    'funnel_stages', 'ai_connections', 'users'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`[Sync-Pull] Erro ao baixar tabela ${table}:`, error.message);
        continue;
      }
      
      if (data && data.length > 0) {
        const camelData = snakeToCamel(data);
        console.log(`[Sync-Pull] Atualizando local sb_mock_${table} com ${data.length} itens da nuvem.`);
        saveMockStorage(table, camelData);
      }
    } catch (err) {
      console.error(`[Sync-Pull] Falha crítica na sincronização da tabela ${table}:`, err);
    }
  }

  console.log('[SupabaseAdapter] [Sync-Pull] Sincronização concluída com sucesso.');
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
