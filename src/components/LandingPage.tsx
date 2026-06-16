import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import TestimonialsSection from './TestimonialsSection';
import PlansSection from './PlansSection';
import Footer from './Footer';
import { Stethoscope } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: Props) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-blue-500/30">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-bold text-lg sm:text-xl tracking-tight">Front Odonto</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-neutral-300">
            <a href="#plataforma" className="hover:text-blue-400 transition-colors">Plataforma</a>
            <a href="#recursos" className="hover:text-blue-400 transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-blue-400 transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-blue-400 transition-colors">Depoimentos</a>
            <a href="#faq" className="hover:text-blue-400 transition-colors">FAQ</a>
          </div>
          <button 
            onClick={onLogin}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 sm:px-5 sm:py-2 rounded-md font-semibold text-xs sm:text-sm transition-all cursor-pointer"
          >
            Acessar Sistema
          </button>
        </div>
      </nav>

      <HeroSection onLogin={onLogin} />
      <FeaturesSection />
      <TestimonialsSection />
      <PlansSection onLogin={onLogin} />
      <Footer />
    </div>
  );
}
