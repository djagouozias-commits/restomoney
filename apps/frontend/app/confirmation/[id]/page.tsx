'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrderReceipt } from '@/components/employee/OrderReceipt';

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  const [commande, setCommande] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiFetch<any>(`/commandes/${params.id}`)
      .then(setCommande)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-green-600">✓ Commande confirmée</h1>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Chargement…</p>
        ) : commande ? (
          <OrderReceipt commande={commande} />
        ) : (
          <p className="text-center text-red-400">Commande introuvable.</p>
        )}
        <button
          onClick={() => router.push('/commande')}
          className="w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium hover:bg-orange-50"
        >
          ← Retour au menu
        </button>
        <button
          onClick={() => router.push('/historique')}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600"
        >
          Voir mon historique
        </button>
      </main>
    </div>
  );
}
