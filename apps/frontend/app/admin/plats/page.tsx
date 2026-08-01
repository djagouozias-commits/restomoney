'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface PlatVariante { id: string; libelle: string; prix: number; position: number; }

export default function PlatsPage() {
  const [plats, setPlats] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [avecJetable, setAvecJetable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // États variantes
  const [addingVarianteFor, setAddingVarianteFor] = useState<string | null>(null);
  const [newLibelle, setNewLibelle] = useState('');
  const [newPrix, setNewPrix] = useState('');
  const [editingVariante, setEditingVariante] = useState<(PlatVariante & { platId: string }) | null>(null);
  const [varianteError, setVarianteError] = useState<string | null>(null);

  const load = () => apiFetch<any[]>('/admin/plats').then(setPlats).catch(console.error);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setNom(''); setDescription(''); setPrix(''); setAvecJetable(false); setShowForm(true); };
  const openEdit = (p: any) => { setEditing(p); setNom(p.nom); setDescription(p.description || ''); setPrix(String(p.prix)); setAvecJetable(!!p.avec_jetable); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('nom', nom);
    fd.append('description', description);
    fd.append('prix', prix);
    fd.append('avec_jetable', String(avecJetable));
    if (fileRef.current?.files?.[0]) fd.append('image', fileRef.current.files[0]);
    if (editing) {
      await apiFetch(`/admin/plats/${editing.id}`, { method: 'PUT', body: fd });
    } else {
      await apiFetch('/admin/plats', { method: 'POST', body: fd });
    }
    setShowForm(false);
    load();
  };

  const handleToggle = async (id: string) => {
    await apiFetch(`/admin/plats/${id}/toggle`, { method: 'PATCH' });
    load();
  };

  const handleToggleJetable = async (id: string) => {
    await apiFetch(`/admin/plats/${id}/jetable`, { method: 'PATCH' });
    load();
  };

  // Fonctions variantes
  const addVariante = async (platId: string) => {
    try {
      const v = await apiFetch<PlatVariante>(`/admin/plats/${platId}/variantes`, {
        method: 'POST',
        body: JSON.stringify({ libelle: newLibelle, prix: parseFloat(newPrix) }),
      });
      setPlats(prev => prev.map(p => p.id === platId
        ? { ...p, variantes: [...(p.variantes || []), v] }
        : p));
      setAddingVarianteFor(null); setNewLibelle(''); setNewPrix('');
    } catch (e: any) { setVarianteError(e.message); }
  };

  const saveVariante = async (platId: string, varianteId: string) => {
    if (!editingVariante) return;
    try {
      const v = await apiFetch<PlatVariante>(`/admin/plats/${platId}/variantes/${varianteId}`, {
        method: 'PUT',
        body: JSON.stringify({ libelle: editingVariante.libelle, prix: editingVariante.prix }),
      });
      setPlats(prev => prev.map(p => p.id === platId
        ? { ...p, variantes: (p.variantes || []).map((vv: PlatVariante) => vv.id === varianteId ? v : vv) }
        : p));
      setEditingVariante(null);
    } catch (e: any) { setVarianteError(e.message); }
  };

  const deleteVariante = async (platId: string, varianteId: string, variantes: PlatVariante[]) => {
    if (variantes.length <= 1) {
      setVarianteError('Un plat doit conserver au moins une variante.');
      return;
    }
    try {
      await apiFetch(`/admin/plats/${platId}/variantes/${varianteId}`, { method: 'DELETE' });
      setPlats(prev => prev.map(p => p.id === platId
        ? { ...p, variantes: (p.variantes || []).filter((v: PlatVariante) => v.id !== varianteId) }
        : p));
    } catch (e: any) { setVarianteError(e.message); }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Plats</h1>
          <button onClick={openCreate} className="ml-auto bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700">
            Nouveau plat
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">{editing ? 'Modifier le plat' : 'Nouveau plat'}</h2>
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-base font-medium text-gray-700">Nom *</label>
                <input value={nom} onChange={(e) => setNom(e.target.value)} required
                  className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="col-span-2">
                <label className="text-base font-medium text-gray-700">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="avec_jetable"
                  checked={avecJetable}
                  onChange={(e) => setAvecJetable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="avec_jetable" className="text-base font-medium text-gray-700">
                  Couverts jetables disponibles
                </label>
              </div>
              <div>
                <label className="text-base font-medium text-gray-700">Prix (FCFA) *</label>
                <input type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} required
                  className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="text-base font-medium text-gray-700">Image</label>
                <input type="file" accept="image/*" ref={fileRef} className="w-full mt-1 text-base" />
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700">Enregistrer</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-600 px-4 py-2.5 text-base hover:text-gray-900">Annuler</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plats.map((p) => (
            <div key={p.id} className={`bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col ${!p.actif ? 'opacity-60' : ''}`}>
              {/* Image uniforme — même taille, object-cover, pas d'espace */}
              <div className="relative w-full bg-gray-100" style={{ height: '200px' }}>
                {p.image_url ? (
                  <Image
                    src={`${API_ORIGIN}${p.image_url}`}
                    alt={p.nom}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                    <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Aucune image</span>
                  </div>
                )}
                {/* Badge statut */}
                <span className={`absolute top-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${
                  p.actif ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                }`}>
                  {p.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {/* Contenu */}
              <div className="p-4 flex flex-col flex-1">
                <p className="text-base font-semibold text-gray-900 leading-snug">{p.nom}</p>
                <p className="text-lg font-bold text-orange-600 mt-1">{Number(p.prix).toLocaleString('fr-FR')} F</p>
                {p.avec_jetable && (
                  <span className="mt-1 inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full w-fit">
                    Couverts jetables
                  </span>
                )}
                {p.description && (
                  <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{p.description}</p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(p)}
                    className="flex-1 text-sm text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded-lg transition-colors">
                    Modifier
                  </button>
                  <button onClick={() => handleToggle(p.id)}
                    className={`flex-1 text-sm text-center font-medium py-1.5 px-3 rounded-lg transition-colors ${
                      p.actif
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}>
                    {p.actif ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Supprimer le plat "${p.nom}" ? Cette action est irréversible.`)) return;
                      try {
                        await apiFetch(`/admin/plats/${p.id}`, { method: 'DELETE' });
                        load();
                      } catch (e: any) { alert(e?.message || 'Erreur lors de la suppression.'); }
                    }}
                    className="text-sm bg-red-50 hover:bg-red-100 text-red-600 font-medium py-1.5 px-3 rounded-lg transition-colors">
                    Supprimer
                  </button>
                </div>

                {/* Variantes */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Variantes de prix</p>
                  {varianteError && <p className="text-xs text-red-600 mb-2">{varianteError}</p>}
                  {(p.variantes || []).map((v: PlatVariante) => (
                    <div key={v.id} className="flex items-center gap-2 mb-1.5">
                      {editingVariante?.id === v.id ? (
                        <>
                          <input value={editingVariante.libelle}
                            onChange={e => setEditingVariante({ ...editingVariante, libelle: e.target.value })}
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                          <input type="number" value={editingVariante.prix}
                            onChange={e => setEditingVariante({ ...editingVariante, prix: parseFloat(e.target.value) })}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                          <button onClick={() => saveVariante(p.id, v.id)}
                            className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg">OK</button>
                          <button onClick={() => setEditingVariante(null)}
                            className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">{v.libelle}</span>
                          <span className="text-sm font-semibold text-gray-900">{Number(v.prix).toLocaleString('fr-FR')} F</span>
                          <button onClick={() => { setEditingVariante({ ...v, platId: p.id }); setVarianteError(null); }}
                            className="text-xs text-blue-500 hover:text-blue-700">Modifier</button>
                          <button
                            onClick={() => { setVarianteError(null); deleteVariante(p.id, v.id, p.variantes || []); }}
                            disabled={(p.variantes || []).length <= 1}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                            Suppr.
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {addingVarianteFor === p.id ? (
                    <div className="flex gap-2 mt-2">
                      <input placeholder="Libellé" value={newLibelle} onChange={e => setNewLibelle(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <input type="number" placeholder="Prix" value={newPrix} onChange={e => setNewPrix(e.target.value)}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <button onClick={() => addVariante(p.id)}
                        className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg hover:bg-orange-600">Ajouter</button>
                      <button onClick={() => { setAddingVarianteFor(null); setVarianteError(null); }}
                        className="text-xs text-gray-400">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingVarianteFor(p.id); setVarianteError(null); }}
                      className="text-xs text-orange-500 hover:text-orange-700 mt-1 font-medium">
                      + Ajouter une variante
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
