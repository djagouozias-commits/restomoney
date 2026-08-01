'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/CartContext';

const NAV_ITEMS = [
  {
    href: '/commande',
    label: 'Menu',
    color: 'orange',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill={active ? '#f97316' : 'none'} stroke="currentColor"
        strokeWidth={active ? 0 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    ),
  },
  {
    href: '/panier',
    label: 'Panier',
    badge: true,
    color: 'orange',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
  },
  {
    href: '/historique',
    label: 'Commandes',
    color: 'orange',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/reglement',
    label: 'Règlement',
    color: 'blue',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/profil',
    label: 'Profil',
    color: 'orange',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const COLOR_MAP: Record<string, { active: string; indicator: string; text: string }> = {
  orange: { active: 'text-orange-500', indicator: 'bg-orange-500', text: 'text-orange-500' },
  blue:   { active: 'text-blue-600',   indicator: 'bg-blue-600',   text: 'text-blue-600'   },
  violet: { active: 'text-violet-600', indicator: 'bg-violet-600', text: 'text-violet-600' },
};

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();

  // Afficher uniquement sur les pages employé
  const EMPLOYEE_PATHS = ['/commande', '/panier', '/historique', '/profil', '/confirmation', '/membres', '/reglement', '/commandes'];
  const isEmployeePage = EMPLOYEE_PATHS.some((p) => pathname?.startsWith(p));
  if (!isEmployeePage) return null;

  return (
    <>
      {/* Spacer */}
      <div className="h-[68px]" aria-hidden="true" />

      {/* Barre de navigation fixe en bas */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-[58px]">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/commande' && pathname?.startsWith(item.href));
            const colors = COLOR_MAP[item.color] ?? COLOR_MAP.orange;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  isActive ? colors.active : 'text-gray-400 active:text-gray-600'
                }`}
              >
                {/* Indicateur top */}
                {isActive && (
                  <span
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full ${colors.indicator}`}
                  />
                )}

                {/* Icône avec badge */}
                <span className="relative">
                  {item.icon(isActive)}
                  {item.badge && itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </span>

                {/* Label */}
                <span className={`text-[9px] font-semibold leading-none ${isActive ? colors.text : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
