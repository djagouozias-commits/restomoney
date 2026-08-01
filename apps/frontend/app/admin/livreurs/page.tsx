'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiException } from '@/lib/api';
import Link from 'next/link';

interface Livreur {
  id: string;
  login: string;
  nom: string;
  zone_habituelle: string;
  actif: boolean;
  created_at: string;
}

export default function LivreursPage() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ login: '', password: '', nom: '', zone_habituelle: '' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit state (inline panel)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nom: '', zone_habituelle: '' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Password reset modal (one-shot)
  const [resetCredentials, setResetCredentials] = useState<{ login: string; plainPassword: string } | null>(null);
  const [showResetPass, setShowResetPass] = useState(false);

  const load = () =>
    apiFetch<Livreur[]>('/admin/livreurs')
      .then(setLivreurs)
      .catch(console.error);

  useEffect(() => {
    load();
  }, []);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await apiFetch<Livreur>('/admin/livreurs', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      setCreateForm({ login: '', password: '', nom: '', zone_habituelle: '' });
      setShowCreateForm(false);
      load();
    } catch (e: unknown) {
      if (e instanceof ApiException && e.code === 'LIVREUR_LOGIN_DUPLICATE') {
        setCreateError('Ce login est déjà utilisé par un autre livreur.');
      } else if (e instanceof Error) {
        setCreateError(e.message || 'Une erreur est survenue.');
      } else {
        setCreateError('Une erreur est survenue.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = (l: Livreur) => {
    setEditingId(l.id);
    setEditForm({ nom: l.nom, zone_habituelle: l.zone_habituelle });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditError('');
    setEditLoading(true);
    try {
      await apiFetch(`/admin/livreurs/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      load();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setEditError(e.message || 'Une erreur est survenue.');
      } else {
        setEditError('Une erreur est survenue.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ── Reset password ───────────────────────────────────────────────────────────
  const handleResetPassword = async (id: string) => {
    try {
      const res = await apiFetch<{ login: string; plainPassword: string }>(
        `/admin/livreurs/${id}/reset-password`,
        { method: 'POST' },
      );
      setResetCredentials({ login: res.login, plainPassword: res.plainPassword });
      setShowResetPass(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la réinitialisation.');
    }
  };

  // ── Deactivate / Reactivate ─────────────────────────────────────────────────
  const handleToggle = async (l: Livreur) => {
    if (l.actif) {
      // Confirm before deactivating
      if (!confirm(`Désactiver le livreur "${l.nom}" ? Il ne pourra plus se connecter.`)) return;
      try {
        await apiFetch(`/admin/livreurs/${l.id}/deactivate`, { method: 'POST' });
        load();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Erreur lors de la désactivation.');
      }
    } else {
      // Reactivate via PATCH
      try {
        await apiFetch(`/admin/livreurs/${l.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ actif: true }),
        });
        load();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Erreur lors de la réactivation.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">
            &larr;
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Livreurs</h1>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setCreateForm({ login: '', password: '', nom: '', zone_habituelle: '' });
              setCreateError('');
            }}
            className="ml-auto bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700"
          >
            Nouveau livreur
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-5">

        {/* ── One-shot password modal ─────────────────────────────────────────── */}
        {resetCredentials && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Identifiants générés</h2>
                <p className="text-base text-red-600 mt-1 font-medium">
                  Ce mot de passe ne sera plus affiché.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Identifiant de connexion</p>
                  <p className="text-xl font-mono font-bold text-gray-900 select-all bg-white border border-gray-200 rounded px-3 py-2">
                    {resetCredentials.login}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Mot de passe</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xl font-mono font-bold text-gray-900 select-all bg-white border border-gray-200 rounded px-3 py-2">
                      {showResetPass
                        ? resetCredentials.plainPassword
                        : '•'.repeat(resetCredentials.plainPassword.length)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowResetPass((v) => !v)}
                      className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      {showResetPass ? 'Masquer' : 'Voir'}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetCredentials(null);
                  setShowResetPass(false);
                }}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-base font-medium"
              >
                J'ai noté ces informations
              </button>
            </div>
          </div>
        )}

        {/* ── Create form (inline panel) ──────────────────────────────────────── */}
        {showCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Nouveau livreur</h2>
            {createError && (
              <p className="text-red-600 text-base bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                {createError}
              </p>
            )}
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-base font-medium text-gray-700">
                    Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={createForm.login}
                    onChange={(e) => setCreateForm((f) => ({ ...f, login: e.target.value }))}
                    required
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="text-base font-medium text-gray-700">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="text-base font-medium text-gray-700">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={createForm.nom}
                    onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
                    required
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="text-base font-medium text-gray-700">Zone habituelle</label>
                  <input
                    value={createForm.zone_habituelle}
                    onChange={(e) => setCreateForm((f) => ({ ...f, zone_habituelle: e.target.value }))}
                    placeholder="ex. Cotonou Nord"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  {createLoading ? 'Création...' : 'Créer le livreur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-600 px-4 py-2.5 text-base hover:text-gray-900"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-base" style={{ minWidth: '550px' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Login', 'Nom', 'Zone habituelle', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {livreurs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-base">
                    Aucun livreur enregistré.
                  </td>
                </tr>
              ) : (
                livreurs.map((l) => (
                  <>
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-mono text-gray-700">{l.login}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{l.nom}</td>
                      <td className="px-5 py-4 text-gray-500">{l.zone_habituelle || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            l.actif
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {l.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-4 flex-wrap">
                          <button
                            onClick={() => openEdit(l)}
                            className="text-base text-blue-600 hover:text-blue-800"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleResetPassword(l.id)}
                            className="text-base text-orange-500 hover:text-orange-700"
                          >
                            Réinitialiser MDP
                          </button>
                          <button
                            onClick={() => handleToggle(l)}
                            className={`text-base ${
                              l.actif
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {l.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Inline edit panel ───────────────────────────────────── */}
                    {editingId === l.id && (
                      <tr key={`${l.id}-edit`} className="bg-blue-50">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="bg-white border border-blue-200 rounded-xl p-5">
                            <h3 className="text-base font-semibold text-gray-800 mb-4">
                              Modifier — {l.login}
                            </h3>
                            {editError && (
                              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-3">
                                {editError}
                              </p>
                            )}
                            <form onSubmit={handleEdit} className="flex flex-wrap gap-4 items-end">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Nom</label>
                                <input
                                  value={editForm.nom}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, nom: e.target.value }))
                                  }
                                  required
                                  className="block mt-1 border border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  Zone habituelle
                                </label>
                                <input
                                  value={editForm.zone_habituelle}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      zone_habituelle: e.target.value,
                                    }))
                                  }
                                  className="block mt-1 border border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                                />
                              </div>
                              <div className="flex gap-3">
                                <button
                                  type="submit"
                                  disabled={editLoading}
                                  className="bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50"
                                >
                                  {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="text-gray-600 px-4 py-2 text-base hover:text-gray-900"
                                >
                                  Annuler
                                </button>
                              </div>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
