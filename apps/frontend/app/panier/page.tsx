'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiException } from '@/lib/api';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { CartSidebar } from '@/components/employee/CartSidebar';
import { SlotSelector } from '@/components/employee/SlotSelector';

interface Creneau { label: string; time: string; disponible: boolean; lendemain?: boolean; }
interface WalletInfo { solde: number; }

type ModePaiement = 'especes' | 'wallet';

export default function PanierPage() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [modePaiement, setModePaiement] = useState<ModePaiement>('especes');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const isEmploye = user?.role === 'employe';

  useEffect(() => {
    apiFetch<Creneau[]>('/creneaux').then(setCreneaux).catch(console.error);
    // Charger le solde wallet pour info
    apiFetch<WalletInfo>('/wallet')
      .then(setWalletInfo)
      .catch(() => setWalletInfo(null));
  }, []);

  const soldeInsuffisant = modePaiement === 'wallet' &&
    walletInfo !== null &&
    Number(walletInfo.solde) < total;

  const handleValider = async () => {
    if (!selected) { setError('Veuillez sélectionner un créneau.'); return; }
    if (items.length === 0) { setError('Votre panier est vide.'); return; }
    if (modePaiement === 'wallet' && !password) { setError('Entrez votre mot de passe pour confirmer le paiement par wallet.'); return; }
    if (soldeInsuffisant) { setError('Solde insuffisant. Rechargez votre wallet ou choisissez le paiement en espèces.'); return; }

    setLoading(true);
    setError('');
    try {
      const payload: any = {
        creneau: selected,
        mode_paiement: modePaiement,
        lignes: items.map((item) => ({
          type: item.type,
          ...(item.type === 'plat' ? { plat_id: item.id } : { menu_complet_id: item.id }),
          quantite: item.quantite,
          jetable: item.jetable ?? false,
          variante_id: item.variante_id,
          selections_options: item.selections_options?.map((s) => ({
            composant_id: s.composant_id,
            option_id: s.option_id,
          })) || [],
        })),
      };
      if (modePaiement === 'wallet') {
        payload.password = password;
      }

      const commande = await apiFetch<{ id: string }>('/commandes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      clearCart();
      router.push(`/confirmation/${commande.id}`);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'CRENEAU_NOT_AVAILABLE') setError('Ce créneau n\'est plus disponible.');
      else if (code === 'MENU_OPTION_REQUIRED') setError('Une option est manquante pour un menu.');
      else if (code === 'PLAT_INACTIVE') setError('Un article n\'est plus disponible.');
      else if (code === 'WALLET_INSUFFICIENT_FUNDS') setError('Solde wallet insuffisant pour cette commande.');
      else if (code === 'AUTH_INVALID_CREDENTIALS') setError('Mot de passe incorrect.');
      else setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 pb-10">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Votre panier</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <CartSidebar />

        <SlotSelector creneaux={creneaux} selected={selected} onChange={setSelected} />

        {/* ── Choix du mode de paiement ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Mode de paiement</h2>

          {/* Option espèces */}
          <button
            onClick={() => setModePaiement('especes')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              modePaiement === 'especes'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              modePaiement === 'especes' ? 'border-orange-500' : 'border-gray-300'
            }`}>
              {modePaiement === 'especes' && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Paiement à la livraison</p>
              <p className="text-xs text-gray-500 mt-0.5">Vous réglez en espèces au livreur</p>
            </div>
            <div className="ml-auto">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
          </button>

          {/* Option wallet */}
          <button
            onClick={() => setModePaiement('wallet')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              modePaiement === 'wallet'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              modePaiement === 'wallet' ? 'border-green-500' : 'border-gray-300'
            }`}>
              {modePaiement === 'wallet' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Payer depuis mon wallet</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {walletInfo !== null
                  ? `Solde disponible : ${Number(walletInfo.solde).toLocaleString('fr-FR')} FCFA`
                  : 'Débit automatique de votre solde RestoMoney'
                }
              </p>
            </div>
            <div className="ml-auto">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </button>

          {/* Avertissement solde insuffisant */}
          {soldeInsuffisant && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              Solde insuffisant ({Number(walletInfo!.solde).toLocaleString('fr-FR')} FCFA) pour couvrir {total.toLocaleString('fr-FR')} FCFA.
              Rechargez votre wallet ou choisissez le paiement en espèces.
            </div>
          )}

          {/* Confirmation MDP si wallet */}
          {modePaiement === 'wallet' && !soldeInsuffisant && (
            <div className="pt-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isEmploye
                  ? 'Confirmez avec votre mot de passe employé'
                  : 'Confirmez avec votre mot de passe'}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
                placeholder={isEmploye ? 'Votre mot de passe employé' : 'Votre mot de passe'}
                autoComplete="current-password"
              />
              {isEmploye && (
                <p className="text-xs text-gray-400 mt-1">
                  Utilisez le mot de passe avec lequel vous vous êtes connecté.
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        {/* Récap montant */}
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">Total à {modePaiement === 'wallet' ? 'débiter' : 'payer'}</p>
          <p className="text-xl font-bold text-gray-900">{total.toLocaleString('fr-FR')} FCFA</p>
        </div>

        <button
          onClick={handleValider}
          disabled={loading || items.length === 0 || !selected || soldeInsuffisant}
          className={`w-full font-bold py-4 rounded-2xl text-base transition-colors disabled:opacity-40 ${
            modePaiement === 'wallet'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {loading
            ? 'Validation en cours...'
            : modePaiement === 'wallet'
            ? `Payer ${total.toLocaleString('fr-FR')} FCFA depuis mon wallet`
            : `Commander — Payer ${total.toLocaleString('fr-FR')} FCFA à la livraison`
          }
        </button>
      </main>
    </div>
  );
}
