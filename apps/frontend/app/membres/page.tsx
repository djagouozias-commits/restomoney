'use client';

/**
 * Page gestion des membres — accessible par la structure connectée
 * Route : /membres
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Membre {
  id: string;
  nom: string;
  telephone: string;
  whatsapp: string | null;
  poste: string | null;
  actif: boolean;
}

export default function MembresPage() {
  const router = useRouter();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappSame, setWhatsappSame] = useState(true); // même que téléphone par défaut
  const [poste, setPoste] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const load = () =>
    apiFetch<Membre[]>('/membres')
      .then(setMembres)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

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
    setWhatsappSame(m.whatsapp === m.telephone || !m.whatsapp);
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
        telephone: '01' + telephone.trim(),
        whatsapp: whatsappSame ? '01' + telephone.trim() : (whatsapp.trim() ? '01' + whatsapp.trim() : '01' + telephone.trim()),
        poste: poste.trim() || null,
      };

      if (editingId) {
        await apiFetch(`/membres/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/membres', { method: 'POST', body: JSON.stringify(payload) });
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
      await apiFetch(`/membres/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiFetch(`/membres/${id}/toggle`, { method: 'PATCH' });
      load();
    } catch (e: any) {
      alert(e?.message || 'Erreur.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">←</button>
          <h1 className="text-xl font-bold text-gray-800">Membres de la structure</h1>
          <button
            onClick={openCreate}
            className="ml-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            + Ajouter
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {editingId ? 'Modifier le membre' : 'Nouveau membre'}
            </h2>

            {formError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  placeholder="Prénom Nom"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-sm font-medium text-gray-600 select-none">
                    01
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={telephone}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setTelephone(v);
                      if (whatsappSame) setWhatsapp(v);
                    }}
                    required
                    maxLength={8}
                    placeholder="68204654"
                    className="flex-1 border border-gray-300 rounded-r-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Format : 01XXXXXXXX (10 chiffres)</p>
              </div>

              {/* WhatsApp */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium text-gray-700">WhatsApp</label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={whatsappSame}
                      onChange={(e) => {
                        setWhatsappSame(e.target.checked);
                        if (e.target.checked) setWhatsapp(telephone);
                      }}
                      className="rounded border-gray-300"
                    />
                    Identique au téléphone
                  </label>
                </div>
                {!whatsappSame && (
                  <div className="flex">
                    <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-sm font-medium text-gray-600 select-none">
                      01
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      maxLength={8}
                      placeholder="68204654"
                      className="flex-1 border border-gray-300 rounded-r-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poste / Fonction</label>
                <input
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                  placeholder="Ex : Directeur, Comptable..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-gray-900 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {formLoading ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter le membre'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 px-5 text-sm hover:text-gray-800"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : membres.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun membre enregistré.</p>
            <p className="text-gray-300 text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {membres.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border border-gray-200 px-4 py-4 ${!m.actif ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{m.nom}</p>
                      {m.poste && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {m.poste}
                        </span>
                      )}
                      {!m.actif && (
                        <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      <a
                        href={`tel:${m.telephone}`}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {m.telephone}
                      </a>
                      {m.whatsapp && m.whatsapp !== m.telephone && (
                        <a
                          href={`https://wa.me/${m.whatsapp?.replace(/\s+/g, '').replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp : {m.whatsapp}
                        </a>
                      )}
                      {m.whatsapp === m.telephone && (
                        <a
                          href={`https://wa.me/${m.whatsapp?.replace(/\s+/g, '').replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp disponible
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleToggle(m.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        m.actif
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                          : 'bg-green-50 hover:bg-green-100 text-green-700'
                      }`}
                    >
                      {m.actif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.nom)}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
