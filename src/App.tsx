/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  LayoutDashboard, 
  Stethoscope, 
  Building2, 
  ChevronRight,
  LogOut,
  Bell,
  Settings,
  Megaphone,
  Menu,
  X,
  Link2,
  Brain,
  Sparkles,
  Home,
  ClipboardList,
  Award,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { auth, signInWithGoogle, getRedirectResult, GoogleAuthProvider } from './lib/firebase';
import { User } from 'firebase/auth';

// Components (will be extracted)
import Dashboard from './components/Dashboard';
import ClinicManager from './components/ClinicManager';
import DentistManager from './components/DentistManager';
import CRM from './components/CRM';
import Agenda from './components/Agenda';
import WhatsAppSimulator from './components/WhatsAppSimulator';
import AdGenerator from './components/AdGenerator';
import Connections from './components/Connections';
import AIConnections from './components/AIConnections';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import PatientManager from './components/PatientManager';
import ProcedureManager from './components/ProcedureManager';
import SpecialtyManager from './components/SpecialtyManager';
import FinancialReports from './components/FinancialReports';
import Profile from './components/Profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('google_access_token');
    return (token === 'null' || token === 'undefined') ? null : token;
  });
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) return tabParam;
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>(() => {
    return (localStorage.getItem('logged_in_view') as any) || 'landing';
  });
  const [isSpecialtiesExpanded, setIsSpecialtiesExpanded] = useState(false);

  // Persistence for activeTab and accessToken
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      const savedToken = localStorage.getItem('google_access_token');
      if (savedToken && savedToken !== 'null' && savedToken !== 'undefined') {
        setAccessToken(savedToken);
      }
    }
  }, [user]);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('google_access_token', accessToken);
    } else {
      localStorage.removeItem('google_access_token');
    }
  }, [accessToken]);

  useEffect(() => {
    let authInitialized = false;
    let redirectChecking = sessionStorage.getItem('auth_in_progress') === 'true';

    // 1. Initial Auth Check and Persistence Listener
    const unsubscribe = auth.onAuthStateChanged((u) => {
      console.log("Auth state changed:", u?.email || "No user");
      
      const isDemoLoggedIn = localStorage.getItem('google_demo_logged_in_v1') === 'true';
      if (isDemoLoggedIn || (u && u.isAnonymous)) {
        console.log("[Auth Trace] Demo or Anonymous user is logged in, overriding details with mock user.");
        const mockGoogleUser = {
          uid: u ? u.uid : 'google-demo-user-123',
          displayName: 'Fábio Zero Nunes (Demo Google)',
          email: 'fabiozeronunes@gmail.com',
          photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
          emailVerified: true,
          isAnonymous: u ? u.isAnonymous : true,
          providerId: 'google.com',
          getIdToken: u ? (() => u.getIdToken()) : (async () => 'demo-token'),
          getIdTokenResult: u ? (() => u.getIdTokenResult()) : (async () => ({ token: 'demo-token', claims: {} })),
          reload: u ? (() => u.reload()) : (async () => {}),
          toJSON: () => ({})
        } as any;
        setUser(mockGoogleUser);
        setView('dashboard');
        setIsSidebarOpen(true);
        setLoading(false);
        localStorage.setItem('logged_in_view', 'dashboard');
        localStorage.setItem('google_demo_logged_in_v1', 'true');
        return;
      }

      setUser(u);
      authInitialized = true;
      
      // ALWAYS disable loading screen to prevent race conditions or getting stuck in loading view
      setLoading(false);
      
      if (u) {
        setView('dashboard');
        setIsSidebarOpen(true); // Conectar com menu aberto
        setActiveTab(prev => {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || prev || 'dashboard';
        }); // com tela dashboard em segundo plano ou url parametrizada
        localStorage.setItem('logged_in_view', 'dashboard');
      } else {
        localStorage.removeItem('logged_in_view');
        localStorage.removeItem('google_access_token');
        // Mantém a tela de login se o usuário já estiver tentando entrar nela, evitando reverter
        setView(prev => prev === 'login' ? 'login' : 'landing');
      }
    });

    // 2. Handle Redirect Result if applicable
    const handleRedirect = async () => {
      if (redirectChecking) {
        try {
          console.log("[Auth Trace] Processing redirect result...");
          const result = await getRedirectResult(auth);
          console.log("[Auth Trace] Redirection result obtained:", result ? "Success" : "No result");
          if (result) {
            console.log("[Auth Trace] Redirect success for user:", result.user?.email);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
              console.log("[Auth Trace] Credential found, setting accessToken.");
              setAccessToken(credential.accessToken);
              localStorage.setItem('google_access_token', credential.accessToken);
            }
            setUser(result.user);
            setView('dashboard');
            setIsSidebarOpen(true); // Menu aberto ao conectar
            setActiveTab(prev => {
              const params = new URLSearchParams(window.location.search);
              return params.get('tab') || prev || 'dashboard';
            }); // Dashboard ativo atrás ou url parametrizada
            localStorage.setItem('logged_in_view', 'dashboard');
          } else {
            console.log("[Auth Trace] No redirect result found. Checking for existing user...");
            // If we are already logged in via firebase, keep them in dashboard
            if (auth.currentUser) {
              console.log("[Auth Trace] User found via auth.currentUser.");
              setUser(auth.currentUser);
              setView('dashboard');
              setIsSidebarOpen(true); // Menu aberto ao conectar
              setActiveTab(prev => {
                const params = new URLSearchParams(window.location.search);
                return params.get('tab') || prev || 'dashboard';
              }); // Dashboard ativo atrás ou url parametrizada
              localStorage.setItem('logged_in_view', 'dashboard');
            } else {
               console.log("[Auth Trace] No user found via redirect or auth.currentUser.");
            }
          }
        } catch (error) {
          console.error("[Auth Trace] Redirect authentication error:", error);
          if (auth.currentUser) {
            setUser(auth.currentUser);
            setView('dashboard');
            setIsSidebarOpen(true); // Menu aberto ao conectar
            setActiveTab(prev => {
              const params = new URLSearchParams(window.location.search);
              return params.get('tab') || prev || 'dashboard';
            }); // Dashboard ativo atrás ou url parametrizada
            localStorage.setItem('logged_in_view', 'dashboard');
          }
        } finally {
          sessionStorage.removeItem('auth_in_progress');
          redirectChecking = false;
          if (authInitialized) {
            setLoading(false);
          }
        }
      } else {
        // Safe timeout fallback
        setTimeout(() => {
          if (authInitialized) {
            setLoading(false);
          }
        }, 1200);
      }
    };

    handleRedirect();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Executa no carregamento inicial
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'home') {
      window.open('https://front-odonto.vercel.app', '_blank');
      return;
    }
    setActiveTab(tabId);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    // If navigating to agenda, ensure it resets to today if requested
    if (tabId === 'agenda') {
       sessionStorage.setItem('agenda_reset_today', 'true');
    }
  };

  const handleLogin = async (targetView?: string) => {
    if (targetView === 'demo') {
      console.log("[Auth Trace] Demo mode activated, setting mock accessToken.");
      setAccessToken('demo-token');
      localStorage.setItem('google_access_token', 'demo-token');
      setLoading(false);
      return;
    }
    try {
      console.log("[Auth Trace] Initiating login flow...");
      sessionStorage.setItem('auth_in_progress', 'true');
      setLoading(true); // Show loading while starting the process
      
      console.log("[Auth Trace] Calling signInWithGoogle...");
      const result = await signInWithGoogle(true); // Permitir redirecionamento pelo Dashboard
      console.log("[Auth Trace] signInWithGoogle completed. Result:", result ? "Popup success/Redirect initiated" : "No result returned (likely redirect initiatied)");
      
      // On desktop (popup), this code continues. On mobile (redirect), it reloads.
      if (!result) {
        console.log("[Auth Trace] Login process initiated (redirect). Waiting for reload.");
        // Redirecionamento em curso, não desliga o loading para aguardar o reload
        return;
      }

      console.log("[Auth Trace] Login successful, updating user and token states.");
      setUser(result.user);
      const token = result.accessToken || null;
      setAccessToken(token);
      if (token) {
        localStorage.setItem('google_access_token', token);
      }
      
      setIsSidebarOpen(true); // Abre o menu quando conecta
      if (view !== 'dashboard') {
        setActiveTab('dashboard'); // Define dashboard como tela principal apenas na entrada inicial
      }
      if (targetView && ['login', 'dashboard', 'landing'].includes(targetView)) {
        setView(targetView as any);
      } else if (view !== 'dashboard') {
        setView('dashboard');
      }

      sessionStorage.removeItem('auth_in_progress');
      setLoading(false);

    } catch (error: any) {
      console.error("[Auth Trace] Login failed:", error);
      
      // Auto-fallback para o modo de demonstração se falhar no iframe/sandbox
      console.warn("[Auth Fallback] Activating Google Demo access token fallback to bypass OAuth limits.");
      setAccessToken('demo-token');
      localStorage.setItem('google_access_token', 'demo-token');
      sessionStorage.removeItem('auth_in_progress');
      setLoading(false);
      
      // Alerta amigavelmente mas ativa o modo simulado de alta fidelidade
      if (error.code === 'auth/popup-blocked') {
        alert("A janela pop-up de login foi bloqueada pelo navegador. Ativamos a sincronização em Modo de Demonstração para que você use o aplicativo sem limites de imediato!");
      } else if (error.code === 'auth/unauthorized-domain' || (error.message && error.message.includes('auth/unauthorized-domain'))) {
        alert(`Este domínio (${window.location.hostname}) não está autorizado no Firebase.\n\nAtivamos a sincronização automática em Modo de Demonstração para que você clique e use o sistema normalmente de dentro deste iframe!`);
      } else if (error.message === 'auth/timeout') {
        alert("O tempo limite de conexão expirou. Ativamos o Modo de Demonstração com token simulado para não limitar sua experiência.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert("Sincronizador automático ativado em Modo de Demonstração para prosseguir na Sandbox do seu navegador!");
      }
      sessionStorage.removeItem('auth_in_progress');
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'home', label: 'INÍCIO', icon: Home },
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'clinics', label: 'CLÍNICAS', icon: Building2 },
    { id: 'dentists', label: 'DENTISTAS', icon: Stethoscope },
    { 
      id: 'specialties_parent', 
      label: 'ESPECIALIDADES', 
      icon: Award,
      subItems: [
        { id: 'specialties', label: 'CADASTRAR ESPECIALIDADES', icon: Award },
        { id: 'procedures', label: 'PROCEDIMENTOS', icon: ClipboardList }
      ]
    },
    { id: 'patients', label: 'PRONTUÁRIO DIGITAL', icon: Users },
    { id: 'ads', label: 'ANÚNCIOS AI', icon: Megaphone },
    { id: 'whatsapp', label: 'AGENTE WHATSAPP', icon: MessageSquare },
    { id: 'agenda', label: 'AGENDA', icon: Calendar },
    { id: 'crm', label: 'CRM / FUNIL', icon: Users },
    { id: 'connections', label: 'CONEXÕES', icon: Link2 },
    { id: 'ai_ads_connections', label: 'CONEXÕES AI ADS', icon: Sparkles },
    { id: 'ai_connections', label: 'CONEXÃO AI', icon: Brain },
    { id: 'financial_reports', label: 'RELATÓRIOS FINANCEIROS', icon: TrendingUp },
  ];

  const getActiveTabLabel = () => {
    for (const item of menuItems) {
      if (item.id === activeTab) return item.label;
      if ('subItems' in item && item.subItems) {
        const sub = item.subItems.find(s => s.id === activeTab);
        if (sub) return sub.label;
      }
    }
    return '';
  };

  const handleLoginSuccess = () => {
    sessionStorage.removeItem('auth_in_progress');
    
    const isDemoLoggedIn = localStorage.getItem('google_demo_logged_in_v1') === 'true';
    const u = auth.currentUser;
    if (isDemoLoggedIn || (u && u.isAnonymous)) {
      console.log("[Auth Trace] Demo Sandbox detected in handleLoginSuccess, applying mock state.");
      const mockGoogleUser = {
        uid: u ? u.uid : 'google-demo-user-123',
        displayName: 'Fábio Zero Nunes (Demo Google)',
        email: 'fabiozeronunes@gmail.com',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
        emailVerified: true,
        isAnonymous: u ? u.isAnonymous : true,
        providerId: 'google.com',
        getIdToken: u ? (() => u.getIdToken()) : (async () => 'demo-token'),
        getIdTokenResult: u ? (() => u.getIdTokenResult()) : (async () => ({ token: 'demo-token', claims: {} })),
        reload: u ? (() => u.reload()) : (async () => {}),
        toJSON: () => ({})
      } as any;
      setUser(mockGoogleUser);
      setView('dashboard');
      setIsSidebarOpen(true);
      setActiveTab(prev => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || prev || 'dashboard';
      });
      localStorage.setItem('logged_in_view', 'dashboard');
      return;
    }

    setUser(u);
    setView('dashboard');
    setIsSidebarOpen(true); // Conecta com menu aberto
    setActiveTab(prev => {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || prev || 'dashboard';
    }); // Dashboard ativo atrás ou url parametrizada
    localStorage.setItem('logged_in_view', 'dashboard');
  };

  if (loading && view === 'dashboard') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <Stethoscope className="text-blue-600 w-12 h-12 animate-pulse" />
          <p className="text-neutral-900 font-bold uppercase tracking-widest text-sm">Sincronizando Sessão...</p>
          <p className="text-neutral-400 text-xs font-medium">Isso pode levar alguns segundos se estivermos autenticando com o Google.</p>
          <button 
            onClick={() => {
              setLoading(false);
            }}
            className="mt-4 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:underline animate-bounce cursor-pointer"
          >
            Fechar e Continuar
          </button>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return <LandingPage onLogin={() => setView('login')} />;
  }

  if (view === 'login') {
    return <LoginPage onLogin={handleLoginSuccess} onBack={() => setView('landing')} />;
  }


  const safeUser = user || {
    displayName: 'Dentista Parceiro',
    email: 'autenticando...',
    photoURL: null,
    uid: 'loading'
  } as any;

  return (
    <div className="min-h-screen bg-neutral-50 flex font-sans text-neutral-900 overflow-x-clip">
      {/* Overlay para fechar sidebar no mobile */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 bg-white border-r border-neutral-200 transition-all duration-300 flex flex-col h-full z-50
        ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
      `}>
        <div className="p-6 flex items-center justify-between">
          {(isSidebarOpen || window.innerWidth < 1024) && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">Front Odonto AI</span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-neutral-100 rounded-lg">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {menuItems.map((item) => {
            const hasSubitems = 'subItems' in item;
            const isSubitemActive = hasSubitems && item.subItems?.some(sub => activeTab === sub.id);
            
            if (hasSubitems) {
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      setIsSpecialtiesExpanded(!isSpecialtiesExpanded);
                      if (!isSpecialtiesExpanded) {
                        handleTabClick('specialties');
                      }
                    }}
                    className={`
                      w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group
                      ${isSubitemActive || activeTab === 'specialties' ? 'bg-blue-50/60 text-blue-600 font-bold' : 'text-neutral-500 hover:bg-neutral-50'}
                    `}
                  >
                    <item.icon size={22} className={isSubitemActive || activeTab === 'specialties' ? 'text-blue-600' : 'group-hover:text-neutral-800'} />
                    {(isSidebarOpen || window.innerWidth < 1024) && (
                      <>
                        <span className="font-medium text-left flex-1 text-sm">{item.label}</span>
                        <ChevronDown 
                          size={16} 
                          className={`transition-transform duration-200 ${isSpecialtiesExpanded ? 'rotate-180' : 'rotate-0'}`} 
                        />
                      </>
                    )}
                  </button>

                  {/* Render submenu items */}
                  {isSpecialtiesExpanded && (isSidebarOpen || window.innerWidth < 1024) && (
                    <div className="pl-4 border-l-2 border-neutral-100 ml-6 space-y-1 py-1">
                      {item.subItems?.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => handleTabClick(sub.id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold
                            ${activeTab === sub.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-neutral-500 hover:bg-neutral-50'}
                          `}
                        >
                          <sub.icon size={15} className={activeTab === sub.id ? 'text-blue-600' : 'text-neutral-400'} />
                          <span>{sub.label}</span>
                          {activeTab === sub.id && (
                            <span className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group
                  ${activeTab === item.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-neutral-500 hover:bg-neutral-50'}
                `}
              >
                <item.icon size={22} className={activeTab === item.id ? 'text-blue-600' : 'group-hover:text-neutral-800'} />
                {(isSidebarOpen || window.innerWidth < 1024) && <span className="font-medium text-sm">{item.label}</span>}
                {activeTab === item.id && (isSidebarOpen || window.innerWidth < 1024) && (
                  <motion.div layoutId="activeInd" className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-100">
          <div className={`p-3 rounded-2xl bg-neutral-50 flex items-center ${(isSidebarOpen || window.innerWidth < 1024) ? 'gap-3' : 'justify-center'}`}>
            {safeUser.photoURL ? (
              <img src={safeUser.photoURL} alt="User" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 bg-blue-100 text-blue-700 font-bold flex items-center justify-center rounded-xl text-xs uppercase border border-blue-200 shrink-0">
                {safeUser.displayName ? safeUser.displayName.substring(0, 2) : (safeUser.email ? safeUser.email.substring(0, 2) : 'US')}
              </div>
            )}
            {(isSidebarOpen || window.innerWidth < 1024) && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate">{safeUser.displayName}</p>
                <p className="text-xs text-neutral-400 truncate">{safeUser.email}</p>
              </div>
            )}
            {(isSidebarOpen || window.innerWidth < 1024) && (
              <button onClick={() => {
                localStorage.removeItem('google_demo_logged_in_v1');
                localStorage.removeItem('google_access_token');
                setUser(null);
                setView('landing');
                auth.signOut().catch(() => {});
              }} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-20'}`}>
        <header className="h-20 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Botão de abrir/fechar sidebar sempre visível */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2.5 hover:bg-neutral-100 rounded-xl text-neutral-500 transition-colors cursor-pointer"
              title="Menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg md:text-xl font-bold capitalize">
              {getActiveTabLabel()}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-sm font-medium text-neutral-600 hidden md:inline">
              Usuário: {safeUser.displayName || safeUser.email}
            </span>
            <button className="p-2.5 text-neutral-500 hover:bg-neutral-100 rounded-xl relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button onClick={() => setActiveTab('profile')} className="p-2.5 text-neutral-500 hover:bg-neutral-100 rounded-xl" title="Configurações">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'home' && <LandingPage onLogin={() => setView('login')} />}
              {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
              {activeTab === 'clinics' && <ClinicManager />}
              {activeTab === 'dentists' && <DentistManager />}
              {activeTab === 'specialties' && <SpecialtyManager />}
              {activeTab === 'procedures' && <ProcedureManager setActiveTab={setActiveTab} />}
              {activeTab === 'patients' && <PatientManager />}
              {activeTab === 'crm' && <CRM onNavigate={setActiveTab} />}
              {activeTab === 'financial_reports' && <FinancialReports />}
              {activeTab === 'profile' && <Profile onNavigate={setActiveTab} />}
              {activeTab === 'agenda' && <Agenda accessToken={accessToken} onConnectGoogle={handleLogin} onNavigate={setActiveTab} onDisconnectGoogle={() => setAccessToken(null)} syncTrigger={syncTrigger} />}
              {activeTab === 'whatsapp' && <WhatsAppSimulator />}
              {activeTab === 'ads' && <AdGenerator />}
              {activeTab === 'connections' && <Connections type="general" setActiveTab={setActiveTab} accessToken={accessToken} onConnectGoogle={handleLogin} onSyncGoogle={() => setSyncTrigger(prev => prev + 1)} onDisconnectGoogle={() => setAccessToken(null)} />}
              {activeTab === 'ai_ads_connections' && <Connections type="ads" setActiveTab={setActiveTab} accessToken={accessToken} onConnectGoogle={handleLogin} onSyncGoogle={() => setSyncTrigger(prev => prev + 1)} onDisconnectGoogle={() => setAccessToken(null)} />}
              {activeTab === 'ai_connections' && <AIConnections />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sincronizando com o Google em segundo plano com Dashboard ativo atrás */}
      {loading && view === 'dashboard' && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-4">
            <Stethoscope className="text-blue-600 w-12 h-12 animate-pulse" />
            <p className="text-neutral-900 font-bold uppercase tracking-widest text-sm">Sincronizando Sessão...</p>
            <p className="text-neutral-400 text-xs font-medium">Sincronizando com o Google para atualizar sua agenda e conexões de anúncios.</p>
            <button 
              onClick={() => {
                setLoading(false);
              }}
              className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/10"
            >
              Fechar e Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
