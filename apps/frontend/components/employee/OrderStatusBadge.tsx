'use client';

import { useSSE } from '@/lib/useSSE';
import { useEffect, useState } from 'react';

type Statut = 'en_attente' | 'en_preparation' | 'en_livraison' | 'livre' | 'en_retard';

const STATUT_CONFIG: Record<Statut, { label: string; color: string }> = {
  en_attente:     { label: 'En attente',     color: 'bg-gray-100 text-gray-600' },
  en_preparation: { label: 'En préparation', color: 'bg-blue-100 text-blue-700' },
  en_livraison:   { label: 'En livraison',   color: 'bg-amber-100 text-amber-700' },
  livre:          { label: 'Livré ✓',        color: 'bg-green-100 text-green-700' },
  en_retard:      { label: 'En retard ⚠',    color: 'bg-red-100 text-red-700' },
};

interface OrderStatusBadgeProps {
  commandeId: string;
  initialStatut: Statut;
}

export function OrderStatusBadge({ commandeId, initialStatut }: OrderStatusBadgeProps) {
  const [statut, setStatut] = useState<Statut>(initialStatut);
  const { lastEvent } = useSSE<{ id: string; statut: Statut }>('statut_commande');

  useEffect(() => {
    if (lastEvent?.id === commandeId && lastEvent?.statut) {
      setStatut(lastEvent.statut);
    }
  }, [lastEvent, commandeId]);

  const config = STATUT_CONFIG[statut] || STATUT_CONFIG.en_attente;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
