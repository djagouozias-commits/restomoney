'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface ParametreSanction {
  niveau: number;
  min_minutes: number;
  max_minutes: number | null;
  reduction_pct: number;
  emettre_bon: boolean;
}

interface BonReduction {
  id: string;
  structure_id: string;
  valeur_pct: number;
  emis_le: string;
  expire_le: string;
  utilise: boolean;
}

interface RowState {
  data: ParametreSanction;
  saving: boolean;
  success: boolean;
  error: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function SanctionsPage() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loadingParams, setLoadingParams] = useState(true);
  const [errorParams, setErrorParams] = useState<string | null>(null);

  const [bons, setBons] = useState<BonReduction[]>([]);
  const [loadingBons, setLoadingBons] = useState(true);
  const [errorBons, setErrorBons] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ParametreSanction[]>('/admin/sanctions/parametres')
      .then((data) => {
        setRows(
          data.map((p) => ({ data: { ...p }, saving: false, success: false, error: null }))
        );
      })
      .catch((err) => setErrorParams(err?.message || 'Erreur de chargement'))
      .finally(() => setLoadingParams(false));
  }, []);

  useEffect(() => {
    apiFetch<BonReduction[]>('/admin/sanctions/bons')
      .then(setBons)
      .catch((err) => setErrorBons(err?.message || 'Erreur de chargement'))
      .finally(() => setLoadingBons(false));
  }, []);

  function updateField(
    niveau: number,
    field: keyof ParametreSanction,
    value: number | boolean | null
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.data.niveau === niveau
          ? { ...r, data: { ...r.data, [field]: value }, success: false, error: null }
          : r
      )
    );
  }

  async function saveRow(niveau: number) {
    const row = rows.find((r) => r.data.niveau === niveau);
    if (!row) return;

    setRows((prev) =>
      prev.map((r) =>
        r.data.niveau === niveau ? { ...r, saving: true, success: false, error: null } : r
      )
    );

    try {
      await apiFetch(`/admin/sanctions/parametres/${niveau}`, {
        method: 'PATCH',
        body: JSON.stringify(row.data),
      });
      setRows((prev) =>
        prev.map((r) =>
          r.data.niveau === niveau ? { ...r, saving: false, success: true, error: null } : r
        )
      );
      setTimeout(() => {
        setRows((prev) =>
          prev.map((r) =>
            r.data.niveau === niveau ? { ...r, success: false } : r
          )
        );
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde';
      setRows((prev) =>
        prev.map((r) =>
          r.data.niveau === niveau
            ? { ...r, saving: false, success: false, error: message }
            : r
        )
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link
            href="/admin"
            className="text-gray-400 hover:text-gray-700 text-xl font-light"
          >
            &larr;
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Paramètres de sanctions</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-8">
        {/* Section 1 : Tableau éditable des paramètres */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Niveaux de sanction</h2>

          {loadingParams && (
            <p className="text-base text-gray-400">Chargement...</p>
          )}

          {errorParams && !loadingParams && (
            <p className="text-base text-red-600">{errorParams}</p>
          )}

          {!loadingParams && !errorParams && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="py-3 pr-4">Niveau</th>
                    <th className="py-3 pr-4">Min (min)</th>
                    <th className="py-3 pr-4">Max (min)</th>
                    <th className="py-3 pr-4">Réduction (%)</th>
                    <th className="py-3 pr-4">Émettre bon</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ data, saving, success, error }) => (
                    <tr
                      key={data.niveau}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {data.niveau}
                      </td>

                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          value={data.min_minutes}
                          onChange={(e) =>
                            updateField(
                              data.niveau,
                              'min_minutes',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </td>

                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          value={data.max_minutes ?? ''}
                          placeholder="∞"
                          onChange={(e) =>
                            updateField(
                              data.niveau,
                              'max_minutes',
                              e.target.value === '' ? null : parseInt(e.target.value, 10)
                            )
                          }
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </td>

                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={data.reduction_pct}
                          onChange={(e) =>
                            updateField(
                              data.niveau,
                              'reduction_pct',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </td>

                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={data.emettre_bon}
                          onChange={(e) =>
                            updateField(data.niveau, 'emettre_bon', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                        />
                      </td>

                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => saveRow(data.niveau)}
                            disabled={saving}
                            className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
                          >
                            {saving ? '...' : 'Enregistrer'}
                          </button>

                          {success && (
                            <span className="text-sm text-green-600 font-medium">
                              Sauvegardé ✓
                            </span>
                          )}

                          {error && (
                            <span className="text-sm text-red-600">{error}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2 : Bons de réduction (lecture seule) */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Bons de réduction émis</h2>

          {loadingBons && (
            <p className="text-base text-gray-400">Chargement...</p>
          )}

          {errorBons && !loadingBons && (
            <p className="text-base text-red-600">{errorBons}</p>
          )}

          {!loadingBons && !errorBons && bons.length === 0 && (
            <p className="text-base text-gray-400">Aucun bon émis.</p>
          )}

          {!loadingBons && !errorBons && bons.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="py-3 pr-4">Structure ID</th>
                    <th className="py-3 pr-4">Valeur (%)</th>
                    <th className="py-3 pr-4">Émis le</th>
                    <th className="py-3 pr-4">Expire le</th>
                    <th className="py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {bons.map((bon) => (
                    <tr
                      key={bon.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                        {bon.structure_id}
                      </td>
                      <td className="py-3 pr-4 text-gray-900">{bon.valeur_pct} %</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(bon.emis_le)}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(bon.expire_le)}</td>
                      <td className="py-3">
                        {bon.utilise ? (
                          <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">
                            Utilisé
                          </span>
                        ) : (
                          <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                            Actif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
