'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Chargement côté client uniquement (Leaflet ne supporte pas SSR)
const LocationPicker = dynamic(
  () => import('@/components/admin/LocationPicker').then((m) => ({ default: m.LocationPicker })),
  { ssr: false, loading: () => <div className="h-72 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Chargement de la carte...</div> },
);

const schema = z.object({
  nom: z.string().min(1),
  domaine: z.string().optional(),
  telephone: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
type FormValues = z.infer<typeof schema>;

export default function StructuresPage() {
  const [structures, setStructures] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [credentials, setCredentials] = useState<{ login: string; plainPassword: string } | null>(null);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { latitude: 6.3654, longitude: 2.4183 },
  });

  const latVal = watch('latitude');
  const lonVal = watch('longitude');

  const load = () => apiFetch<any[]>('/admin/structures').then(setStructures).catch(console.error);
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: FormValues) => {
    setError('');
    try {
      if (editing) {
        await apiFetch(`/admin/structures/${editing.id}`, { method: 'PUT', body: JSON.stringify(data) });
        setEditing(null);
      } else {
        const res = await apiFetch<any>('/admin/structures', { method: 'POST', body: JSON.stringify(data) });
        if (res.plainPassword) {
          setCredentials({ login: res.structure.login, plainPassword: res.plainPassword });
        }
      }
      reset({ latitude: 6.3654, longitude: 2.4183 });
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue.');
    }
  };

  const handleReset = async (id: string) => {
    const res = await apiFetch<any>(`/admin/structures/${id}/reset-password`, { method: 'POST' });
    setCredentials({ login: res.login, plainPassword: res.plainPassword });
  };

  const handleToggle = async (id: string) => {
    await apiFetch(`/admin/structures/${id}/toggle`, { method: 'PATCH' });
    load();
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer la structure "${nom}" ? Cette action est irréversible.`)) return;
    try {
      await apiFetch(`/admin/structures/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setShowForm(true);
    setError('');
    reset({
      nom: s.nom,
      domaine: s.domaine || '',
      telephone: s.telephone || '',
      latitude: parseFloat(s.latitude),
      longitude: parseFloat(s.longitude),
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Structures</h1>
          <button
            onClick={() => { setShowForm(true); setEditing(null); reset({ latitude: 6.3654, longitude: 2.4183 }); setError(''); }}
            className="ml-auto bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700"
          >
            Nouvelle structure
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-5">

        {/* Modale credentials */}
        {credentials && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Identifiants generes</h2>
                <p className="text-base text-red-600 mt-1">Notez ces informations. Elles ne seront plus affichees.</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Identifiant de connexion</p>
                  <p className="text-xl font-mono font-bold text-gray-900 select-all bg-white border border-gray-200 rounded px-3 py-2">{credentials.login}</p>
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

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">
              {editing ? 'Modifier la structure' : 'Nouvelle structure'}
            </h2>
            {error && <p className="text-red-600 text-base bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-base font-medium text-gray-700">Nom *</label>
                  <input {...register('nom')} className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  {errors.nom && <p className="text-red-500 text-sm mt-1">Champ requis</p>}
                </div>
                <div>
                  <label className="text-base font-medium text-gray-700">Domaine d'activite</label>
                  <input {...register('domaine')} className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="text-base font-medium text-gray-700">Telephone</label>
                  <input {...register('telephone')} className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-base font-medium text-gray-700">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      {...register('latitude')}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-base font-medium text-gray-700">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      {...register('longitude')}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Carte GPS */}
              <LocationPicker
                lat={latVal}
                lon={lonVal}
                onChange={(lat, lon) => {
                  setValue('latitude', lat, { shouldValidate: true });
                  setValue('longitude', lon, { shouldValidate: true });
                }}
              />

              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700">
                  {editing ? 'Enregistrer' : 'Creer la structure'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-600 px-4 py-2.5 text-base hover:text-gray-900">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tableau */}
        <div className="swipe-x bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-base" style={{ minWidth: '700px' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nom', 'Domaine', 'Login', 'GPS', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {structures.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-base">Aucune structure enregistree.</td></tr>
              ) : structures.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-900">{s.nom}</td>
                  <td className="px-5 py-4 text-gray-500">{s.domaine || '—'}</td>
                  <td className="px-5 py-4 font-mono text-gray-700">{s.login}</td>
                  <td className="px-5 py-4 text-gray-400 text-sm font-mono">
                    {s.latitude && s.longitude ? `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${s.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {s.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3 flex-wrap">
                      <Link href={`/admin/structures/${s.id}/employes`} className="text-sm font-medium text-gray-900 hover:text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg">
                        Employes
                      </Link>
                      <Link href={`/admin/structures/${s.id}/membres`} className="text-sm font-medium text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg">
                        Membres
                      </Link>
                      <button onClick={() => openEdit(s)} className="text-sm text-blue-600 hover:text-blue-800">Modifier</button>
                      <button onClick={() => handleToggle(s.id)}
                        className={`text-sm ${s.actif ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                        {s.actif ? 'Desactiver' : 'Activer'}
                      </button>
                      <button onClick={() => handleReset(s.id)} className="text-sm text-orange-500 hover:text-orange-700">
                        Reset MDP
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.nom)}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
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
