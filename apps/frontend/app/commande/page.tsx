'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DailyDishCard } from '@/components/employee/DailyDishCard';
import { MenuCompletCard } from '@/components/employee/MenuCompletCard';
import { HeroCarousel } from '@/components/employee/HeroCarousel';
import { useCart } from '@/lib/CartContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

// ── IDs des sections pour le scroll ──────────────────────────────────────────
const SECTIONS = [
  { id: 'accueil',    label: 'Accueil'    },
  { id: 'plats',      label: 'Plats'      },
  { id: 'menus',      label: 'Menus'      },
  { id: 'signalement',label: 'Signalement'},
  { id: 'reglement',  label: 'Règlement'  },
];

export default function CommandePage() {
  const [plats, setPlats] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('accueil');
  const [walletSolde, setWalletSolde] = useState<number | null>(null);
  const { itemCount, total } = useCart();
  const { logout, user } = useAuth();
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<any[]>('/creneaux/plats-du-jour'),
      apiFetch<any[]>('/menus'),
    ]).then(([p, m]) => {
      setPlats(p || []);
      setMenus(m || []);
    }).catch(console.error)
      .finally(() => setLoading(false));

    // Charger le solde wallet (uniquement pour les structures, pas les employés)
    apiFetch<{ solde: number }>('/wallet')
      .then((w) => setWalletSolde(Number(w.solde)))
      .catch(() => setWalletSolde(null));
  }, []);

  // Scroll spy — highlight active section in the pill nav
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = (headerRef.current?.offsetHeight ?? 60) + 8;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header ref={headerRef} className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <img src="/logo.png" alt="RestoMoney" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/panier')}
              className="relative flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              <span className="hidden sm:inline">Panier</span>
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {itemCount}
                </span>
              )}
            </button>
            <button onClick={() => logout()} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1.5">
              Quitter
            </button>
          </div>
        </div>

        {/* ── Barre de navigation par sections ── */}
        <div className="border-t border-gray-100 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 px-4 py-2 min-w-max">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeSection === s.id
                    ? s.id === 'signalement'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : s.id === 'reglement'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 space-y-10 pt-6">

        {/* ── Section 1 : Accueil ────────────────────────────────────────── */}
        <section id="accueil" className="scroll-mt-28">
          <HeroCarousel />

          {/* Message de bienvenue */}
          <div className="mt-5 bg-white border border-gray-100 rounded-2xl px-5 py-4">
            <h1 className="text-lg font-bold text-gray-900">Bienvenue sur RestoMoney</h1>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Commandez vos repas avant le créneau souhaité. Nos plats sont préparés frais et livrés
              dans les meilleures conditions. Votre satisfaction est notre priorité.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-gray-500">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Carte Wallet — visible si solde disponible */}
          {walletSolde !== null && (
            <Link href="/wallet" className="mt-4 flex items-center justify-between bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl px-5 py-4 shadow-md shadow-green-200/50 hover:opacity-95 transition-opacity">
              <div>
                <p className="text-xs text-green-100 font-medium">Solde Wallet</p>
                <p className="text-2xl font-bold text-white mt-0.5">
                  {walletSolde.toLocaleString('fr-FR')} FCFA
                </p>
                <p className="text-xs text-green-200 mt-1">Payer · Demander un complément</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </Link>
          )}
        </section>

        {/* ── Section 2 : Plats du jour ─────────────────────────────────── */}
        <section id="plats" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Plats du jour</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Sélection quotidienne de plats frais
              </p>
            </div>
            {plats.length > 0 && (
              <span className="text-xs text-orange-600 font-semibold bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                {plats.length} disponible{plats.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-56 animate-pulse" />
              ))}
            </div>
          ) : plats.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium text-sm">Aucun plat disponible pour le moment</p>
              <p className="text-gray-400 text-xs mt-1">Consultez les menus complets ci-dessous</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plats.map((p) => <DailyDishCard key={p.id} plat={p} />)}
            </div>
          )}
        </section>

        {/* ── Section 3 : Menus complets ────────────────────────────────── */}
        <section id="menus" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Menus complets</h2>
              <p className="text-xs text-gray-400 mt-0.5">Disponibles toute la journée</p>
            </div>
            {menus.length > 0 && (
              <span className="text-xs text-blue-600 font-semibold bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                {menus.length} menu{menus.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />)}
            </div>
          ) : menus.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <p className="text-gray-400 text-sm">Aucun menu disponible actuellement.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {menus.map((m) => <MenuCompletCard key={m.id} menu={m} />)}
            </div>
          )}
        </section>

        {/* ── Section 4 : Signalement retard ───────────────────────────── */}
        <section id="signalement" className="scroll-mt-28">
          <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Signaler un retard</h2>
                <p className="text-sm text-violet-200 mt-1 leading-relaxed">
                  Votre livraison est en retard ? Prenez une photo de la remise du repas.
                  Le système calcule le retard et applique automatiquement la sanction correspondante.
                </p>
              </div>
            </div>
            <Link
              href="/historique"
              className="mt-5 flex items-center justify-center gap-2 bg-white text-violet-700 font-semibold py-3 rounded-xl text-sm hover:bg-violet-50 transition-colors w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Voir mes commandes pour signaler
            </Link>
          </div>
        </section>

        {/* ── Section 5 : Règlement retards ────────────────────────────── */}
        <section id="reglement" className="scroll-mt-28 pb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Règlement — Retards de livraison</h2>
                <p className="text-sm text-blue-200 mt-1 leading-relaxed">
                  Consultez notre politique de gestion des retards, le barème des sanctions progressives
                  et les conditions d'émission de bons de réduction.
                </p>
              </div>
            </div>
            <Link
              href="/reglement"
              className="mt-5 flex items-center justify-center gap-2 bg-white text-blue-700 font-semibold py-3 rounded-xl text-sm hover:bg-blue-50 transition-colors w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Lire le règlement complet
            </Link>
          </div>
        </section>
      </main>

      {/* ── Barre panier flottante mobile ─────────────────────────────── */}
      {itemCount > 0 && (
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <button
            onClick={() => router.push('/panier')}
            className="w-full bg-orange-500 text-white rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-xl shadow-orange-200/60 active:scale-[0.98] transition-transform"
          >
            <span className="bg-orange-400 text-white text-xs font-bold rounded-xl w-7 h-7 flex items-center justify-center">
              {itemCount}
            </span>
            <span className="font-semibold text-base">Voir le panier</span>
            <span className="font-bold text-base">{total.toLocaleString('fr-FR')} F</span>
          </button>
        </div>
      )}
    </div>
  );
}
