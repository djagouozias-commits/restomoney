'use client';

const BRAND_PROMISE = 'Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans.';

interface LigneCommande {
  id: string;
  type: 'plat' | 'menu';
  plat_nom?: string;
  menu_nom?: string;
  quantite: number;
  prix_unitaire: number;
  jetable?: boolean;
  selections_options?: Array<{ composant_nom: string; option_nom: string }>;
}

interface Commande {
  id: string;
  structure_id: string;
  creneau: string;
  date_commande: string;
  statut: string;
  penalite: boolean;
  montant_total: number;
  montant_final?: number;
  lignes?: LigneCommande[];
}

interface OrderReceiptProps {
  commande: Commande;
  structureNom?: string;
}

export function OrderReceipt({ commande, structureNom }: OrderReceiptProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {/* En-tête */}
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Confirmation de commande</h2>
        <p className="text-xs text-gray-400 mt-1">
          Réf. <span className="font-mono">{commande.id.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Date</p>
          <p className="font-medium">{new Date(commande.date_commande).toLocaleDateString('fr-FR')}</p>
        </div>
        <div>
          <p className="text-gray-500">Créneau</p>
          <p className="font-medium">{commande.creneau}</p>
        </div>
        {structureNom && (
          <div className="col-span-2">
            <p className="text-gray-500">Structure</p>
            <p className="font-medium">{structureNom}</p>
          </div>
        )}
      </div>

      {/* Lignes */}
      {commande.lignes && commande.lignes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Articles</h3>
          {commande.lignes.map((ligne) => (
            <div key={ligne.id} className="flex justify-between text-sm">
              <div>
                <p className="font-medium">{ligne.plat_nom || ligne.menu_nom}</p>
                {ligne.selections_options?.map((s, i) => (
                  <p key={i} className="text-xs text-gray-400">{s.composant_nom}: {s.option_nom}</p>
                ))}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-gray-400">× {ligne.quantite}</p>
                  {ligne.jetable === true && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">
                      🍽️ Couvert jetable
                    </span>
                  )}
                  {ligne.jetable === false && (
                    <span className="text-xs bg-gray-100 text-gray-500 font-medium px-1.5 py-0.5 rounded-full">
                      Sans couvert
                    </span>
                  )}
                </div>
              </div>
              <p className="font-medium text-gray-700">
                {(ligne.prix_unitaire * ligne.quantite).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Montant */}
      <div className="border-t pt-4 space-y-1">
        {commande.penalite && commande.montant_final != null ? (
          <>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total</span>
              <span className="line-through">{commande.montant_total.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Pénalité retard (−50 %)</span>
              <span>−{(commande.montant_total * 0.5).toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total à payer</span>
              <span className="text-red-600">{commande.montant_final.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-orange-600">{commande.montant_total.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}
      </div>

      {/* Promesse de marque */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
        <p className="text-orange-700 text-sm font-medium italic">"{BRAND_PROMISE}"</p>
      </div>
    </div>
  );
}
