'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { RotationLogTable } from '@/components/admin/RotationLogTable';
import Link from 'next/link';

export default function RotationLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any[]>('/admin/rotation-logs')
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const lastFailed = logs.find((l) => l.statut === 'echec');
  const lastSuccess = logs.find((l) => l.statut === 'succes');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Journal des rotations</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Historique des rotations quotidiennes du planning de plats
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-4">

        {/* Alerte dernière rotation en échec */}
        {lastFailed && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Rotation en échec détectée</p>
              <p className="text-sm text-red-700 mt-0.5">{lastFailed.message || 'Aucun détail disponible.'}</p>
              <p className="text-xs text-red-500 mt-1">Date : {lastFailed.date_jour}</p>
            </div>
          </div>
        )}

        {/* Dernière rotation réussie */}
        {lastSuccess && !lastFailed && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">
              Dernière rotation réussie le <strong>{lastSuccess.date_jour}</strong>
            </p>
          </div>
        )}

        {/* Tableau */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Chargement du journal...</span>
            </div>
          ) : (
            <RotationLogTable logs={logs} />
          )}
        </div>
      </main>
    </div>
  );
}
