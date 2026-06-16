import { MessageSquare } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="faq" className="py-20 bg-neutral-900 border-t border-neutral-800 text-center">
        <MessageSquare className="w-10 h-10 mx-auto mb-6 text-blue-500" />
        <h2 className="text-2xl font-bold mb-4">Dúvidas Frequentes</h2>
        <p className="text-neutral-500 max-w-md mx-auto">O Front Odonto é a solução para levar sua clínica ao futuro. Ficou com alguma dúvida?</p>
    </footer>
  );
}
