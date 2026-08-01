'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface OptionForm { nom: string; position: number; }
interface ComposantForm { nom: string; a_choix: boolean; position: number; options: OptionForm[]; }

const emptyComposant = (pos: number): ComposantForm => ({ nom: '', a_choix: false, position: pos, options: [] });

export default function MenusAdminPage() {
  const [menus, setMenus] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [composants, setComposants] = useState<ComposantForm[]>([emptyComposant(1)]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleteError, setDeleteError] = useState('');

  const load = () => apiFetch<any[]>('/admin/menus').then(setMenus).catch(console.error);
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null); setNom(''); setDescription(''); setPrix('');
    setComposants([emptyComposant(1)]); setShowForm(true);
  };

  const openEdit = (m: any) => {
    setEditing(m); setNom(m.nom); setDescription(m.description || ''); setPrix(String(m.prix));
    setComposants((m.composants || []).map((c: any) => ({
      nom: c.nom, a_choix: c.a_choix, position: c.position,
      options: (c.options || []).map((o: any) => ({ nom: o.nom, position: o.position })),
    })));
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    const payload = { nom, description, prix: parseFloat(prix), composants };
    fd.append('data', JSON.stringify(payload));
    if (fileRef.current?.files?.[0]) fd.append('image', fileRef.current.files[0]);

    if (editing) {
      await apiFetch(`/admin/menus/${editing.id}`, { method: 'PUT', body: fd });
    } else {
      await apiFetch('/admin/menus', { method: 'POST', body: fd });
    }
    setShowForm(false);
    load();
  };

  const handleToggle = async (id: string) => {
    await apiFetch(`/admin/menus/${id}/toggle`, { method: 'PATCH' });
    load();
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le menu "${nom}" ? Cette action est irréversible.`)) return;
    setDeleteError('');
    try {
      await apiFetch(`/admin/menus/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setDeleteError(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const addComposant = () => setComposants([...composants, emptyComposant(composants.length + 1)]);
  const removeComposant = (i: number) => setComposants(composants.filter((_, j) => j !== i));

  const updateComposant = (i: number, key: string, val: any) =>
    setComposants(composants.map((c, j) => j === i ? { ...c, [key]: val } : c));

  const addOption = (ci: number) =>
    setComposants(composants.map((c, j) => j === ci
      ? { ...c, options: [...c.options, { nom: '', position: c.options.length + 1 }] }
      : c));

  const updateOption = (ci: number, oi: number, val: string) =>
    setComposants(composants.map((c, j) => j === ci
      ? { ...c, options: c.options.map((o, k) => k === oi ? { ...o, nom: val } : o) }
      : c));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">Menus Complets</h1>
        <button onClick={openCreate} className="ml-auto bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium">+ Nouveau menu</button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {deleteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {deleteError}
          </div>
        )}

        {showForm && (          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">{editing ? 'Modifier' : 'Créer'} un menu</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Nom *</label>
                  <input value={nom} onChange={(e) => setNom(e.target.value)} required className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Prix (FCFA) *</label>
                  <input type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} required className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Image</label>
                  <input type="file" accept="image/*" ref={fileRef} className="w-full mt-1 text-sm" />
                </div>
              </div>

              {/* Composants */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">Composants</h3>
                  <button type="button" onClick={addComposant} className="text-blue-600 text-xs hover:underline">+ Ajouter composant</button>
                </div>
                {composants.map((comp, ci) => (
                  <div key={ci} className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        placeholder={`Composant ${ci + 1}`}
                        value={comp.nom}
                        onChange={(e) => updateComposant(ci, 'nom', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      />
                      <label className="flex items-center gap-1.5 text-sm text-gray-600">
                        <input type="checkbox" checked={comp.a_choix} onChange={(e) => updateComposant(ci, 'a_choix', e.target.checked)} />
                        À choix
                      </label>
                      <button type="button" onClick={() => removeComposant(ci)} className="text-red-400 text-xs">✕</button>
                    </div>
                    {comp.a_choix && (
                      <div className="pl-4 space-y-2">
                        {comp.options.map((opt, oi) => (
                          <input key={oi} placeholder={`Option ${oi + 1}`} value={opt.nom}
                            onChange={(e) => updateOption(ci, oi, e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm w-full sm:w-64" />
                        ))}
                        <button type="button" onClick={() => addOption(ci)} className="text-blue-500 text-xs hover:underline">+ Option</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm">Enregistrer</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4">Annuler</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {menus.map((m) => {
            const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';
            return (
              <div key={m.id} className={`bg-white rounded-2xl border border-gray-200 overflow-hidden ${!m.actif ? 'opacity-60' : ''}`}>
                {/* Image aperçu */}
                <div className="relative w-full bg-gray-100" style={{ height: '180px' }}>
                  {m.image_url ? (
                    <img
                      src={`${API_ORIGIN}${m.image_url}`}
                      alt={m.nom}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">Aucune image</span>
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${m.actif ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                    {m.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div className="p-4">
                  <p className="font-semibold text-gray-800 text-base">{m.nom}</p>
                  <p className="text-orange-600 font-bold text-base mt-0.5">{Number(m.prix).toLocaleString('fr-FR')} F</p>
                  {m.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{m.composants?.length || 0} composant{(m.composants?.length || 0) > 1 ? 's' : ''}</p>
                  <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => openEdit(m)} className="flex-1 text-sm text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 rounded-lg transition-colors">Modifier</button>
                    <button onClick={() => handleToggle(m.id)} className="flex-1 text-sm text-center bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium py-1.5 rounded-lg transition-colors">
                      {m.actif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => handleDelete(m.id, m.nom)} className="text-sm bg-red-50 hover:bg-red-100 text-red-600 font-medium py-1.5 px-3 rounded-lg transition-colors">Supprimer</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
