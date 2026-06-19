import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from '../lib/supabaseAdapter';
import { Patient } from '../types';
import { Loader2, DollarSign, TrendingUp, Users } from 'lucide-react';
import { auth } from '../lib/firebase';

export default function FinancialReports() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const patientsQuery = query(collection(db, 'pacientes'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(patientsQuery, (snapshot) => {
      setPatients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  const totalRevenue = patients.reduce((acc, p) => {
    const planned = p.plannedProcedures || [];
    return acc + planned.reduce((sum: number, proc: any) => sum + (parseFloat(proc.value) || 0), 0);
  }, 0);

  const reports = [
    { title: 'Faturamento Total Previsto', value: totalRevenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Total de Pacientes', value: patients.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Ticket Médio', value: patients.length > 0 ? (totalRevenue / patients.length) : 0, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Relatórios Financeiros</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map((report, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs flex items-center gap-4">
            <div className={`p-3 rounded-xl ${report.bg} ${report.color}`}>
              <report.icon size={24} />
            </div>
            <div>
              <p className="text-neutral-500 text-sm font-medium">{report.title}</p>
              <h3 className="text-xl font-black">
                {report.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-xs">
          <h3 className="font-bold text-lg mb-4">Detalhamento</h3>
          <table className="w-full text-left">
            <thead>
                <tr className="border-b border-neutral-100">
                    <th className="pb-4 font-semibold text-neutral-500 text-sm">Paciente</th>
                    <th className="pb-4 font-semibold text-neutral-500 text-sm">Faturamento</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
                {patients.map((p, idx) => (
                    <tr key={`${p.id}-${idx}`}>
                        <td className="py-4 font-medium">{p.nome || (p as any).name}</td>
                        <td className="py-4 font-bold text-neutral-900">
                            {(p.plannedProcedures?.reduce((sum: number, proc: any) => sum + (parseFloat(proc.value) || 0), 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}
