'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrderStatusBadge } from '@/components/employee/OrderStatusBadge';

export default function HistoriquePage() {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiFetch<any[]>('/commandes')
      .then(setCommandes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/commande')} className="text-gray-500 hover:text-gray-700">←</button>
          <h1 className="text-xl font-bold text-gray-800">Mes commandes</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Chargement…</p>
        ) : commandes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Aucune commande pour l'instant.</p>
            <button
              onClick={() => router.push('/commande')}
              className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-xl"
            >
              Commander maintenant
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/commandes/${c.id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">
                      {new Date(c.date_commande).toLocaleDateString('fr-FR')} — {c.creneau}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {c.montant_total?.toLocaleString('fr-FR')} FCFA
                      {c.penalite && <span className="text-red-500 ml-2">Pénalité</span>}
                    </p>
                  </div>
                  <OrderStatusBadge commandeId={c.id} initialStatut={c.statut} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
