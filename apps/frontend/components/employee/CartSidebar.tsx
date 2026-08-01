'use client';

import { useCart } from '@/lib/CartContext';

// Simple icons inline pour éviter la dépendance lucide-react
const ShoppingBagIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export function CartSidebar() {
  const { items, total, removeItem, setQuantity, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
        <ShoppingBagIcon />
        <p className="text-gray-500 text-sm">Votre panier est vide</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">
          Panier <span className="text-orange-500">({itemCount})</span>
        </h2>
      </div>

      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800 text-sm truncate flex-1">{item.nom}</p>
                {/* Croix suppression — visible et accessible */}
                <button
                  onClick={() => removeItem(item.key)}
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Supprimer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {item.variante_libelle && (
                <p className="text-xs text-gray-400 mt-0.5">{item.variante_libelle}</p>
              )}
              {item.selections_options && item.selections_options.length > 0 && (
                <p className="text-xs text-gray-400 truncate">
                  {item.selections_options.map((s) => s.option_nom).join(', ')}
                </p>
              )}
              {item.jetable && (
                <span className="text-xs text-green-600">+ Couverts jetables</span>
              )}
              <p className="text-orange-600 text-sm font-semibold mt-0.5">
                {(item.prix * item.quantite).toLocaleString('fr-FR')} FCFA
              </p>
            </div>

            {/* Contrôle quantité */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setQuantity(item.key, item.quantite - 1)}
                className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500 text-sm flex items-center justify-center"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium">{item.quantite}</span>
              <button
                onClick={() => setQuantity(item.key, item.quantite + 1)}
                className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500 text-sm flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 bg-orange-50">
        <div className="flex justify-between font-bold text-gray-800">
          <span>Total</span>
          <span className="text-orange-600">{total.toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
    </div>
  );
}
