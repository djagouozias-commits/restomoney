'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAccessToken } from '@/lib/api';
import { OrderReceipt } from '@/components/employee/OrderReceipt';
import { OrderStatusBadge } from '@/components/employee/OrderStatusBadge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function CommandeDetailPage({ params }: { params: { id: string } }) {
  const [commande, setCommande] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Signalement retard
  const [showSignalement, setShowSignalement] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [signalNote, setSignalNote] = useState('');
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalResult, setSignalResult] = useState<{
    message: string;
    retard_minutes: number;
    niveau_sanction: number | null;
    reduction_pct: number | null;
    bon_emis: boolean;
  } | null>(null);
  const [signalError, setSignalError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<any>(`/commandes/${params.id}`)
      .then(setCommande)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleSignalement = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setSignalError('Prenez ou sélectionnez une photo avant de continuer.'); return; }

    setSignalError('');
    setSignalLoading(true);

    try {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('commande_id', params.id);
      if (signalNote.trim()) fd.append('note', signalNote.trim());

      const res = await fetch(`${API_BASE}/signalements`, {
        method: 'POST',
        body: fd,
        headers: {
          // Utiliser getAccessToken() — le token est en mémoire, pas localStorage
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Erreur lors du signalement.');
      }

      const data = await res.json();
      setSignalResult(data);
      setShowSignalement(false);

      // Recharger la commande pour voir les changements
      const updated = await apiFetch<any>(`/commandes/${params.id}`);
      setCommande(updated);
    } catch (e: any) {
      setSignalError(e.message || 'Une erreur est survenue.');
    } finally {
      setSignalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500">←</button>
          <h1 className="text-xl font-bold text-gray-800">Détail commande</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Chargement...</p>
        ) : commande ? (
          <>
            {/* Statut */}
            <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <span className="text-sm text-gray-600">Statut en temps réel</span>
              <OrderStatusBadge commandeId={commande.id} initialStatut={commande.statut} />
            </div>

            {/* Reçu */}
            <OrderReceipt commande={commande} />

            {/* Résultat signalement */}
            {signalResult && (
              <div className={`rounded-xl px-4 py-4 border ${
                signalResult.niveau_sanction
                  ? 'bg-red-50 border-red-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-semibold text-sm ${
                    signalResult.niveau_sanction ? 'text-red-700' : 'text-green-700'
                  }`}>
                    Signalement enregistré
                  </p>
                  <button
                    onClick={() => setSignalResult(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs underline flex-shrink-0"
                  >
                    Annuler
                  </button>
                </div>
                <p className="text-sm mt-1 text-gray-700">{signalResult.message}</p>
                {signalResult.retard_minutes > 0 && (
                  <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                    <p>Retard : <strong>{signalResult.retard_minutes} min</strong></p>
                    {signalResult.niveau_sanction && (
                      <p>Niveau de sanction : <strong>{signalResult.niveau_sanction}</strong></p>
                    )}
                    {signalResult.reduction_pct && (
                      <p>Réduction appliquée : <strong>{signalResult.reduction_pct}%</strong></p>
                    )}
                    {signalResult.bon_emis && (
                      <p className="text-green-700 font-medium">Bon de réduction émis</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bouton signalement retard */}
            {!signalResult && commande.statut !== 'livre' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowSignalement(!showSignalement)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Signaler un retard de livraison</p>
                      <p className="text-xs text-gray-500 mt-0.5">Prenez une photo de la remise du repas</p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showSignalement ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSignalement && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
                      L'heure de la photo sera automatiquement enregistrée et comparée à l'heure de livraison prévue.
                      Si un retard est constaté, la sanction correspondante sera appliquée.
                    </p>

                    {/* Aperçu photo */}
                    {preview && (
                      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '200px' }}>
                        <img src={preview} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}

                    {/* Input photo — caméra en priorité sur mobile */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Photo de remise *
                      </label>
                      <div className="flex gap-2">
                        {/* Bouton caméra (mobile) */}
                        <label className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold cursor-pointer active:bg-gray-700 transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Prendre une photo
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                        </label>

                        {/* Bouton galerie */}
                        <label className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-3 px-4 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Galerie
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (fileRef.current && e.target.files?.[0]) {
                                const dt = new DataTransfer();
                                dt.items.add(e.target.files[0]);
                                fileRef.current.files = dt.files;
                                handlePhotoChange(e as any);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Note optionnelle */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note (optionnelle)
                      </label>
                      <input
                        type="text"
                        value={signalNote}
                        onChange={(e) => setSignalNote(e.target.value)}
                        placeholder="Ex : Livreur arrivé à 13h45..."
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>

                    {signalError && (
                      <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {signalError}
                      </p>
                    )}

                    <button
                      onClick={handleSignalement}
                      disabled={signalLoading || !preview}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {signalLoading ? 'Envoi en cours...' : 'Confirmer le signalement'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-red-400">Commande introuvable.</p>
        )}
      </main>
    </div>
  );
}
