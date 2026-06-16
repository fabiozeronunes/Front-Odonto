import { motion } from 'motion/react';
import { Stethoscope, Brain, Megaphone, Calendar, Users } from 'lucide-react';

const features = [
  { title: 'Gestão Inteligente', icon: Stethoscope, desc: 'Clínicas gerenciadas com precisão e eficiência.' },
  { title: 'IA Generativa', icon: Brain, desc: 'Textos, imagens e vídeos clínicos sob medida.' },
  { title: 'Ads Automáticos', icon: Megaphone, desc: 'Campanhas de alto impacto para sua clínica.' },
  { title: 'Agenda Otimizada', icon: Calendar, desc: 'Gestão de horários em tempo real.' },
  { title: 'CRM Avançado', icon: Users, desc: 'Fidelização e conversão inteligente.' },
];

export default function FeaturesSection() {
  return (
    <section id="recursos" className="py-16 sm:py-24 bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16">Recursos de Alta Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, i) => (
            <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-neutral-900 border border-neutral-700 p-6 sm:p-8 rounded-2xl sm:rounded-3xl hover:border-blue-500 transition-all hover:shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative w-12 h-12 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                    <feature.icon size={24} />
                </div>
                <h3 className="relative text-xl font-bold mb-3">{feature.title}</h3>
                <p className="relative text-neutral-400 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
