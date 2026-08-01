'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const DeliveryMap = dynamic(
  () => import('@/components/admin/DeliveryMap').then((m) => ({ default: m.DeliveryMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border border-gray-200">
        Chargement de la carte...
      </div>
    ),
  },
);

const CRENEAUX = ['09:00', '12:00', '16:00', '20:00'];

export default function TourneesPage() {
  const [tournees, setTournees] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [creneau, setCreneau] = useState('12:00');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<any[]>(`/admin/tournees?date=${date}`).then(setTournees).catch(console.error);
  }, [date]);

  const loadTournee = useCallback((id: string) => {
    apiFetch<any>(`/admin/tournees/${id}`).then(setSelected).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const t = await apiFetch<any>('/admin/tournees', {
        method: 'POST',
        body: JSON.stringify({ creneau, date }),
      });
      load();
      loadTournee(t.id);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la creation de la tournee.');
    } finally {
      setCreating(false);
    }
  };

  const handleMarkDelivered = async (structureId: string) => {
    if (!selected) return;
    try {
      await apiFetch(`/admin/tournees/${selected.id}/structures/${structureId}`, { method: 'PATCH' });
      // Recharger la tournée sélectionnée pour mettre à jour la carte
      loadTournee(selected.id);
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la confirmation de livraison.');
    }
  };

  const livres = selected?.etapes?.filter((e: any) => e.livre).length || 0;
  const total = selected?.etapes?.length || 0;
  const progress = total > 0 ? Math.round((livres / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Tournees de livraison</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {/* Créer une tournée */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Planifier une tournee</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-base font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base block focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-base font-medium text-gray-700">Creneau</label>
              <select
                value={creneau}
                onChange={(e) => setCreneau(e.target.value)}
                className="mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base block focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                {CRENEAUX.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {creating ? 'Creation...' : 'Creer la tournee'}
            </button>
          </div>
          {error && <p className="text-red-600 text-base mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Liste des tournées */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-base font-semibold text-gray-700 mb-3">Tournees — {date}</h3>
            {tournees.length === 0 ? (
              <p className="text-gray-400 text-sm">Aucune tournee planifiee.</p>
            ) : (
              <div className="space-y-2">
                {tournees.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadTournee(t.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition border ${
                      selected?.id === t.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'hover:bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    <p className="font-semibold">{t.creneau}</p>
                    <p className={`text-xs mt-0.5 ${selected?.id === t.id ? 'text-gray-300' : 'text-gray-400'}`}>
                      {t.statut === 'terminee' ? 'Terminee' : t.statut === 'en_cours' ? 'En cours' : 'Planifiee'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Détail + carte */}
          <div className="lg:col-span-3 space-y-4">
            {selected ? (
              <>
                {/* Infos + progression */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Tournee {selected.creneau}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{selected.date_tournee}</p>
                    </div>
                    <span className={`text-sm px-3 py-1.5 rounded-full font-medium border ${
                      selected.statut === 'terminee'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : selected.statut === 'en_cours'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {selected.statut === 'terminee' ? 'Terminee' : selected.statut === 'en_cours' ? 'En cours' : 'Planifiee'}
                    </span>
                  </div>

                  {/* Barre de progression */}
                  {total > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progression</span>
                        <span>{livres} / {total} livraisons</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Liste des étapes */}
                  <div className="space-y-2">
                    {(selected.etapes || [])
                      .sort((a: any, b: any) => a.ordre - b.ordre)
                      .map((e: any) => (
                        <div
                          key={e.structure_id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                            e.livre ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                            e.livre ? 'bg-green-600' : 'bg-blue-600'
                          }`}>
                            {e.ordre}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-base truncate">{e.structure_nom}</p>
                            {e.lat && e.lon && (
                              <p className="text-xs text-gray-400 font-mono">{e.lat.toFixed(4)}, {e.lon.toFixed(4)}</p>
                            )}
                          </div>
                          {e.livre ? (
                            <span className="text-sm text-green-700 font-medium whitespace-nowrap">Livre</span>
                          ) : (
                            <button
                              onClick={() => handleMarkDelivered(e.structure_id)}
                              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
                            >
                              Confirmer livraison
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Carte */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Itineraire</h3>
                  <DeliveryMap
                    etapes={selected.etapes || []}
                    onMarkDelivered={handleMarkDelivered}
                  />
                </div>
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <p className="text-lg">Selectionnez une tournee pour voir l'itineraire.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
