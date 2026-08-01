'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/api';
import { useGpsTracker } from '@/lib/useGpsSocket';

// MissionMap loaded client-only (Leaflet needs window)
const MissionMap = dynamic(() => import('@/components/livreur/MissionMap'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissionCommande {
  commande_id: string;
  statut_livraison: 'a_livrer' | 'livre';
  structure_nom: string;
  structure_latitude: number;
  structure_longitude: number;
  creneau: string;
  montant_total: number;
}

interface Mission {
  id: string;
  circuit: string;
  statut_mission: 'en_attente' | 'en_route' | 'terminee' | 'annulee';
  started_at: string | null;
  completed_at: string | null;
  commandes: MissionCommande[];
  livrees: number;
  total: number;
  date_mission?: string;
}

interface HistoriqueResponse {
  missions: Mission[];
  total: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(statut: Mission['statut_mission']) {
  switch (statut) {
    case 'en_attente':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          En attente
        </span>
      );
    case 'en_route':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          En route
        </span>
      );
    case 'terminee':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Terminée
        </span>
      );
    case 'annulee':
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500 line-through">
          Annulée
        </span>
      );
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Mission card (today) ──────────────────────────────────────────────────────

interface MissionCardProps {
  mission: Mission;
  onStart: (id: string) => Promise<void>;
  onLivre: (missionId: string, commandeId: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  actionLoading: string | null;
  currentLat: number | null;
  currentLon: number | null;
}

function MissionCard({
  mission,
  onStart,
  onLivre,
  onComplete,
  actionLoading,
  currentLat,
  currentLon,
}: MissionCardProps) {
  const isCancelled = mission.statut_mission === 'annulee';
  const isEnAttente = mission.statut_mission === 'en_attente';
  const isEnRoute = mission.statut_mission === 'en_route';
  const isTerminee = mission.statut_mission === 'terminee';
  const allDelivered = mission.commandes.every((c) => c.statut_livraison === 'livre');
  const [showMap, setShowMap] = useState(isEnRoute);

  // Build waypoints from pending deliveries (a_livrer first, then livre)
  const waypoints = mission.commandes
    .filter((c) => c.structure_latitude && c.structure_longitude)
    .map((c) => ({
      lat: c.structure_latitude,
      lon: c.structure_longitude,
      label: c.structure_nom,
    }));

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden ${
        isCancelled ? 'border-gray-200 opacity-60' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-gray-900">{mission.circuit}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {mission.livrees} / {mission.total} livré{mission.livrees !== 1 ? 'es' : 'e'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(mission.statut_mission)}
            {/* Toggle map button */}
            {!isCancelled && waypoints.length > 0 && (
              <button
                onClick={() => setShowMap((v) => !v)}
                className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:border-gray-300 transition"
              >
                {showMap ? 'Masquer carte' : 'Voir carte'}
              </button>
            )}
          </div>
        </div>

        {/* Commandes list */}
        <ul className="divide-y divide-gray-100">
          {mission.commandes.map((cmd) => (
            <li
              key={cmd.commande_id}
              className={`py-3 flex items-start justify-between gap-2 ${
                isCancelled ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{cmd.structure_nom}</p>
                <p className="text-xs text-gray-500 mt-0.5">{cmd.creneau}</p>
                {cmd.structure_latitude && cmd.structure_longitude && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${cmd.structure_latitude},${cmd.structure_longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs text-blue-600 underline mt-0.5 inline-block ${
                      isCancelled ? 'pointer-events-none' : ''
                    }`}
                  >
                    Ouvrir dans Maps
                  </a>
                )}
              </div>

              {/* "Livré" button */}
              {isEnRoute && cmd.statut_livraison === 'a_livrer' && (
                <button
                  onClick={() => onLivre(mission.id, cmd.commande_id)}
                  disabled={!!actionLoading || isCancelled}
                  className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {actionLoading === `livre-${mission.id}-${cmd.commande_id}` ? '...' : 'Livré'}
                </button>
              )}

              {cmd.statut_livraison === 'livre' && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Livré
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          {isEnAttente && (
            <button
              onClick={() => onStart(mission.id)}
              disabled={!!actionLoading || isCancelled}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {actionLoading === `start-${mission.id}` ? 'Démarrage...' : '🚚 En route'}
            </button>
          )}

          {isEnRoute && (
            <button
              onClick={() => onComplete(mission.id)}
              disabled={!allDelivered || !!actionLoading}
              title={!allDelivered ? 'Toutes les commandes doivent être livrées' : undefined}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {actionLoading === `complete-${mission.id}` ? 'Finalisation...' : '✅ Terminer la mission'}
            </button>
          )}

          {isTerminee && (
            <p className="text-sm text-green-600 font-medium py-2">Mission terminée</p>
          )}
        </div>
      </div>

      {/* Map — shown when en_route or toggled manually */}
      {showMap && waypoints.length > 0 && (
        <div className="border-t border-gray-100">
          <MissionMap
            waypoints={waypoints}
            currentLat={currentLat}
            currentLon={currentLon}
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LivreurDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [todayMissions, setTodayMissions] = useState<Mission[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  const [historique, setHistorique] = useState<Mission[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GPS current position (updated by geolocation watch)
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLon, setCurrentLon] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find the active mission (en_route) for GPS
  const activeMission = todayMissions.find((m) => m.statut_mission === 'en_route') ?? null;
  const { connect: gpsConnect, disconnect: gpsDisconnect } = useGpsTracker(
    activeMission?.id ?? null,
  );

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'livreur')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // ── GPS: auto-connect when en_route mission exists ──────────────────────────
  useEffect(() => {
    if (!activeMission) {
      if (gpsActive) {
        gpsDisconnect();
        setGpsActive(false);
      }
      return;
    }

    if (!gpsActive) {
      gpsConnect();
      setGpsActive(true);

      // Track local position for the map
      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            setCurrentLat(pos.coords.latitude);
            setCurrentLon(pos.coords.longitude);
          },
          (err) => console.warn('[GPS local]', err.message),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
        );
        return () => navigator.geolocation.clearWatch(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMission?.id]);

  // ── Data fetchers ───────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    try {
      const data = await apiFetch<Mission[]>('/livreur/missions/today');
      setTodayMissions(data ?? []);
    } catch (err) {
      console.error('fetchToday error', err);
      setError('Impossible de charger les missions du jour.');
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const fetchHistorique = useCallback(async (page: number) => {
    setHistLoading(true);
    try {
      const data = await apiFetch<HistoriqueResponse>(
        `/livreur/missions/historique?page=${page}`,
      );
      setHistorique(data.missions ?? []);
      setHistTotal(data.total ?? 0);
    } catch (err) {
      console.error('fetchHistorique error', err);
    } finally {
      setHistLoading(false);
    }
  }, []);

  // ── Initial load + auto-refresh ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user || user.role !== 'livreur') return;

    fetchToday();
    intervalRef.current = setInterval(fetchToday, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authLoading, user, fetchToday]);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'livreur') return;
    fetchHistorique(histPage);
  }, [authLoading, user, histPage, fetchHistorique]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleStart = async (missionId: string) => {
    setActionLoading(`start-${missionId}`);
    setError(null);
    try {
      await apiFetch(`/livreur/missions/${missionId}/start`, { method: 'POST' });
      await fetchToday();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLivre = async (missionId: string, commandeId: string) => {
    setActionLoading(`livre-${missionId}-${commandeId}`);
    setError(null);
    try {
      await apiFetch(`/livreur/missions/${missionId}/commandes/${commandeId}/livre`, {
        method: 'POST',
      });
      await fetchToday();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la livraison.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (missionId: string) => {
    setActionLoading(`complete-${missionId}`);
    setError(null);
    try {
      await apiFetch(`/livreur/missions/${missionId}/complete`, { method: 'POST' });
      await fetchToday();
      await fetchHistorique(histPage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la finalisation.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render guard ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-base">Chargement...</p>
      </div>
    );
  }

  if (!user || user.role !== 'livreur') return null;

  const totalPages = Math.ceil(histTotal / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
            <p className="text-sm text-gray-500 mt-0.5">RestoMoney — Livreur</p>
          </div>
          <div className="flex items-center gap-2">
            {/* GPS indicator */}
            {gpsActive && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                GPS actif
              </span>
            )}
            {/* Bouton déconnexion */}
            <button
              onClick={logout}
              title="Se déconnecter"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 bg-white px-3 py-1.5 rounded-full transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Quitter
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Global error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Section Aujourd'hui ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aujourd'hui</h2>

          {todayLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : todayMissions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
              Aucune mission planifiée pour aujourd'hui.
            </div>
          ) : (
            <div className="space-y-4">
              {todayMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onStart={handleStart}
                  onLivre={handleLivre}
                  onComplete={handleComplete}
                  actionLoading={actionLoading}
                  currentLat={currentLat}
                  currentLon={currentLon}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Section Historique ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique</h2>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {histLoading ? (
              <div className="p-6 text-center text-gray-400 text-sm">Chargement...</div>
            ) : historique.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                Aucune mission dans l'historique.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {historique.map((mission) => (
                  <li key={mission.id} className="px-5 py-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{mission.circuit}</span>
                      {statusBadge(mission.statut_mission)}
                    </div>
                    {mission.date_mission && (
                      <p className="text-xs text-gray-500">
                        {new Date(mission.date_mission).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>
                        {mission.livrees ?? 0}/{mission.total ?? 0} livrée
                        {(mission.livrees ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {mission.started_at && (
                        <span>Démarré : {formatDate(mission.started_at)}</span>
                      )}
                      {mission.completed_at && (
                        <span>Terminé : {formatDate(mission.completed_at)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Pagination */}
            {!histLoading && histTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                  disabled={histPage <= 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Précédent
                </button>
                <span className="text-xs text-gray-500">
                  Page {histPage} / {totalPages}
                </span>
                <button
                  onClick={() => setHistPage((p) => Math.min(totalPages, p + 1))}
                  disabled={histPage >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
