'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { OrderAggregTable } from '@/components/admin/OrderAggregTable';
import Link from 'next/link';

const STATUTS = ['en_attente', 'en_preparation', 'en_livraison', 'livre', 'en_retard'] as const;
const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_preparation: 'En preparation',
  en_livraison: 'En livraison',
  livre: 'Livre',
  en_retard: 'En retard',
};

export default function CommandesAdminPage() {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [agregat, setAggregat] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<'liste' | 'agregat'>('liste');

  const load = () => {
    apiFetch<any[]>(`/admin/commandes?date=${date}`).then(setCommandes).catch(console.error);
    apiFetch<any[]>(`/admin/commandes/aggregate?date=${date}`).then(setAggregat).catch(console.error);
  };

  useEffect(() => { load(); }, [date]);

  const handleStatut = async (id: string, statut: string) => {
    await apiFetch(`/admin/commandes/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) });
    load();
  };

  const statutColor: Record<string, string> = {
    en_attente: 'bg-gray-100 text-gray-600',
    en_preparation: 'bg-blue-100 text-blue-700',
    en_livraison: 'bg-amber-100 text-amber-700',
    livre: 'bg-green-100 text-green-700',
    en_retard: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Commandes</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-base font-medium text-gray-700">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base block focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setView('liste')}
              className={`px-5 py-2.5 rounded-lg text-base font-medium transition ${view === 'liste' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Liste
            </button>
            <button onClick={() => setView('agregat')}
              className={`px-5 py-2.5 rounded-lg text-base font-medium transition ${view === 'agregat' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Agregation
            </button>
          </div>
        </div>

        {view === 'agregat' ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Volume par article et creneau</h2>
            <div className="swipe-x">
              <OrderAggregTable rows={agregat} />
            </div>
          </div>
        ) : (
          <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-base" style={{ minWidth: '600px' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Structure', 'Creneau', 'Montant', 'Statut', 'Changer statut'].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {commandes.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Aucune commande ce jour.</td></tr>
                ) : commandes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">{c.structure_nom}</td>
                    <td className="px-5 py-4 text-gray-600">{c.creneau}</td>
                    <td className="px-5 py-4 text-gray-700">{Number(c.montant_total).toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutColor[c.statut] || ''}`}>
                        {STATUT_LABELS[c.statut] || c.statut}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <select value={c.statut} onChange={(e) => handleStatut(c.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400">
                        {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
