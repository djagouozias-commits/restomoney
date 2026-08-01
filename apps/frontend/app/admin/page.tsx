'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, retards: 0, rotationOk: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      apiFetch<any[]>(`/admin/commandes?date=${today}`),
      apiFetch<any[]>('/admin/commandes/retards'),
      apiFetch<any[]>('/admin/rotation-logs'),
    ]).then(([commandes, retards, logs]) => {
      const lastLog = logs?.[0];
      setStats({
        total: commandes?.length || 0,
        retards: retards?.length || 0,
        rotationOk: !lastLog || lastLog.statut === 'succes',
      });
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const navLinks = [
    { href: '/admin/structures',    label: 'Structures'       },
    { href: '/admin/plats',         label: 'Plats'            },
    { href: '/admin/planning',      label: 'Planning'         },
    { href: '/admin/menus',         label: 'Menus'            },
    { href: '/admin/commandes',     label: 'Commandes'        },
    { href: '/admin/recap',         label: 'Recap'            },
    { href: '/admin/retards',       label: 'Retards'          },
    { href: '/admin/sanctions',     label: 'Sanctions'        },
    { href: '/admin/signalements',  label: 'Signalements'     },
    { href: '/admin/tournees',      label: 'Tournees'         },
    { href: '/admin/rotation-log',  label: 'Rotation'         },
    { href: '/admin/livreurs',      label: 'Livreurs'         },
    { href: '/admin/missions',      label: 'Missions'         },
    { href: '/admin/gps',           label: 'GPS livreurs'     },
    { href: '/admin/carousel',      label: 'Carousel images'  },
    { href: '/admin/wallets',       label: 'Wallets'          },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <img src="/logo.png" alt="RestoMoney" className="h-10 w-auto object-contain" />
            <p className="text-base text-gray-500 mt-0.5">Administration</p>
          </div>
          <Link href="/admin/login" className="text-base text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg">
            Deconnexion
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {!stats.rotationOk && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-5 py-4 text-base">
            La derniere rotation automatique a echoue.{' '}
            <Link href="/admin/rotation-log" className="underline font-medium">Voir le journal</Link>
          </div>
        )}

        {/* KPIs */}
        <section>
          <h2 className="text-lg font-medium text-gray-700 mb-4">Aujourd'hui</h2>
          {loading ? (
            <p className="text-base text-gray-400">Chargement...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/admin/commandes" className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition">
                <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-base text-gray-500 mt-2">Commandes du jour</p>
              </Link>
              <Link href="/admin/retards" className={`border rounded-xl p-6 hover:border-gray-300 transition ${stats.retards > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <p className={`text-4xl font-bold ${stats.retards > 0 ? 'text-red-700' : 'text-gray-900'}`}>{stats.retards}</p>
                <p className={`text-base mt-2 ${stats.retards > 0 ? 'text-red-600' : 'text-gray-500'}`}>Retards actifs</p>
              </Link>
            </div>
          )}
        </section>

        {/* Navigation */}
        <section>
          <h2 className="text-lg font-medium text-gray-700 mb-4">Gestion</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-base font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition text-center"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
