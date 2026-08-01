'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiException } from '@/lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface WalletRow { id: string; structure_id: string; structure_nom: string; solde: number; updated_at: string; }
interface Demande {
  id: string; structure_id: string; structure_nom: string;
  montant_demande: number; capture_url?: string; notes?: string;
  statut: 'en_attente' | 'acceptee' | 'completee' | 'refusee' | 'collecte_en_cours';
  motif_refus?: string; created_at: string; updated_at: string;
}
interface Transaction {
  id: string; type: string; montant: number;
  solde_avant: number; solde_apres: number; created_at: string;
}
interface TxPage { items: Transaction[]; total: number; page: number; limit: number; }

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
  en_attente: 'En attente', acceptee: 'Acceptée',
  collecte_en_cours: 'Collecte', completee: 'Créditée', refusee: 'Refusée',
};

export default function AdminWalletsPage() {
  const [tab, setTab] = useState<'demandes' | 'wallets' | 'historique'>('demandes');
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [txData, setTxData] = useState<TxPage | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txFilter, setTxFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Valider rechargement
  const [validateTarget, setValidateTarget] = useState<Demande | null>(null);
  const [validateMontant, setValidateMontant] = useState('');
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateError, setValidateError] = useState('');

  // Refus
  const [refusTarget, setRefusTarget] = useState<Demande | null>(null);
  const [refusMotif, setRefusMotif] = useState('');

  // Recharge manuelle
  const [rechargeTarget, setRechargeTarget] = useState<WalletRow | null>(null);
  const [rechargeMontant, setRechargeMontant] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeError, setRechargeError] = useState('');

  // Aperçu capture
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  const reloadAll = () => {
    setLoading(true);
    Promise.all([
      apiFetch<WalletRow[]>('/admin/wallets'),
      apiFetch<Demande[]>('/admin/wallets/demandes'),
    ]).then(([w, d]) => { setWallets(w); setDemandes(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reloadAll(); }, []);

  useEffect(() => {
    if (tab !== 'historique') return;
    const qs = txFilter ? `&structureId=${txFilter}` : '';
    apiFetch<TxPage>(`/admin/wallets/transactions?page=${txPage}&limit=20${qs}`)
      .then(setTxData).catch(console.error);
  }, [tab, txPage, txFilter]);

  // Valider la demande : d'abord accepter, puis compléter avec le montant
  const handleValidate = async () => {
    if (!validateTarget) return;
    setValidateError('');
    const m = parseInt(validateMontant, 10);
    if (!m || m <= 0) { setValidateError('Entrez un montant valide'); return; }
    setValidateLoading(true);
    try {
      // Passer directement à completee en créditant le montant via recharge
      await apiFetch(`/admin/wallets/${validateTarget.structure_id}/recharge`, {
        method: 'POST',
        body: JSON.stringify({ montant: m }),
      });
      // Marquer la demande completee
      await apiFetch(`/admin/wallets/demandes/${validateTarget.id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'completee' }),
      });
      setValidateTarget(null); setValidateMontant('');
      reloadAll();
    } catch (e) {
      setValidateError(e instanceof ApiException ? e.message : 'Erreur');
    } finally { setValidateLoading(false); }
  };

  const handleRefus = async () => {
    if (!refusTarget) return;
    try {
      await apiFetch(`/admin/wallets/demandes/${refusTarget.id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'refusee', motif: refusMotif }),
      });
      setRefusTarget(null); setRefusMotif('');
      reloadAll();
    } catch (e) { alert(e instanceof ApiException ? e.message : 'Erreur'); }
  };

  const handleRecharge = async () => {
    if (!rechargeTarget) return;
    setRechargeError('');
    const m = parseInt(rechargeMontant, 10);
    if (!m || m <= 0) { setRechargeError('Montant invalide'); return; }
    setRechargeLoading(true);
    try {
      await apiFetch(`/admin/wallets/${rechargeTarget.structure_id}/recharge`, {
        method: 'POST', body: JSON.stringify({ montant: m }),
      });
      setRechargeTarget(null); setRechargeMontant('');
      reloadAll();
    } catch (e) {
      setRechargeError(e instanceof ApiException ? e.message : 'Erreur');
    } finally { setRechargeLoading(false); }
  };

  const enAttente = demandes.filter(d => d.statut === 'en_attente');
  const traitees = demandes.filter(d => d.statut !== 'en_attente');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl">&larr;</Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Wallets</h1>
            <p className="text-sm text-gray-500">{enAttente.length} demande{enAttente.length !== 1 ? 's' : ''} en attente</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-5">
        {/* Onglets */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'demandes', label: `Demandes${enAttente.length ? ` (${enAttente.length})` : ''}` },
            { id: 'wallets', label: 'Soldes' },
            { id: 'historique', label: 'Historique' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${tab === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Demandes ────────────────────────────────────────────── */}
        {tab === 'demandes' && (
          <div className="space-y-4">
            {/* En attente */}
            {enAttente.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">À valider</h2>
                <div className="space-y-3">
                  {enAttente.map(d => (
                    <div key={d.id} className="bg-white border-2 border-yellow-200 rounded-xl p-5">
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Capture */}
                        {d.capture_url ? (
                          <button onClick={() => setCapturePreview(`${API_ORIGIN}${d.capture_url}`)} className="flex-shrink-0">
                            <img src={`${API_ORIGIN}${d.capture_url}`} alt="Capture dépôt"
                              className="w-20 h-20 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition-opacity" />
                            <p className="text-xs text-blue-600 text-center mt-1">Agrandir</p>
                          </button>
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-lg">{d.structure_nom}</p>
                          <p className="text-2xl font-bold text-green-600 mt-0.5">{fmt(Number(d.montant_demande))}</p>
                          {d.notes && <p className="text-sm text-gray-500 mt-1 italic">"{d.notes}"</p>}
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(d.created_at)}</p>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button onClick={() => { setValidateTarget(d); setValidateMontant(String(d.montant_demande)); setValidateError(''); }}
                            className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                            ✅ Valider & Créditer
                          </button>
                          <button onClick={() => { setRefusTarget(d); setRefusMotif(''); }}
                            className="bg-red-100 text-red-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors">
                            ❌ Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Traitées */}
            {traitees.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Traitées</h2>
                <div className="space-y-2">
                  {traitees.map(d => (
                    <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                      {d.capture_url && (
                        <button onClick={() => setCapturePreview(`${API_ORIGIN}${d.capture_url}`)}>
                          <img src={`${API_ORIGIN}${d.capture_url}`} alt="Capture"
                            className="w-12 h-12 object-cover rounded-lg border border-gray-100 hover:opacity-80" />
                        </button>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{d.structure_nom}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_STYLE[d.statut]}`}>{STATUT_LABELS[d.statut]}</span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium">{fmt(Number(d.montant_demande))}</p>
                        {d.motif_refus && <p className="text-xs text-red-500">{d.motif_refus}</p>}
                        <p className="text-xs text-gray-400">{fmtDate(d.updated_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {demandes.length === 0 && !loading && (
              <p className="text-gray-400 text-sm text-center py-8">Aucune demande pour le moment.</p>
            )}
          </div>
        )}

        {/* ── Tab Soldes ──────────────────────────────────────────────── */}
        {tab === 'wallets' && (
          <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm" style={{ minWidth: '500px' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Structure', 'Solde', 'Dernière mise à jour', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Chargement...</td></tr>
                ) : wallets.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{w.structure_nom}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmt(Number(w.solde))}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(w.updated_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setRechargeTarget(w); setRechargeMontant(''); setRechargeError(''); }}
                        className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700">
                        Recharger manuellement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab Historique ──────────────────────────────────────────── */}
        {tab === 'historique' && (
          <div className="space-y-4">
            <select value={txFilter} onChange={e => { setTxFilter(e.target.value); setTxPage(1); }}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white">
              <option value="">Toutes les structures</option>
              {wallets.map(w => <option key={w.structure_id} value={w.structure_id}>{w.structure_nom}</option>)}
            </select>
            <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Type', 'Montant', 'Avant', 'Après', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!txData ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Chargement...</td></tr>
                  ) : txData.items.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tx.type === 'debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {tx.type === 'recharge' ? 'Recharge' : tx.type === 'credit_demande' ? 'Crédit dépôt' : 'Paiement'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${tx.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.type === 'debit' ? '-' : '+'}{fmt(Number(tx.montant))}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmt(Number(tx.solde_avant))}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(Number(tx.solde_apres))}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Valider & Créditer ──────────────────────────────────── */}
      {validateTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setValidateTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Valider le rechargement</h3>
            <p className="text-sm text-gray-500">Structure : <strong>{validateTarget.structure_nom}</strong></p>
            {validateTarget.capture_url && (
              <img src={`${API_ORIGIN}${validateTarget.capture_url}`} alt="Capture dépôt"
                className="w-full h-48 object-cover rounded-xl border border-gray-200" />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant à créditer (FCFA)</label>
              <input type="number" min="1" value={validateMontant} onChange={e => setValidateMontant(e.target.value)}
                className="w-full border-2 border-green-400 rounded-xl px-4 py-3 text-xl font-bold text-green-700 focus:outline-none focus:border-green-600"
                placeholder="Ex: 10000" autoFocus />
              <p className="text-xs text-gray-400 mt-1">Montant demandé : {fmt(Number(validateTarget.montant_demande))}</p>
            </div>
            {validateError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{validateError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setValidateTarget(null)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button>
              <button onClick={handleValidate} disabled={validateLoading}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                {validateLoading ? 'Crédit en cours...' : '✅ Créditer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Refus ───────────────────────────────────────────────── */}
      {refusTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRefusTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Refuser la demande</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</label>
              <textarea value={refusMotif} onChange={e => setRefusMotif(e.target.value)} rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 resize-none"
                placeholder="Capture illisible, montant incorrect..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRefusTarget(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button>
              <button onClick={handleRefus} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-700">Confirmer le refus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Recharge manuelle ───────────────────────────────────── */}
      {rechargeTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRechargeTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Recharge — {rechargeTarget.structure_nom}</h3>
            <p className="text-sm text-gray-500">Solde actuel : <strong>{fmt(Number(rechargeTarget.solde))}</strong></p>
            <input type="number" min="1" value={rechargeMontant} onChange={e => setRechargeMontant(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-xl font-bold text-gray-700 focus:outline-none focus:border-gray-600"
              placeholder="Montant en FCFA" autoFocus />
            {rechargeError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{rechargeError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setRechargeTarget(null)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button>
              <button onClick={handleRecharge} disabled={rechargeLoading}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-700 disabled:opacity-50">
                {rechargeLoading ? 'Traitement...' : 'Confirmer la recharge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Aperçu capture plein écran ────────────────────────────────── */}
      {capturePreview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setCapturePreview(null)}>
          <img src={capturePreview} alt="Capture dépôt" className="max-w-full max-h-full object-contain rounded-xl" />
          <button onClick={() => setCapturePreview(null)} className="absolute top-4 right-4 bg-white rounded-full p-2 text-gray-700 hover:text-red-500">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
