import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, getRedirectResult, signInWithRedirect } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Singleton initialization pattern for Firebase App instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the database name explicitly if present, otherwise default to nameless instantiation
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);
export { GoogleAuthProvider, getRedirectResult };

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.setCustomParameters({
  access_type: 'offline'
});

export const signInWithGoogle = async (allowRedirect = true) => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  
  console.log("Starting Google Auth. isMobile:", isMobile, "allowRedirect:", allowRedirect);
  
  // Timeout de 10 segundos
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('auth/timeout')), 10000);
  });
  
  try {
    console.log("Attempting Google auth via popup...");
    const popupPromise = signInWithPopup(auth, provider);
    
    // Corrida entre popup e timeout
    const result = await Promise.race([popupPromise, timeoutPromise]) as any;
    
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return {
      user: result.user,
      accessToken: credential?.accessToken || null
    };
  } catch (error: any) {
    if (error.message === 'auth/timeout') {
      console.error("Authentication timed out.");
      throw error;
    }
    
    console.warn("Popup authentication failed or was blocked, checking fallback options...", error);
    
    // Se o usuário fechou ou cancelou o popup intencionalmente, apenas propaga o erro
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw error;
    }

    // Se estiver rodando dentro de um iframe (sandbox do AI Studio), o redirecionamento é bloqueado pelas políticas dos navegadores.
    // Lançamos um erro direto informando o iframe para forçar o acionamento instantâneo do login Sandbox de alta fidelidade.
    const isIframe = window.self !== window.top;
    if (isIframe) {
      console.warn("[Auth Sandbox Detect] Sincronização Google real via redirect bloqueada pelo iframe. Lançando erro para acionar o login Sandbox.");
      throw new Error('auth/iframe-sandbox-blocked');
    }
    
    // Se redirecionamento não for permitido, propaga o erro original do popup de imediato
    if (!allowRedirect) {
      throw error;
    }
    
    // Caso de bloqueio real ou restrição de popup, usa redirecionamento como fallback
    console.log("Popup failed, fallback redirecting for Google Auth...");
    sessionStorage.setItem('auth_in_progress', 'true');
    // Inicia redirecionamento e não aguarda aqui para evitar travamento
    signInWithRedirect(auth, provider);
    
    // Retorna null para indicar que a navegação deve ocorrer
    return null;
  }
};

/*
async function testConnection() {
  try {
    // Testing connection as recommended in the skill
    await getDocFromServer(doc(db, 'system', 'connection-test'));
    console.log("Connected to Firestore");
  } catch (error) {
    console.warn("Firestore collection 'system' might not exist, but connection was attempted.");
  }
}

testConnection();
*/
