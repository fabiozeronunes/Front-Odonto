import { motion } from 'motion/react';
import { Award, Users, Star } from 'lucide-react';

export default function HeroSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-20 pb-20 overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 bg-neutral-950">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-neutral-950 to-neutral-950"></div>
         <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-neutral-950 to-transparent"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-5xl mx-auto text-center px-4 sm:px-6"
      >
        {/* Trust Badge */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:px-4 sm:py-2 bg-neutral-900/40 backdrop-blur-md rounded-full border border-neutral-700/50 mb-6 sm:mb-8 max-w-full text-left"
        >
            <div className="flex -space-x-1.5 sm:-space-x-2 shrink-0">
                {[1,2,3].map(i => <div key={i} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-700 border-2 border-neutral-900"></div>)}
            </div>
            <span className="text-[10px] sm:text-xs text-neutral-300 font-medium truncate">5.000+ pacientes transformados</span>
            <div className="h-3.5 w-px bg-neutral-700 shrink-0"></div>
            <div className="flex items-center gap-1 text-amber-400 shrink-0 text-[10px] sm:text-xs font-bold">
                <Star size={12} className="sm:w-3.5 sm:h-3.5 fill-current" />
                <span>4.9/5.0</span>
            </div>
        </motion.div>

        <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-8xl font-extrabold mb-6 sm:mb-8 tracking-tighter leading-[1.1] sm:leading-[0.9] text-white">
          Gestão Odontológica <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500">Impulsionada por IA</span>.
        </h1>
        <p className="text-sm sm:text-base md:text-xl text-neutral-400 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
          Transforme sua clínica com inteligência generativa e automação premium. Tecnologia de luxo para dentistas que buscam autoridade e performance.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
          <button 
            onClick={() => {
              const el = document.getElementById('planos');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="group inline-flex items-center justify-center bg-white text-neutral-950 px-5 py-2.5 sm:px-6 sm:py-3.5 rounded-md font-bold text-sm sm:text-base hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)]"
          >
              ESCOLHER PLANO DE ACESSO
          </button>
        </div>

        {/* Floating elements */}
        <motion.div 
           initial={{ opacity: 0, x: 50 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.8, duration: 1 }}
           className="absolute right-10 top-1/2 w-48 bg-neutral-900/60 backdrop-blur-xl border border-neutral-700 p-4 rounded-2xl hidden lg:block text-left"
        >
           <Award className="text-blue-500 mb-2" />
           <div className="text-sm font-bold">Certificação Premium</div>
           <div className="text-[10px] text-neutral-400">Tecnologia Certificada</div>
        </motion.div>
      </motion.div>
    </section>
  );
}
