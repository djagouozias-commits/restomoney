'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Livreur {
  id: string;
  nom: string;
  login: string;
  zone_habituelle: string;
  actif: boolean;
}

interface Commande {
  id: string;
  structure_nom: string;
  creneau: string;
  date_commande: string;
  statut: string;
  montant_total: number;
}

interface MissionCommande {
  commande_id: string;
  statut_livraison: string;
}

interface Mission {
  id: string;
  livreur_id: string;
  livreur_nom?: string;
  circuit: string;
  date_mission: string;
  statut_mission: 'en_attente' | 'en_route' | 'terminee' | 'annulee';
  started_at: string | null;
  completed_at: string | null;
  commandes: MissionCommande[];
}

interface CommandeParZone {
  structure_nom: string;
  creneau: string;
  montant_total: number;
  statut_commande: string;
  statut_livraison: string;
  commande_id: string;
}

interface CircuitGroup {
  circuit: string;
  commandes: CommandeParZone[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function statutBadge(statut: string) {
  const map: Record<string, string> = {
    en_attente: 'bg-gray-100 text-gray-700',
    en_route:   'bg-blue-100 text-blue-700',
    terminee:   'bg-green-100 text-green-700',
    annulee:    'bg-red-100 text-red-600',
  };
  const label: Record<string, string> = {
    en_attente: 'En attente',
    en_route:   'En route',
    terminee:   'Terminée',
    annulee:    'Annulée',
  };
  const cls = map[statut] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${cls}`}>
      {label[statut] || statut}
    </span>
  );
}

function commandeStatutBadge(statut: string) {
  const map: Record<string, string> = {
    en_attente:      'bg-gray-100 text-gray-700',
    en_preparation:  'bg-yellow-100 text-yellow-700',
    en_livraison:    'bg-blue-100 text-blue-700',
    livre:           'bg-green-100 text-green-700',
    en_retard:       'bg-red-100 text-red-600',
  };
  const cls = map[statut] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${cls}`}>
      {statut.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Tab: Créer une mission ────────────────────────────────────────────────────

function CreerMissionTab() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loadingLivreurs, setLoadingLivreurs] = useState(true);
  const [loadingCommandes, setLoadingCommandes] = useState(true);

  const [livreurId, setLivreurId] = useState('');
  const [circuit, setCircuit] = useState('');
  const [dateMission, setDateMission] = useState(today());
  const [selectedCommandes, setSelectedCommandes] = useState<string[]>([]);
  const [structureFilter, setStructureFilter] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch<Livreur[]>('/admin/livreurs')
      .then(setLivreurs)
      .catch(console.error)
      .finally(() => setLoadingLivreurs(false));

    apiFetch<Commande[]>('/admin/commandes?date=today')
      .then(setCommandes)
      .catch(console.error)
      .finally(() => setLoadingCommandes(false));
  }, []);

  const filteredCommandes = structureFilter
    ? commandes.filter((c) =>
        c.structure_nom?.toLowerCase().includes(structureFilter.toLowerCase()),
      )
    : commandes;

  const toggleCommande = (id: string) => {
    setSelectedCommandes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!livreurId) { setError('Veuillez sélectionner un livreur.'); return; }
    if (!circuit.trim()) { setError('Le circuit est requis.'); return; }
    if (selectedCommandes.length === 0) { setError('Sélectionnez au moins une commande.'); return; }

    setSubmitting(true);
    try {
      await apiFetch('/admin/missions', {
        method: 'POST',
        body: JSON.stringify({
          livreur_id: livreurId,
          circuit: circuit.trim(),
          date_mission: dateMission,
          commande_ids: selectedCommandes,
        }),
      });
      setSuccess('Mission créée avec succès.');
      setLivreurId('');
      setCircuit('');
      setDateMission(today());
      setSelectedCommandes([]);
      setStructureFilter('');
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-base">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-base">
          {success}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Livreur */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">Livreur *</label>
          {loadingLivreurs ? (
            <p className="text-gray-400 text-sm">Chargement...</p>
          ) : (
            <select
              value={livreurId}
              onChange={(e) => setLivreurId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              <option value="">— Sélectionner —</option>
              {livreurs.filter((l) => l.actif).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom} ({l.zone_habituelle || l.login})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Circuit */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">Circuit *</label>
          <input
            type="text"
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
            placeholder="ex: Zone Nord"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">Date de mission *</label>
          <input
            type="date"
            value={dateMission}
            onChange={(e) => setDateMission(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Sélection commandes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-base font-medium text-gray-700">
            Commandes du jour *{' '}
            <span className="text-gray-400 font-normal">
              ({selectedCommandes.length} sélectionnée{selectedCommandes.length > 1 ? 's' : ''})
            </span>
          </label>
          <input
            type="text"
            placeholder="Filtrer par structure..."
            value={structureFilter}
            onChange={(e) => setStructureFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-52"
          />
        </div>

        {loadingCommandes ? (
          <p className="text-gray-400 text-sm">Chargement des commandes...</p>
        ) : filteredCommandes.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center border border-dashed border-gray-200 rounded-lg">
            Aucune commande disponible.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-10"></th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Structure</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Créneau</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Montant</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCommandes.map((c) => (
                  <tr
                    key={c.id}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedCommandes.includes(c.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleCommande(c.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCommandes.includes(c.id)}
                        onChange={() => toggleCommande(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.structure_nom || `#${c.id.slice(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.creneau}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.montant_total != null ? `${Number(c.montant_total).toFixed(0)} F` : '—'}
                    </td>
                    <td className="px-4 py-3">{commandeStatutBadge(c.statut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Création...' : 'Créer la mission'}
        </button>
      </div>
    </form>
  );
}

// ─── Tab: Suivi du jour ────────────────────────────────────────────────────────

function SuiviDuJourTab() {
  const [grouped, setGrouped] = useState<Record<string, Mission[]>>({});
  const [loading, setLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState('tous');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<Record<string, Mission[]>>('/admin/missions')
      .then((data) => { setGrouped(data || {}); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCancel = async (missionId: string) => {
    if (!confirm('Annuler cette mission ?')) return;
    setError('');
    setCancelling(missionId);
    try {
      await apiFetch(`/admin/missions/${missionId}/cancel`, { method: 'POST' });
      load();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l\'annulation.');
    } finally {
      setCancelling(null);
    }
  };

  const allEntries = Object.entries(grouped);

  // Apply statut filter across all livreur groups
  const filteredEntries: [string, Mission[]][] = allEntries.map(([livreurId, missions]) => {
    const filtered = statutFilter === 'tous'
      ? missions
      : missions.filter((m) => m.statut_mission === statutFilter);
    return [livreurId, filtered];
  }).filter(([, missions]) => missions.length > 0);

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-base">
          {error}
        </div>
      )}

      {/* Filtre statut */}
      <div className="flex items-center gap-3">
        <label className="text-base font-medium text-gray-700">Statut :</label>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
        >
          <option value="tous">Tous</option>
          <option value="en_attente">En attente</option>
          <option value="en_route">En route</option>
          <option value="terminee">Terminée</option>
          <option value="annulee">Annulée</option>
        </select>
        <span className="text-sm text-gray-400 ml-2">Rafraîchissement auto toutes les 30 s</span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-base py-8 text-center">Chargement...</p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-gray-400 text-base py-8 text-center border border-dashed border-gray-200 rounded-xl">
          Aucune mission aujourd'hui.
        </p>
      ) : (
        filteredEntries.map(([livreurId, missions]) => {
          const livreurNom = missions[0]?.livreur_nom || `Livreur ${livreurId.slice(0, 8)}`;
          return (
            <div key={livreurId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-800">{livreurNom}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {missions.map((mission) => {
                  const total = mission.commandes?.length ?? 0;
                  const livrees = mission.commandes?.filter((c) => c.statut_livraison === 'livre').length ?? 0;
                  const canCancel = mission.statut_mission !== 'terminee';

                  return (
                    <div key={mission.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium text-gray-900">{mission.circuit}</span>
                          {statutBadge(mission.statut_mission)}
                          <span className="text-sm text-gray-500">
                            {livrees}/{total} livrée{total > 1 ? 's' : ''}
                          </span>
                        </div>
                        {mission.started_at && (
                          <p className="text-sm text-gray-400">
                            Démarré le{' '}
                            {new Date(mission.started_at).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(mission.id)}
                          disabled={cancelling === mission.id}
                          className="text-sm text-red-600 hover:text-red-800 border border-red-200 px-3 py-1 rounded-lg disabled:opacity-50"
                        >
                          {cancelling === mission.id ? 'Annulation...' : 'Annuler'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Tab: Commandes par zone ───────────────────────────────────────────────────

function CommandesParZoneTab() {
  const [date, setDate] = useState(today());
  const [circuits, setCircuits] = useState<CircuitGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [statutFilter, setStatutFilter] = useState('tous');

  const load = useCallback((d: string) => {
    setLoading(true);
    apiFetch<CircuitGroup[]>(`/admin/missions/commandes-par-zone?date=${d}`)
      .then((data) => setCircuits(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const filteredCircuits: CircuitGroup[] = circuits.map((circuit) => ({
    ...circuit,
    commandes: statutFilter === 'tous'
      ? circuit.commandes
      : circuit.commandes.filter((c) => c.statut_commande === statutFilter),
  })).filter((circuit) => circuit.commandes.length > 0);

  // Collect unique statuts for the filter
  const allStatuts = Array.from(
    new Set(circuits.flatMap((c) => c.commandes.map((cmd) => cmd.statut_commande))),
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-base font-medium text-gray-700 mr-2">Date :</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-base font-medium text-gray-700">Statut commande :</label>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
          >
            <option value="tous">Tous</option>
            {allStatuts.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-base py-8 text-center">Chargement...</p>
      ) : circuits.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
          <p className="text-gray-400 text-base">Aucune mission planifiée pour cette date.</p>
        </div>
      ) : filteredCircuits.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center">
          <p className="text-gray-400 text-base">Aucune commande pour ce statut.</p>
        </div>
      ) : (
        filteredCircuits.map((circuitGroup) => (
          <div key={circuitGroup.circuit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Circuit : {circuitGroup.circuit}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Structure</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Créneau</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Montant</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Statut commande</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Livraison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {circuitGroup.commandes.map((cmd) => (
                  <tr key={cmd.commande_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{cmd.structure_nom}</td>
                    <td className="px-5 py-3 text-gray-500">{cmd.creneau}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {cmd.montant_total != null ? `${Number(cmd.montant_total).toFixed(0)} F` : '—'}
                    </td>
                    <td className="px-5 py-3">{commandeStatutBadge(cmd.statut_commande)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          cmd.statut_livraison === 'livre'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {cmd.statut_livraison === 'livre' ? 'Livré' : 'À livrer'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'creer' | 'suivi' | 'zones';

export default function MissionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('creer');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'creer',  label: 'Créer une mission'   },
    { id: 'suivi',  label: 'Suivi du jour'        },
    { id: 'zones',  label: 'Commandes par zone'   },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">
            &larr;
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Missions</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-0" aria-label="Onglets">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-base font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'creer' && <CreerMissionTab />}
          {activeTab === 'suivi' && <SuiviDuJourTab />}
          {activeTab === 'zones' && <CommandesParZoneTab />}
        </div>
      </main>
    </div>
  );
}
