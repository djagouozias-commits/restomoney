'use client';

import { useState } from 'react';
import { useCart, SelectionOption } from '@/lib/CartContext';

const API = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface Option { id: string; nom: string; position: number; }
interface Composant { id: string; nom: string; a_choix: boolean; position: number; options: Option[]; }
interface Menu {
  id: string; nom: string; description?: string; prix: number;
  image_url?: string; composants: Composant[];
}

export function MenuCompletCard({ menu }: { menu: Menu }) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const imgSrc = menu.image_url ? `${API}${menu.image_url}` : null;
  const composantsAChoix = menu.composants.filter(c => c.a_choix);
  const allSelected = composantsAChoix.every(c => selections[c.id]);
  const progression = composantsAChoix.length > 0
    ? Math.round((Object.keys(selections).length / composantsAChoix.length) * 100)
    : 100;

  const handleAdd = () => {
    if (!allSelected && composantsAChoix.length > 0) return;
    const sels: SelectionOption[] = composantsAChoix.map(c => {
      const opt = c.options.find(o => o.id === selections[c.id])!;
      return { composant_id: c.id, option_id: selections[c.id], composant_nom: c.nom, option_nom: opt?.nom };
    });
    addItem({ key: `${menu.id}-${JSON.stringify(selections)}`, type: 'menu', id: menu.id, nom: menu.nom, prix: menu.prix, image_url: menu.image_url, quantite: 1, selections_options: sels });
    setOpen(false);
    setSelections({});
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <>
      <div className="group relative bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        {/* Image */}
        <div className="relative overflow-hidden" style={{ height: 200 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={menu.nom}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center">
              <span className="text-5xl">🥗</span>
            </div>
          )}
          {/* Badge */}
          <div className="absolute top-3 left-3">
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide uppercase">
              Menu complet
            </span>
          </div>
          {/* Composants count */}
          {menu.composants.length > 0 && (
            <div className="absolute top-3 right-3">
              <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                {menu.composants.length} éléments
              </span>
            </div>
          )}
          {/* Overlay + prix */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 right-3">
            <span className="bg-white/95 text-amber-600 font-bold text-sm px-3 py-1 rounded-full shadow-sm">
              {menu.prix.toLocaleString('fr-FR')} F
            </span>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">{menu.nom}</h3>
            {menu.description && (
              <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">{menu.description}</p>
            )}
          </div>

          {/* Composants aperçu */}
          {menu.composants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {menu.composants.slice(0, 3).map(c => (
                <span key={c.id} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                  {c.nom}
                </span>
              ))}
              {menu.composants.length > 3 && (
                <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  +{menu.composants.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Bouton */}
          <button
            onClick={() => composantsAChoix.length > 0 ? setOpen(true) : handleAdd()}
            className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
              added
                ? 'bg-green-500 text-white scale-95'
                : 'bg-amber-500 hover:bg-amber-600 text-white hover:shadow-lg hover:shadow-amber-200'
            }`}>
            {added ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Ajouté !
              </>
            ) : composantsAChoix.length > 0 ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Personnaliser &amp; Commander
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
      </div>

      {/* Modal personnalisation */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Handle mobile */}
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

            {/* Header */}
            <div className="px-6 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{menu.nom}</h2>
                  <p className="text-amber-600 font-bold text-base mt-0.5">{menu.prix.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 mt-1">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Barre de progression */}
              {composantsAChoix.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>Sélection des options</span>
                    <span className="font-semibold text-amber-600">{Object.keys(selections).length}/{composantsAChoix.length}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${progression}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {menu.composants.map(comp => (
                <div key={comp.id}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className="font-semibold text-gray-800 text-sm">{comp.nom}</p>
                    {comp.a_choix && (
                      <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                        Requis
                      </span>
                    )}
                    {!comp.a_choix && (
                      <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1.5 py-0.5 rounded-full font-semibold">
                        Inclus
                      </span>
                    )}
                  </div>
                  {comp.a_choix ? (
                    <div className="flex flex-wrap gap-2">
                      {comp.options.map(opt => (
                        <button key={opt.id}
                          onClick={() => setSelections(s => ({ ...s, [comp.id]: opt.id }))}
                          className={`px-3.5 py-2 rounded-xl text-sm border-2 font-medium transition-all ${
                            selections[comp.id] === opt.id
                              ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                              : 'border-gray-200 text-gray-700 hover:border-amber-300 bg-white'
                          }`}>
                          {opt.nom}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">{comp.options.map(o => o.nom).join(', ') || comp.nom}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={handleAdd} disabled={!allSelected && composantsAChoix.length > 0}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 transition-colors shadow-md shadow-amber-200/50">
                {allSelected || composantsAChoix.length === 0
                  ? `Ajouter au panier — ${menu.prix.toLocaleString('fr-FR')} FCFA`
                  : `Choisissez encore ${composantsAChoix.length - Object.keys(selections).length} option(s)`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
