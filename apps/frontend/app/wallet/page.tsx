'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiException, getAccessToken } from '@/lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';
const MOOV = '0168204654';
const MTN  = '0154824064';

interface Wallet { id: string; solde: number; updated_at: string; }
interface Transaction {
  id: string; type: 'recharge' | 'debit' | 'credit_demande';
  montant: number; solde_avant: number; solde_apres: number; created_at: string;
}
interface TransactionPage { items: Transaction[]; total: number; page: number; limit: number; }
interface Demande {
  id: string; montant_demande: number; capture_url?: string;
  statut: 'en_attente' | 'acceptee' | 'collecte_en_cours' | 'completee' | 'refusee';
  motif_refus?: string; notes?: string; created_at: string; updated_at: string;
}

const fmt = (n: number) => Number(n).toLocaleString('fr-FR') + ' FCFA';
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800',
  acceptee: 'bg-blue-100 text-blue-800',
  collecte_en_cours: 'bg-purple-100 text-purple-800',
  completee: 'bg-green-100 text-green-800',
  refusee: 'bg-red-100 text-red-800',
};
const STATUT_LABELS: Record<string, string> = {
  en_attente: '⏳ En attente de validation',
  acceptee: '✅ Acceptée',
  collecte_en_cours: '🚚 En cours',
  completee: '✅ Créditée',
  refusee: '❌ Refusée',
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txPage, setTxPage] = useState<TransactionPage | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Demande de rechargement
  const [showModal, setShowModal] = useState(false);
  const [montant, setMontant] = useState('');
  const [capture, setCapture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendOk, setSendOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      apiFetch<Wallet>('/wallet'),
      apiFetch<TransactionPage>(`/wallet/transactions?page=${page}&limit=10`),
      apiFetch<Demande[]>('/wallet/demandes'),
    ]).then(([w, tx, d]) => { setWallet(w); setTxPage(tx); setDemandes(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [page]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCapture(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDemande = async () => {
    setSendError('');
    const m = parseInt(montant, 10);
    if (!m || m <= 0) { setSendError('Montant invalide'); return; }
    if (!capture) { setSendError('Veuillez joindre la capture de votre dépôt'); return; }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('montant_demande', String(m));
      fd.append('notes', notes);
      fd.append('capture', capture);
      // On passe adresse_collecte vide — non requis dans ce flux
      fd.append('adresse_collecte', 'Mobile Money');
      fd.append('contact', '');

      await apiFetch('/wallet/demandes', { method: 'POST', body: fd });
      setSendOk(true);
      setShowModal(false);
      setMontant(''); setCapture(null); setPreview(null); setNotes('');
      reload();
    } catch (e) {
      setSendError(e instanceof ApiException ? e.message : 'Erreur inattendue');
    } finally { setSending(false); }
  };

  const totalPages = txPage ? Math.ceil(txPage.total / (txPage.limit || 10)) : 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/commande" className="text-gray-400 hover:text-gray-700">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Mon Wallet</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* ── Carte solde ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-green-200/40">
          {loading ? <p className="text-green-200 text-sm">Chargement...</p> : wallet ? (
            <>
              <p className="text-green-100 text-sm">Solde disponible</p>
              <p className="text-4xl font-bold mt-1">{fmt(Number(wallet.solde))}</p>
              <p className="text-green-200 text-xs mt-1">Mis à jour le {fmtDate(wallet.updated_at)}</p>
            </>
          ) : <p className="text-green-200 text-sm">Wallet non disponible</p>}
        </div>

        {/* ── Bouton demande de rechargement ─────────────────────────── */}
        <button
          onClick={() => { setSendOk(false); setSendError(''); setShowModal(true); }}
          className="w-full bg-white border-2 border-green-500 text-green-700 font-semibold py-4 rounded-2xl text-base flex items-center justify-center gap-3 hover:bg-green-50 transition-colors shadow-sm"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Demander un rechargement
        </button>

        {sendOk && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            ✅ Demande envoyée ! Votre compte sera rechargé sous <strong>8h max</strong> après validation de la capture.
          </div>
        )}

        {/* ── Instructions de dépôt ───────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">Pour recharger votre wallet :</p>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Effectuez un dépôt Mobile Money vers l'un des numéros ci-dessous</li>
            <li>Prenez une capture d'écran de la confirmation de dépôt</li>
            <li>Cliquez "Demander un rechargement" et joignez la capture</li>
            <li>Votre solde sera crédité sous <strong>8h max</strong></li>
          </ol>
          <div className="flex gap-3 mt-3 flex-wrap">
            <div className="bg-white border border-orange-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-500">Moov Money</p>
              <p className="text-base font-bold text-orange-600">{MOOV}</p>
            </div>
            <div className="bg-white border border-yellow-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-500">MTN Money</p>
              <p className="text-base font-bold text-yellow-600">{MTN}</p>
            </div>
          </div>
        </div>

        {/* ── Demandes en cours ───────────────────────────────────────── */}
        {demandes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Mes demandes</h2>
            <div className="space-y-2">
              {demandes.map(d => (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  {d.capture_url && (
                    <img src={`${API_ORIGIN}${d.capture_url}`} alt="Capture"
                      className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{fmt(Number(d.montant_demande))}</p>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${STATUT_STYLE[d.statut]}`}>
                      {STATUT_LABELS[d.statut]}
                    </span>
                    {d.motif_refus && <p className="text-xs text-red-500 mt-1">{d.motif_refus}</p>}
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(d.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Historique transactions ─────────────────────────────────── */}
        {txPage && txPage.items.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Historique</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {txPage.items.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {tx.type === 'recharge' ? '↓ Recharge' : tx.type === 'credit_demande' ? '↓ Crédit dépôt' : '↑ Paiement'}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(tx.created_at)}</p>
                  </div>
                  <p className={`font-bold text-sm ${tx.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'debit' ? '-' : '+'}{fmt(Number(tx.montant))}
                  </p>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">← Préc.</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Suiv. →</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Modal demande de rechargement ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Demande de rechargement</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Instructions rapides */}
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
              Déposez sur <strong>Moov {MOOV}</strong> ou <strong>MTN {MTN}</strong>,
              puis joignez la capture de confirmation.
            </div>

            {/* Montant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant déposé (FCFA)</label>
              <input type="number" min="1" value={montant} onChange={e => setMontant(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-green-500"
                placeholder="Ex: 10000" />
            </div>

            {/* Upload capture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capture de confirmation de dépôt <span className="text-red-500">*</span>
              </label>
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Capture" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
                  <button onClick={() => { setCapture(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border text-gray-500 hover:text-red-500">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium">Appuyer pour ajouter la capture</span>
                  <span className="text-xs">JPG, PNG ou WebP — 10 Mo max</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
                placeholder="Moov / MTN, référence transaction..." />
            </div>

            {sendError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{sendError}</p>}

            <button onClick={handleDemande} disabled={sending}
              className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-green-700 disabled:opacity-50 transition-colors">
              {sending ? 'Envoi en cours...' : 'Envoyer la demande'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
