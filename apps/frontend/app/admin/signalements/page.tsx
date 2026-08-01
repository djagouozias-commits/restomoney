'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface Signalement {
  id: string;
  commande_id: string;
  photo_url: string;
  heure_signalement: string;
  retard_minutes: number;
  niveau_sanction: number | null;
  reduction_pct: number | null;
  bon_emis: boolean;
  note: string | null;
  commande_creneau: string;
  commande_date: string;
  structure_nom: string;
  employe_nom: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminSignalementsPage() {
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Signalement | null>(null);
  const [filter, setFilter] = useState<'tous' | 'retard' | 'ok'>('tous');

  useEffect(() => {
    apiFetch<Signalement[]>('/admin/signalements')
      .then(setSignalements)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = signalements.filter((s) => {
    if (filter === 'retard') return s.retard_minutes > 0;
    if (filter === 'ok') return s.retard_minutes === 0;
    return true;
  });

  const retardCount = signalements.filter((s) => s.retard_minutes > 0).length;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Signalements retard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {signalements.length} signalement{signalements.length !== 1 ? 's' : ''} · {retardCount} retard{retardCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-5">

        {/* Modal aperçu photo */}
        {preview && (
          <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="relative" style={{ height: '320px' }}>
                <img
                  src={`${API_ORIGIN}${preview.photo_url}`}
                  alt="Preuve signalement"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{preview.structure_nom}</p>
                    <p className="text-sm text-gray-500">{preview.commande_date} — {preview.commande_creneau}</p>
                  </div>
                  {preview.retard_minutes > 0 ? (
                    <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
                      {preview.retard_minutes} min de retard
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">
                      A l'heure
                    </span>
                  )}
                </div>
                {preview.niveau_sanction && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm space-y-0.5">
                    <p className="font-semibold text-amber-800">Sanction appliquée</p>
                    <p className="text-amber-700">Niveau {preview.niveau_sanction} · Réduction {preview.reduction_pct}%</p>
                    {preview.bon_emis && <p className="text-green-700 font-medium">Bon de réduction émis</p>}
                  </div>
                )}
                {preview.note && (
                  <p className="text-sm text-gray-500 italic">Note : {preview.note}</p>
                )}
                <p className="text-xs text-gray-400">Pris le {formatDateTime(preview.heure_signalement)}</p>
                <button
                  onClick={() => setPreview(null)}
                  className="w-full mt-2 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'tous',   label: 'Tous' },
            { id: 'retard', label: 'Retards uniquement' },
            { id: 'ok',     label: 'A l\'heure' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === f.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tableau */}
        <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm" style={{ minWidth: '800px' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Photo', 'Structure', 'Date commande', 'Créneau', 'Heure signalement', 'Retard', 'Sanction', 'Bon', 'Employé'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Aucun signalement.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  {/* Photo miniature cliquable */}
                  <td className="px-4 py-3">
                    <button onClick={() => setPreview(s)} className="block">
                      <img
                        src={`${API_ORIGIN}${s.photo_url}`}
                        alt="Photo"
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.structure_nom}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.commande_date}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.commande_creneau}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(s.heure_signalement)}</td>
                  <td className="px-4 py-3">
                    {s.retard_minutes > 0 ? (
                      <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        {s.retard_minutes} min
                      </span>
                    ) : (
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        A l'heure
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.niveau_sanction ? (
                      <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Niv.{s.niveau_sanction} · {s.reduction_pct}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.bon_emis ? (
                      <span className="text-green-600 font-semibold text-xs">Oui</span>
                    ) : (
                      <span className="text-gray-400 text-xs">Non</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.employe_nom || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
