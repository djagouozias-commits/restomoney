'use client';

/**
 * Page de suivi commande pour le client/employé
 * Route : /commande/:id/suivi
 *
 * - Affiche la position du livreur en temps réel via Socket.IO
 * - Calcule et affiche l'itinéraire via OpenRouteService
 * - Notifications quand le livreur approche (< 500m)
 * - Compatible mobile
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { apiFetch, getAccessToken } from '@/lib/api';

const SOCKET_URL   = process.env.NEXT_PUBLIC_SOCKET_URL   || 'http://localhost:3001';
const ORS_KEY      = process.env.NEXT_PUBLIC_ORS_KEY      || '';
const MAP_HEIGHT   = 420;
const NOTIFY_DIST  = 500; // notification si livreur < 500m

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommandeInfo {
  id: string;
  statut: string;
  creneau: string;
  montant_total: number;
  structure_nom: string;
  structure_latitude: number;
  structure_longitude: number;
  livreur_nom?: string;
  mission_id?: string;
}

// ── Haversine ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number): string {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

// ── Statut badge ──────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, [string, string]> = {
    en_attente:     ['#fef3c7', '#92400e'],
    en_preparation: ['#dbeafe', '#1e40af'],
    en_livraison:   ['#d1fae5', '#065f46'],
    livre:          ['#d1fae5', '#15803d'],
    en_retard:      ['#fee2e2', '#991b1b'],
  };
  const [bg, color] = map[statut] ?? ['#f3f4f6', '#374151'];
  const labels: Record<string, string> = {
    en_attente:     'En attente',
    en_preparation: 'En préparation',
    en_livraison:   'En livraison',
    livre:          'Livré',
    en_retard:      'En retard',
  };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: '999px',
      background: bg, color, fontSize: '13px', fontWeight: 600,
    }}>
      {labels[statut] ?? statut}
    </span>
  );
}

// ── Live Map ──────────────────────────────────────────────────────────────────

interface LiveMapProps {
  livreurLat: number | null;
  livreurLon: number | null;
  destLat: number;
  destLon: number;
  destLabel: string;
}

function LiveMap({ livreurLat, livreurLon, destLat, destLon, destLabel }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const LRef         = useRef<any>(null);
  const livMarker    = useRef<any>(null);
  const routeLayer   = useRef<any>(null);
  const initDone     = useRef(false);
  const routeFetched = useRef(false);

  const forceResize = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
  }, []);

  useEffect(() => {
    if (initDone.current || !containerRef.current) return;
    initDone.current = true;

    import('leaflet').then((mod) => {
      const L = mod.default ?? mod;
      LRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [destLat, destLon],
        zoom: 14,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20,
      }).addTo(map);

      // Marqueur destination (rouge)
      const destIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
                fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
          <circle cx="14" cy="14" r="5" fill="white"/>
        </svg>`,
        className: '', iconSize: [28, 40], iconAnchor: [14, 40],
      });
      L.marker([destLat, destLon], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<strong>${destLabel}</strong>`);

      mapRef.current = map;

      forceResize();
      setTimeout(forceResize, 50);
      setTimeout(forceResize, 300);
      setTimeout(forceResize, 800);

      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        const ro = new ResizeObserver(forceResize);
        ro.observe(containerRef.current!);
        (map as any)._ro = ro;
      }
      window.addEventListener('resize', forceResize);
      (map as any)._onResize = forceResize;
    });

    return () => {
      if (mapRef.current) {
        if ((mapRef.current as any)._ro) (mapRef.current as any)._ro.disconnect();
        window.removeEventListener('resize', (mapRef.current as any)._onResize ?? forceResize);
        mapRef.current.remove();
        mapRef.current = null;
        initDone.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update livreur marker + route
  useEffect(() => {
    if (livreurLat == null || livreurLon == null || !mapRef.current || !LRef.current) return;
    const L   = LRef.current;
    const map = mapRef.current;

    // Livreur marker
    const livIcon = L.divIcon({
      html: `
        <div style="position:relative;width:28px;height:28px">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,.25);animation:ping 1.5s infinite"></div>
          <div style="position:absolute;top:5px;left:5px;width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
        </div>
        <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
      className: '', iconSize: [28, 28], iconAnchor: [14, 14],
    });

    if (livMarker.current) {
      livMarker.current.setLatLng([livreurLat, livreurLon]);
      livMarker.current.setIcon(livIcon);
    } else {
      livMarker.current = L.marker([livreurLat, livreurLon], { icon: livIcon })
        .addTo(map).bindPopup('Livreur');

      // Fit bounds: livreur + destination
      map.fitBounds(
        L.latLngBounds([[livreurLat, livreurLon], [destLat, destLon]]),
        { padding: [50, 50] },
      );
    }

    // Draw route (once, then update periodically)
    if (!routeFetched.current && ORS_KEY) {
      routeFetched.current = true;
      fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: ORS_KEY },
        body: JSON.stringify({ coordinates: [[livreurLon, livreurLat], [destLon, destLat]] }),
      })
        .then((r) => r.json())
        .then((data) => {
          const feature = data?.features?.[0];
          if (!feature || !mapRef.current) return;
          const latlngs: [number, number][] = feature.geometry.coordinates.map(
            (c: number[]) => [c[1], c[0]],
          );
          if (routeLayer.current) routeLayer.current.remove();
          routeLayer.current = L.polyline(latlngs, {
            color: '#2563eb', weight: 5, opacity: 0.8,
          }).addTo(mapRef.current);
          // Allow refetch after 60s for live recalculation
          setTimeout(() => { routeFetched.current = false; }, 60000);
        })
        .catch(() => { routeFetched.current = false; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livreurLat, livreurLon]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: `${MAP_HEIGHT}px`,
        display: 'block', position: 'relative', background: '#e8e8e8',
        borderRadius: '12px', overflow: 'hidden',
      }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuiviCommandePage() {
  const params = useParams<{ id: string }>();
  const commandeId = params?.id;

  const [commande,   setCommande]   = useState<CommandeInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [livreurLat, setLivreurLat] = useState<number | null>(null);
  const [livreurLon, setLivreurLon] = useState<number | null>(null);
  const [distM,      setDistM]      = useState<number | null>(null);
  const [durS,       setDurS]       = useState<number | null>(null);
  const [notifSent,  setNotifSent]  = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load commande info
  useEffect(() => {
    if (!commandeId) return;
    apiFetch<CommandeInfo>(`/commandes/${commandeId}`)
      .then(setCommande)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [commandeId]);

  // Connect socket to receive live GPS updates for this commande
  useEffect(() => {
    if (!commande?.mission_id) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('gps:update', (data: {
      livreur_id: string;
      latitude: number;
      longitude: number;
      mission_id?: string | null;
    }) => {
      if (data.mission_id !== commande.mission_id) return;
      setLivreurLat(data.latitude);
      setLivreurLon(data.longitude);

      // Distance livreur → destination
      if (commande.structure_latitude && commande.structure_longitude) {
        const d = haversine(
          data.latitude, data.longitude,
          commande.structure_latitude, commande.structure_longitude,
        );
        setDistM(d);

        // Notification approche
        if (d < NOTIFY_DIST && !notifSent) {
          setNotifSent(true);
          if (Notification.permission === 'granted') {
            new Notification('🚚 Livreur proche !', {
              body: `Votre livreur est à ${formatDistance(d)} de vous.`,
            });
          }
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [commande, notifSent]);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: '100vh', background: '#f9fafb' }}>
        <p style={{ color: '#9ca3af', fontSize: '16px' }}>Chargement...</p>
      </div>
    );
  }

  if (!commande) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: '100vh', background: '#f9fafb' }}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>Commande introuvable.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Suivi de commande
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
            RestoMoney · {commande.creneau}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Statut + info */}
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px',
          padding: '20px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
                {commande.structure_nom}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>
                {commande.montant_total.toFixed(0)} F CFA
              </p>
            </div>
            <StatutBadge statut={commande.statut} />
          </div>

          {/* Distance + ETA */}
          {distM !== null && (
            <div style={{
              display: 'flex', gap: '16px', padding: '12px 16px',
              background: '#eff6ff', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, color: '#1d4ed8',
            }}>
              <span>📍 {formatDistance(distM)}</span>
              {durS !== null && <span>⏱ {formatDuration(durS)}</span>}
            </div>
          )}

          {commande.livreur_nom && (
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px', margin: '10px 0 0' }}>
              Livreur : <strong style={{ color: '#374151' }}>{commande.livreur_nom}</strong>
            </p>
          )}
        </div>

        {/* Notification approche */}
        {distM !== null && distM < NOTIFY_DIST && (
          <div style={{
            background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px',
            padding: '14px 16px', marginBottom: '16px',
            fontSize: '15px', fontWeight: 600, color: '#065f46',
          }}>
            🚚 Votre livreur approche ! Il est à {formatDistance(distM)}.
          </div>
        )}

        {/* Carte */}
        {commande.structure_latitude && commande.structure_longitude ? (
          <div style={{
            background: 'white', border: '1px solid #e5e7eb',
            borderRadius: '16px', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
                          fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              {livreurLat !== null
                ? '🟢 Suivi en temps réel'
                : '⏳ En attente de la position du livreur...'}
            </div>
            <LiveMap
              livreurLat={livreurLat}
              livreurLon={livreurLon}
              destLat={commande.structure_latitude}
              destLon={commande.structure_longitude}
              destLabel={commande.structure_nom}
            />
          </div>
        ) : (
          <div style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px',
            padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px',
          }}>
            Coordonnées GPS de la structure non disponibles.
          </div>
        )}
      </div>
    </div>
  );
}
