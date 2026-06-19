import { getSupabase } from './supabase';

// Helper: Mapeador de tabelas de Firestore para Supabase Postgres
export function getSupabaseTable(firestoreCollection: string): string {
  if (firestoreCollection === 'agendamentos') return 'appointments';
  if (firestoreCollection === 'pacientes') return 'pacientes';
  return firestoreCollection;
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
  const supabase = getSupabase() as any;
  if (!supabase) {
    console.warn("Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    return [];
  }

  const isQuery = queryRef.type === 'query';
  const firestoreCollection = isQuery ? queryRef.collection.path : queryRef.path;
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
  const supabase = getSupabase() as any;
  if (!supabase) throw new Error('Supabase client não configurado');

  const table = getSupabaseTable(collectionRef.path);
  // Gerar ID sequencial de string ou UUID
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);

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
  const supabase = getSupabase() as any;
  if (!supabase) throw new Error('Supabase client não configurado');

  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  const adaptedData = adaptInputData(table, data);
  const pgData = camelToSnake({ id, ...adaptedData });

  const { error } = await supabase
    .from(table)
    .upsert(pgData, { onConflict: 'id' });

  if (error) {
    console.error(`Erro ao upsert na tabela ${table}:`, error);
    throw error;
  }

  triggerListenersForTable(docRef.path);
}

// 3. UPDATE DOC
export async function updateDoc(docRef: any, data: any) {
  const supabase = getSupabase() as any;
  if (!supabase) throw new Error('Supabase client não configurado');

  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

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
  const supabase = getSupabase() as any;
  if (!supabase) throw new Error('Supabase client não configurado');

  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

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
  const supabase = getSupabase() as any;
  if (!supabase) throw new Error('Supabase client não configurado');

  const table = getSupabaseTable(docRef.path);
  const id = docRef.id;

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao buscar registro na tabela ${table}:`, error);
    throw error;
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

  if (supabase) {
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
