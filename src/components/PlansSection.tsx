import { motion } from 'motion/react';

export default function PlansSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section id="planos" className="py-16 sm:py-24 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-16">Planos que cabem no seu bolso</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div className="bg-neutral-900 p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-neutral-800 flex flex-col items-center shadow-2xl relative overflow-hidden">
                    <h3 className="text-2xl font-semibold mb-4">Plano Básico</h3>
                    <div className="text-4xl sm:text-5xl font-bold mb-8">R$ 197<span className="text-lg text-neutral-500">/mês</span></div>
                    <ul className="text-neutral-400 mb-10 space-y-3 flex-grow text-sm sm:text-base">
                        <li>Gestão de agenda</li>
                        <li>Cadastro de pacientes</li>
                        <li>Suporte básico</li>
                    </ul>
                    <button onClick={onLogin} className="w-full bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 sm:py-3 rounded-md font-semibold text-xs sm:text-sm transition-all">Escolher Plano</button>
                </div>
                <div className="bg-blue-600 p-6 sm:p-10 rounded-2xl sm:rounded-3xl flex flex-col items-center shadow-[0_0_50px_-10px_rgba(37,99,235,0.8)] transform relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-white/20 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-bl-xl">MAIS POPULAR</div>
                    <h3 className="text-2xl font-semibold mb-4">Plano Premium</h3>
                    <div className="text-4xl sm:text-5xl font-bold mb-8 text-white">R$ 397<span className="text-blue-200 text-lg">/mês</span></div>
                    <ul className="text-blue-100 mb-10 space-y-3 flex-grow font-medium text-sm sm:text-base">
                        <li>Gestão e IA avançada</li>
                        <li>Ads Automáticos</li>
                        <li>CRM Conversão Alta</li>
                        <li>Suporte 24/7</li>
                    </ul>
                    <button onClick={onLogin} className="w-full bg-white hover:bg-neutral-100 text-blue-600 px-4 py-2.5 sm:py-3 rounded-md font-semibold text-xs sm:text-sm transition-all">Escolher Plano</button>
                </div>
            </div>
        </div>
    </section>
  );
}
