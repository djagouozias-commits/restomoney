'use client';

import { useSSE } from '@/lib/useSSE';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface RetardRow {
  id: string;
  structure_nom: string;
  creneau: string;
  date_commande: string;
  penalite: boolean;
  montant_total: number;
  montant_final?: number;
}

export function LateOrdersBoard() {
  const [retards, setRetards] = useState<RetardRow[]>([]);
  const { lastEvent } = useSSE<any>('commande_retard');

  const load = () => apiFetch<RetardRow[]>('/admin/commandes/retards').then(setRetards).catch(console.error);

  useEffect(() => { load(); }, []);

  // Nouvelle commande en retard reçue par SSE → recharger
  useEffect(() => {
    if (lastEvent) load();
  }, [lastEvent]);

  const handlePenalite = async (id: string) => {
    await apiFetch(`/admin/commandes/${id}/penalite`, { method: 'POST' });
    load();
  };

  const rowClass = (r: RetardRow) => {
    if (r.penalite) return 'bg-red-50';
    return '';
  };

  return (
    <div className="overflow-x-auto">
      {retards.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-base">Aucune commande en retard.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['Structure', 'Date', 'Créneau', 'Montant', 'Pénalité', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {retards.map((r) => (
              <tr key={r.id} className={rowClass(r)}>
                <td className="px-4 py-3 font-medium">{r.structure_nom}</td>
                <td className="px-4 py-3 text-gray-500">{r.date_commande}</td>
                <td className="px-4 py-3">{r.creneau}</td>
                <td className="px-4 py-3">
                  {r.penalite && r.montant_final != null ? (
                    <span>
                      <span className="line-through text-gray-400 mr-1">{Number(r.montant_total).toLocaleString('fr-FR')}</span>
                      <span className="text-red-600 font-bold">{Number(r.montant_final).toLocaleString('fr-FR')} FCFA</span>
                    </span>
                  ) : (
                    <span>{Number(r.montant_total).toLocaleString('fr-FR')} FCFA</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.penalite ? (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">−50 % appliqué</span>
                  ) : (
                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">En retard</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!r.penalite && (
                    <button
                      onClick={() => handlePenalite(r.id)}
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg"
                    >
                      Appliquer −50 %
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
