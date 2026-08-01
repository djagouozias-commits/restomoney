'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Employe {
  id: string;
  login: string;
  nom?: string;
  actif: boolean;
  created_at: string;
}

export default function EmployesPage({ params }: { params: { id: string } }) {
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [structure, setStructure] = useState<any>(null);
  const [credentials, setCredentials] = useState<{ login: string; plainPassword: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [nom, setNom] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [s, e] = await Promise.all([
      apiFetch<any>(`/admin/structures/${params.id}`),
      apiFetch<Employe[]>(`/admin/structures/${params.id}/employes`),
    ]);
    setStructure(s);
    setEmployes(e);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/admin/structures/${params.id}/employes`, {
        method: 'POST',
        body: JSON.stringify({ nom: nom || undefined }),
      });
      setCredentials({ login: res.employe.login, plainPassword: res.plainPassword });
      setNom('');
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    await apiFetch(`/admin/employes/${id}/toggle`, { method: 'PATCH' });
    load();
  };

  const handleReset = async (id: string) => {
    const res = await apiFetch<any>(`/admin/employes/${id}/reset-password`, { method: 'POST' });
    setCredentials({ login: res.login, plainPassword: res.plainPassword });
  };

  const handleDelete = async (id: string, login: string) => {
    if (!confirm(`Supprimer l'employé "${login}" ?`)) return;
    try {
      await apiFetch(`/admin/employes/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin/structures" className="text-gray-400 hover:text-gray-700 text-xl">&larr;</Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Employes — {structure?.nom || '...'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gerez les comptes individuels des employes de cette structure
            </p>
          </div>
          <Link
            href={`/admin/recap?structureId=${params.id}`}
            className="ml-auto border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:border-gray-500"
          >
            Voir le recap du jour
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-6 space-y-5">

        {/* Modale credentials */}
        {credentials && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Identifiants crees</h2>
                <p className="text-base text-red-600 mt-1">Communiquez ces infos a l'employe. Non reaffichables.</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Identifiant de connexion</p>
                  <p className="text-xl font-mono font-bold text-gray-900 select-all bg-white border border-gray-200 rounded px-3 py-2">
                    {credentials.login}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Mot de passe</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xl font-mono font-bold text-gray-900 select-all bg-white border border-gray-200 rounded px-3 py-2">
                      {showPass ? credentials.plainPassword : '•'.repeat(credentials.plainPassword.length)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      {showPass ? 'Masquer' : 'Voir'}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setCredentials(null); setShowPass(false); }}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-base font-medium"
              >
                J'ai note ces informations
              </button>
            </div>
          </div>
        )}

        {/* Formulaire ajout */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Ajouter un employe</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-base font-medium text-gray-700">
                Nom de l'employe (optionnel)
              </label>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <p className="text-sm text-gray-400 mt-1">
                Le login sera genere automatiquement (ex: {structure ? structure.nom.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + '1' : '...'})
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Creation...' : 'Creer un employe'}
            </button>
          </div>
        </div>

        {/* Liste employés */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              Employes ({employes.length})
            </h2>
          </div>
          <table className="w-full text-base">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Login', 'Nom', 'Statut', 'Date creation', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    Aucun employe. Ajoutez le premier employe ci-dessus.
                  </td>
                </tr>
              ) : employes.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-mono font-bold text-gray-900">{e.login}</td>
                  <td className="px-5 py-4 text-gray-600">{e.nom || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${e.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {e.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-sm">
                    {new Date(e.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleToggle(e.id)}
                        className={`text-base ${e.actif ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {e.actif ? 'Desactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => handleReset(e.id)}
                        className="text-base text-blue-600 hover:text-blue-800"
                      >
                        Reset MDP
                      </button>
                      <button
                        onClick={() => handleDelete(e.id, e.login)}
                        className="text-base text-red-600 hover:text-red-800"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
