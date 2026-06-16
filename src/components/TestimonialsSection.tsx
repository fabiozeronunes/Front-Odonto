import { motion } from 'motion/react';
import { Star } from 'lucide-react';

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-16 sm:py-24 bg-neutral-900/20 border-y border-neutral-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <div className="flex justify-center gap-1 mb-6">
              {[1,2,3,4,5].map(i => <Star key={i} className="text-amber-400 w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />)}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-16 tracking-tight">O que os especialistas dizem</h2>
          <motion.blockquote 
            whileInView={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light italic text-white mb-10 leading-relaxed sm:leading-snug"
          >
              "A automação gerada pelo Front Odonto é inigualável. Minha clínica agora escala com a inteligência e a precisão necessárias para o mercado de luxo."
          </motion.blockquote>
          <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-neutral-700 rounded-full"></div>
              <div className="text-left">
                  <p className="font-bold text-lg">Dr. Fábio Zeronunes</p>
                  <p className="text-sm text-blue-400">Ortodontista e Fundador</p>
              </div>
          </div>
      </div>
    </section>
  );
}
