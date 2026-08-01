'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Membre {
  id: string;
  nom: string;
  telephone: string;
  whatsapp: string | null;
  poste: string | null;
  actif: boolean;
}

interface Structure {
  id: string;
  nom: string;
}

export default function AdminMembresPage() {
  const params = useParams<{ id: string }>();
  const structureId = params?.id;

  const [structure, setStructure] = useState<Structure | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [poste, setPoste] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const load = async () => {
    if (!structureId) return;
    try {
      const [structs, mems] = await Promise.all([
        apiFetch<Structure[]>('/admin/structures'),
        apiFetch<Membre[]>(`/admin/structures/${structureId}/membres`),
      ]);
      setStructure(structs.find((s) => s.id === structureId) ?? null);
      setMembres(mems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [structureId]);

  const openCreate = () => {
    setEditingId(null);
    setNom(''); setTelephone(''); setWhatsapp(''); setWhatsappSame(true); setPoste('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (m: Membre) => {
    setEditingId(m.id);
    setNom(m.nom);
    setTelephone(m.telephone);
    setWhatsapp(m.whatsapp ?? m.telephone);
    setWhatsappSame(!m.whatsapp || m.whatsapp === m.telephone);
    setPoste(m.poste ?? '');
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !telephone.trim()) {
      setFormError('Le nom et le téléphone sont obligatoires.');
      return;
    }
    setFormError('');
    setFormLoading(true);

    try {
      const payload = {
        nom: nom.trim(),
        telephone: telephone.trim(),
        whatsapp: whatsappSame ? telephone.trim() : (whatsapp.trim() || telephone.trim()),
        poste: poste.trim() || null,
      };

      if (editingId) {
        await apiFetch(`/admin/membres/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, structure_id: structureId }),
        });
      } else {
        await apiFetch(`/admin/structures/${structureId}/membres`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e?.message || 'Une erreur est survenue.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le membre "${name}" ?`)) return;
    try {
      await apiFetch(`/admin/membres/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ structure_id: structureId }),
      });
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin/structures" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Membres — {structure?.nom ?? '...'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Contacts de la structure</p>
          </div>
          <button
            onClick={openCreate}
            className="ml-auto bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700"
          >
            + Nouveau membre
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-6 space-y-5">

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">
              {editingId ? 'Modifier le membre' : 'Nouveau membre'}
            </h2>
            {formError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{formError}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom *</label>
                  <input
                    value={nom} onChange={(e) => setNom(e.target.value)} required
                    placeholder="Prénom Nom"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Poste / Fonction</label>
                  <input
                    value={poste} onChange={(e) => setPoste(e.target.value)}
                    placeholder="Ex : Directeur, RH..."
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Téléphone *</label>
                  <input
                    type="tel" value={telephone}
                    onChange={(e) => { setTelephone(e.target.value); if (whatsappSame) setWhatsapp(e.target.value); }}
                    required placeholder="+229 97 00 00 00"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">WhatsApp</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox" checked={whatsappSame}
                        onChange={(e) => { setWhatsappSame(e.target.checked); if (e.target.checked) setWhatsapp(telephone); }}
                        className="rounded border-gray-300"
                      />
                      Même que téléphone
                    </label>
                  </div>
                  {!whatsappSame ? (
                    <input
                      type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+229 97 00 00 00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  ) : (
                    <div className="mt-1 border border-gray-200 rounded-lg px-4 py-2.5 text-base text-gray-400 bg-gray-50">
                      {telephone || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={formLoading}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50">
                  {formLoading ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-gray-600 px-4 py-2.5 text-base hover:text-gray-900">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tableau membres */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-base">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nom', 'Poste', 'Téléphone', 'WhatsApp', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Chargement...</td></tr>
              ) : membres.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Aucun membre enregistré.</td></tr>
              ) : membres.map((m) => (
                <tr key={m.id} className={`hover:bg-gray-50 ${!m.actif ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-4 font-medium text-gray-900">{m.nom}</td>
                  <td className="px-5 py-4 text-gray-500">{m.poste || '—'}</td>
                  <td className="px-5 py-4">
                    <a href={`tel:${m.telephone}`} className="text-gray-700 hover:text-blue-600">{m.telephone}</a>
                  </td>
                  <td className="px-5 py-4">
                    {m.whatsapp ? (
                      <a
                        href={`https://wa.me/${m.whatsapp.replace(/\s+/g, '').replace('+', '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800"
                      >
                        {m.whatsapp}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${m.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => openEdit(m)} className="text-sm text-blue-600 hover:text-blue-800">Modifier</button>
                      <button onClick={() => handleDelete(m.id, m.nom)} className="text-sm text-red-500 hover:text-red-700">Supprimer</button>
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
