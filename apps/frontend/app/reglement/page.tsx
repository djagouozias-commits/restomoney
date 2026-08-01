'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ParametreSanction {
  niveau: number; min_minutes: number; max_minutes: number | null;
  reduction_pct: number; emettre_bon: boolean;
}

function formatDelai(min: number, max: number | null): string {
  if (max === null) return `Plus de ${min} minutes`;
  if (min === 0) return `Moins de ${max} minutes`;
  return `Entre ${min} et ${max} minutes`;
}

function Article({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {num}
        </div>
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-6 py-5 text-sm text-gray-700 space-y-3">{children}</div>
    </div>
  );
}

export default function ReglementPage() {
  const router = useRouter();
  const [parametres, setParametres] = useState<ParametreSanction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ParametreSanction[]>('/admin/sanctions/parametres')
      .then(setParametres).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900">Règlement général du service</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-10 space-y-4">

        {/* En-tête officiel */}
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-6">
          <img src="/logo.png" alt="RestoMoney" className="h-8 w-auto object-contain mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Conditions générales d'utilisation du service RestoMoney
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            En souscrivant au service RestoMoney, la structure cliente accepte sans réserve les présentes conditions.
            Ce règlement régit les obligations mutuelles de RestoMoney et de ses structures partenaires.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-xs text-gray-400">Document en vigueur — mis à jour régulièrement</p>
          </div>
        </div>

        {/* Article 1 — Retards de livraison */}
        <Article num="01" title="Retards de livraison">
          <p className="leading-relaxed">
            RestoMoney s'engage à livrer les commandes dans les délais du créneau horaire sélectionné.
            Tout retard est mesuré automatiquement à partir de l'heure officielle du créneau, sur la base
            de la photo horodatée prise au moment de la remise du repas.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Procédure de signalement</p>
            <ol className="space-y-2 text-gray-600">
              <li className="flex gap-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">1.</span>
                <span>Ouvrir la commande concernée dans la section <strong className="text-gray-800">Historique</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">2.</span>
                <span>Sélectionner <strong className="text-gray-800">Signaler un retard</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">3.</span>
                <span>Prendre la photo de remise du repas — l'horodatage est enregistré automatiquement</span>
              </li>
              <li className="flex gap-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">4.</span>
                <span>La sanction applicable est calculée et appliquée en temps réel selon le barème ci-dessous</span>
              </li>
            </ol>
          </div>
        </Article>

        {/* Barème sanctions */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              —
            </div>
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Barème des pénalités de retard</h3>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-gray-400 text-sm text-center">Chargement...</p>
          ) : parametres.length === 0 ? (
            <p className="px-6 py-6 text-gray-400 text-sm text-center">Barème non configuré.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {parametres.map(p => (
                <div key={p.niveau} className="px-6 py-4 flex items-center gap-4">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    p.niveau === 1 ? 'bg-yellow-100 text-yellow-700' :
                    p.niveau === 2 ? 'bg-orange-100 text-orange-700' :
                    p.niveau === 3 ? 'bg-red-100 text-red-700' : 'bg-red-200 text-red-900'
                  }`}>N{p.niveau}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-medium text-gray-900">{formatDelai(p.min_minutes, p.max_minutes)}</p>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        p.reduction_pct >= 50 ? 'bg-red-50 border-red-200 text-red-700' :
                        p.reduction_pct >= 25 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}>
                        Réduction de {p.reduction_pct}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {p.emettre_bon ? 'Bon de réduction émis sur la prochaine commande.' : 'Réduction appliquée directement sur le montant de la commande.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Article 2 — Présence lors de la livraison */}
        <Article num="02" title="Présence lors de la livraison">
          <p className="leading-relaxed">
            Le livreur RestoMoney attend au maximum <strong>15 minutes</strong> à l'adresse de livraison après son arrivée.
            Passé ce délai, la tentative de livraison est consignée et le repas peut être redirigé ou annulé
            aux frais de la structure.
          </p>
          <div className="border-l-4 border-gray-900 pl-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Obligations de la structure</p>
            <ul className="space-y-1.5 text-gray-600">
              <li>— Désigner un responsable disponible à l'adresse de livraison lors du créneau commandé</li>
              <li>— Informer RestoMoney de tout empêchement <strong>au moins 30 minutes</strong> avant le créneau</li>
              <li>— Toute livraison tentée non réceptionnée reste intégralement due</li>
              <li>— En cas de trois absences non signalées, RestoMoney se réserve le droit de suspendre le service</li>
            </ul>
          </div>
        </Article>

        {/* Article 3 — Paiement et wallet */}
        <Article num="03" title="Paiement — Wallet RestoMoney">
          <p className="leading-relaxed">
            Le service fonctionne sur la base d'un <strong>wallet prépayé en FCFA</strong>.
            Chaque commande validée est débitée du solde disponible. Aucune commande ne peut être passée
            si le solde est insuffisant pour couvrir le montant total.
          </p>
          <div className="border-l-4 border-gray-900 pl-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Règles de paiement</p>
            <ul className="space-y-1.5 text-gray-600">
              <li>— Solde insuffisant : la commande est automatiquement bloquée</li>
              <li>— Les demandes de rechargement sont traitées sous <strong>8 heures maximum</strong> après réception de la preuve de dépôt</li>
              <li>— Le débit est immédiat et irrévocable dès la validation de la commande</li>
              <li>— Les numéros de dépôt autorisés : Moov <strong>0168204654</strong> — MTN <strong>0154824064</strong></li>
            </ul>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Cas de non-paiement</p>
            <ul className="space-y-1.5 text-red-700">
              <li>— Toute commande livrée sans solde suffisant constitue une dette immédiatement exigible</li>
              <li>— Un délai de régularisation de <strong>48 heures</strong> est accordé. Passé ce délai, les nouvelles commandes sont suspendues</li>
              <li>— En cas de non-régularisation persistante, RestoMoney peut résilier le contrat et appliquer des pénalités de recouvrement</li>
              <li>— Toute capture de dépôt frauduleuse entraîne la suspension immédiate et définitive du compte sans remboursement</li>
            </ul>
          </div>
        </Article>

        {/* Article 4 — Annulations */}
        <Article num="04" title="Annulations et modifications">
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wide">Délai avant créneau</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wide">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                <tr>
                  <td className="px-4 py-3 font-medium">Plus de 60 minutes</td>
                  <td className="px-4 py-3 text-green-700 font-medium">Annulation sans frais</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Entre 30 et 60 minutes</td>
                  <td className="px-4 py-3 text-orange-700 font-medium">25% du montant retenu</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Moins de 30 minutes</td>
                  <td className="px-4 py-3 text-red-700 font-medium">100% du montant dû</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">En cours de préparation</td>
                  <td className="px-4 py-3 text-red-700 font-medium">Non annulable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Article>

        {/* Article 5 — Bons de réduction */}
        <Article num="05" title="Bons de réduction">
          <p className="leading-relaxed">
            Les bons de réduction émis à la suite d'un signalement de retard valide sont valables
            <strong> 30 jours</strong> à compter de leur date d'émission. Ils s'appliquent automatiquement
            sur la prochaine commande. Un seul bon est utilisable par commande. Les bons ne sont ni
            remboursables ni cessibles à un tiers.
          </p>
        </Article>

        {/* Article 6 — Responsabilités et litiges */}
        <Article num="06" title="Responsabilités et litiges">
          <p className="leading-relaxed">
            RestoMoney s'engage à traiter tout litige dans un délai de <strong>72 heures ouvrables</strong>
            par voie de messagerie. En cas de désaccord persistant, les parties conviennent de recourir
            à une médiation amiable avant toute action judiciaire.
          </p>
        </Article>

        {/* Pied de page légal */}
        <p className="text-center text-xs text-gray-400 pt-2">
          Ce règlement est susceptible d'évoluer. La version en vigueur est celle affichée dans l'application.
          <br />RestoMoney — Tous droits réservés.
        </p>
      </main>
    </div>
  );
}
