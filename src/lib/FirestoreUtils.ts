import { doc, getDoc, setDoc } from './supabaseAdapter';

export const robustSetDoc = async (ref: any, data: any, options?: any) => {
  let retries = 5;
  let delay = 300;
  while (retries > 0) {
    try {
      if (options) {
        await setDoc(ref, data, options);
      } else {
        await setDoc(ref, data);
      }
      return;
    } catch (err: any) {
      retries--;
      const matchesPermissionDenied = err.message?.toLowerCase().includes('permission') || 
                                     err.code?.toLowerCase().includes('permission') ||
                                     err.message?.toLowerCase().includes('rls');
      if (matchesPermissionDenied && retries > 0) {
        console.warn(`Firestore setDoc retry due to transient/permission error in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      } else {
        throw err;
      }
    }
  }
};

export const robustGetDoc = async (ref: any) => {
  let retries = 5;
  let delay = 300;
  while (retries > 0) {
    try {
      const snap = await getDoc(ref);
      return snap;
    } catch (err: any) {
      retries--;
      const matchesPermissionDenied = err.message?.toLowerCase().includes('permission') || 
                                     err.code?.toLowerCase().includes('permission') ||
                                     err.message?.toLowerCase().includes('rls');
      if (matchesPermissionDenied && retries > 0) {
        console.warn(`Firestore getDoc retry due to transient/permission error in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      } else {
        throw err;
      }
    }
  }
};

export enum OperationType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LIST = 'LIST'
}

export const handleFirestoreError = (error: any, operation: OperationType, collection: string) => {
  console.error(`[Firestore Error] ${operation} in ${collection}:`, error);
  return error;
};
