'use client';

import { useState } from 'react';
import { useCart } from '@/lib/CartContext';

const API = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface Variante { id: string; libelle: string; prix: number; }
interface Plat {
  id: string; nom: string; description?: string; prix: number;
  image_url?: string; avec_jetable?: boolean; variantes?: Variante[];
}

export function DailyDishCard({ plat }: { plat: Plat }) {
  const { addItem } = useCart();
  const [showModal, setShowModal] = useState(false);
  const [selectedVariante, setSelectedVariante] = useState<Variante | null>(null);
  const [added, setAdded] = useState(false);

  const isMultiVariante = (plat.variantes?.length ?? 0) > 1;
  const imgSrc = plat.image_url ? `${API}${plat.image_url}` : null;
  const prixAffiche = selectedVariante?.prix ?? plat.variantes?.[0]?.prix ?? plat.prix;

  const doAdd = (jetable: boolean) => {
    const v = selectedVariante ?? plat.variantes?.[0];
    addItem({
      key: `${plat.id}_${v?.id ?? 'default'}_${jetable ? 'j' : 'n'}`,
      type: 'plat', id: plat.id, nom: plat.nom,
      prix: v?.prix ?? plat.prix,
      image_url: plat.image_url, quantite: 1,
      jetable, variante_id: v?.id, variante_libelle: v?.libelle,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const handleAdd = () => {
    if (isMultiVariante && !selectedVariante) return;
    if (plat.avec_jetable) { setShowModal(true); } else { doAdd(false); }
  };

  return (
    <div className="group relative bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        {imgSrc ? (
          <img src={imgSrc} alt={plat.nom}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
            <span className="text-5xl">🍽️</span>
          </div>
        )}
        {/* Badge "Aujourd'hui" */}
        <div className="absolute top-3 left-3">
          <span className="bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide uppercase">
            Plat du jour
          </span>
        </div>
        {/* Overlay dégradé bas */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Prix en surimpression */}
        <div className="absolute bottom-3 right-3">
          <span className="bg-white/95 text-orange-600 font-bold text-sm px-3 py-1 rounded-full shadow-sm">
            {prixAffiche.toLocaleString('fr-FR')} F
          </span>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">{plat.nom}</h3>
          {plat.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">{plat.description}</p>
          )}
        </div>

        {/* Variantes */}
        {isMultiVariante && (
          <div className="flex flex-wrap gap-1.5">
            {plat.variantes!.map(v => (
              <button key={v.id} onClick={() => setSelectedVariante(v)}
                className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                  selectedVariante?.id === v.id
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                }`}>
                {v.libelle} — {v.prix.toLocaleString('fr-FR')} F
              </button>
            ))}
          </div>
        )}

        {/* Bouton ajouter */}
        <button onClick={handleAdd}
          disabled={isMultiVariante && !selectedVariante}
          className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            added
              ? 'bg-green-500 text-white scale-95'
              : 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-lg hover:shadow-orange-200 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}>
          {added ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Ajouté !
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Ajouter au panier
            </>
          )}
        </button>
      </div>

      {/* Modal couverts jetables */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm shadow-2xl"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <p className="text-xs text-gray-400 text-center mb-1 uppercase tracking-wide">{plat.nom}</p>
            <h4 className="text-base font-bold text-gray-900 text-center mb-5">Couverts jetables ?</h4>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowModal(false); doAdd(true); }}
                className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-orange-600 transition-colors">
                Oui, avec couverts jetables
              </button>
              <button onClick={() => { setShowModal(false); doAdd(false); }}
                className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                Non merci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
