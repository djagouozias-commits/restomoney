'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface SelectionOption {
  composant_id: string;
  option_id: string;
  composant_nom?: string;
  option_nom?: string;
}

export interface CartItem {
  key: string; // unique key = id + '_' + (jetable ? 'jetable' : 'normal') + JSON.stringify(selections)
  type: 'plat' | 'menu';
  id: string;
  nom: string;
  prix: number;
  image_url?: string;
  quantite: number;
  selections_options?: SelectionOption[];
  jetable?: boolean;
  variante_id?: string;
  variante_libelle?: string;
}

interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; key: string }
  | { type: 'SET_QTY'; key: string; quantite: number }
  | { type: 'CLEAR' };

function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.prix * i.quantite, 0);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.key === action.item.key);
      let items: CartItem[];
      if (existing) {
        items = state.items.map((i) =>
          i.key === action.item.key ? { ...i, quantite: i.quantite + action.item.quantite } : i,
        );
      } else {
        items = [...state.items, action.item];
      }
      return { items, total: calcTotal(items) };
    }
    case 'REMOVE': {
      const items = state.items.filter((i) => i.key !== action.key);
      return { items, total: calcTotal(items) };
    }
    case 'SET_QTY': {
      const items = action.quantite <= 0
        ? state.items.filter((i) => i.key !== action.key)
        : state.items.map((i) => i.key === action.key ? { ...i, quantite: action.quantite } : i);
      return { items, total: calcTotal(items) };
    }
    case 'CLEAR':
      return { items: [], total: 0 };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantite: number) => void;
  clearCart: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });

  return (
    <CartContext.Provider value={{
      items: state.items,
      total: state.total,
      addItem: (item) => dispatch({ type: 'ADD', item }),
      removeItem: (key) => dispatch({ type: 'REMOVE', key }),
      setQuantity: (key, quantite) => dispatch({ type: 'SET_QTY', key, quantite }),
      clearCart: () => dispatch({ type: 'CLEAR' }),
      itemCount: state.items.reduce((s, i) => s + i.quantite, 0),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
