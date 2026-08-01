'use client';

/**
 * Page GPS Admin — Suivi des livreurs en temps réel
 *
 * - Chaque livreur "en route" a une couleur unique
 * - Son itinéraire est tracé sur la carte avec sa couleur (ORS)
 * - Sa position se déplace en temps réel (Socket.IO)
 * - Les points de livraison sont marqués avec la même couleur
 * - Sidebar : liste des livreurs avec statut + vitesse
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useGpsAdmin, GpsUpdate } from '@/lib/useGpsSocket';

const ORS_KEY = process.env.NEXT_PUBLIC_ORS_KEY || '';

// ── Couleurs par livreur (8 couleurs distinctes) ──────────────────────────────

const LIVREUR_COLORS = [
  { main: '#2563eb', light: '#dbeafe', name: 'Bleu'    },
  { main: '#dc2626', light: '#fee2e2', name: 'Rouge'   },
  { main: '#16a34a', light: '#dcfce7', name: 'Vert'    },
  { main: '#d97706', light: '#fef3c7', name: 'Orange'  },
  { main: '#7c3aed', light: '#ede9fe', name: 'Violet'  },
  { main: '#0891b2', light: '#cffafe', name: 'Cyan'    },
  { main: '#be185d', light: '#fce7f3', name: 'Rose'    },
  { main: '#65a30d', light: '#ecfccb', name: 'Lime'    },
];

function getColor(idx: number) {
  return LIVREUR_COLORS[idx % LIVREUR_COLORS.length]!;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LivePosition extends GpsUpdate {
  online: boolean;
  lastSeen: string;
}

interface Livreur {
  id: string;
  nom: string;
  actif: boolean;
}

interface MissionCommande {
  commande_id: string;
  statut_livraison: string;
  structure_nom: string;
  structure_latitude: number;
  structure_longitude: number;
  creneau: string;
}

interface Mission {
  id: string;
  livreur_id: string;
  circuit: string;
  statut_mission: string;
  commandes: MissionCommande[];
}

// ── ORS route ─────────────────────────────────────────────────────────────────

async function fetchRoute(
  from: { lat: number; lon: number },
  waypoints: Array<{ lat: number; lon: number }>,
): Promise<[number, number][] | null> {
  if (!ORS_KEY || waypoints.length === 0) return null;
  const coords = [[from.lon, from.lat], ...waypoints.map((w) => [w.lon, w.lat])];
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ORS_KEY },
      body: JSON.stringify({ coordinates: coords }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;
    return feature.geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number, number][];
  } catch { return null; }
}

// ── AdminGpsMap ───────────────────────────────────────────────────────────────

interface MapProps {
  positions:  Map<string, LivePosition>;
  livreurs:   Livreur[];
  missions:   Mission[];
  selectedId: string | null;
}

function AdminGpsMap({ positions, livreurs, missions, selectedId }: MapProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const LRef          = useRef<any>(null);
  const initDoneRef   = useRef(false);

  // Per-livreur map layers
  const markerRefs    = useRef<Map<string, any>>(new Map()); // livreurId → marker
  const routeRefs     = useRef<Map<string, any>>(new Map()); // livreurId → polyline
  const destRefs      = useRef<Map<string, any[]>>(new Map()); // livreurId → dest markers
  const routeFetching = useRef<Set<string>>(new Set());

  const forceResize = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
  }, []);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDoneRef.current || !containerRef.current) return;
    initDoneRef.current = true;

    import('leaflet').then((mod) => {
      const L = mod.default ?? mod;
      LRef.current = L;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl:       '/leaflet/marker-icon.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [6.3654, 2.4183],
        zoom: 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20,
      }).addTo(map);

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
        (mapRef.current as any)._ro?.disconnect();
        window.removeEventListener('resize', (mapRef.current as any)._onResize ?? (() => {}));
        mapRef.current.remove();
        mapRef.current    = null;
        initDoneRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update livreur markers + routes when positions change ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    const L   = LRef.current;
    if (!map || !L) return;

    positions.forEach((pos, livreurId) => {
      const colorIdx = livreurs.findIndex((l) => l.id === livreurId);
      const color    = getColor(colorIdx >= 0 ? colorIdx : 0);
      const livreur  = livreurs.find((l) => l.id === livreurId);
      const name     = livreur?.nom ?? pos.livreur_nom ?? livreurId.slice(0, 8);
      const initials = name.slice(0, 2).toUpperCase();

      // ── Marker livreur (cercle coloré avec initiales) ──
      const icon = L.divIcon({
        html: `
          <div style="position:relative;width:44px;height:44px">
            ${pos.online ? `<div style="
              position:absolute;inset:0;border-radius:50%;
              background:${color.main}33;
              animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;
            "></div>` : ''}
            <div style="
              position:absolute;top:4px;left:4px;
              width:36px;height:36px;border-radius:50%;
              background:${pos.online ? color.main : '#9ca3af'};
              border:3px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,.35);
              display:flex;align-items:center;justify-content:center;
              color:white;font-size:12px;font-weight:800;
            ">${initials}</div>
          </div>
          <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
        className:  '',
        iconSize:   [44, 44],
        iconAnchor: [22, 22],
      });

      const popup = `
        <div style="font-family:system-ui;min-width:160px;padding:4px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:12px;height:12px;border-radius:50%;background:${color.main}"></div>
            <strong style="font-size:14px">${name}</strong>
          </div>
          <span style="color:${pos.online ? '#16a34a' : '#6b7280'};font-size:12px">
            ${pos.online ? '● En route' : '○ Hors ligne'}
          </span><br/>
          <span style="font-size:11px;color:#6b7280">
            ${pos.speed != null ? `${(pos.speed * 3.6).toFixed(0)} km/h · ` : ''}
            Mis à jour: ${new Date(pos.lastSeen).toLocaleTimeString('fr-FR')}
          </span>
        </div>`;

      const existing = markerRefs.current.get(livreurId);
      if (existing) {
        existing.setLatLng([pos.latitude, pos.longitude]);
        existing.setIcon(icon);
        existing.setPopupContent(popup);
      } else {
        const m = L.marker([pos.latitude, pos.longitude], { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(popup);
        markerRefs.current.set(livreurId, m);
      }

      // ── Destination markers (points colorés pour cette course) ──
      if (pos.online && !destRefs.current.has(livreurId)) {
        const mission = missions.find((m) => m.livreur_id === livreurId && m.statut_mission === 'en_route');
        if (mission) {
          const dests: any[] = [];
          mission.commandes.forEach((cmd, i) => {
            if (!cmd.structure_latitude || !cmd.structure_longitude) return;
            const destIcon = L.divIcon({
              html: `
                <div style="
                  width:28px;height:28px;border-radius:50%;
                  background:${color.main};border:3px solid white;
                  box-shadow:0 2px 6px rgba(0,0,0,.3);
                  display:flex;align-items:center;justify-content:center;
                  color:white;font-size:11px;font-weight:700;
                  ${cmd.statut_livraison === 'livre' ? 'opacity:.45;' : ''}
                ">${i + 1}</div>`,
              className:  '',
              iconSize:   [28, 28],
              iconAnchor: [14, 14],
            });
            const dm = L.marker([cmd.structure_latitude, cmd.structure_longitude], { icon: destIcon })
              .addTo(map)
              .bindPopup(`
                <div style="font-family:system-ui">
                  <strong>${i + 1}. ${cmd.structure_nom}</strong><br/>
                  <span style="font-size:12px;color:#6b7280">${cmd.creneau}</span><br/>
                  <span style="font-size:12px;color:${cmd.statut_livraison === 'livre' ? '#16a34a' : '#d97706'}">
                    ${cmd.statut_livraison === 'livre' ? '✓ Livré' : '⏳ À livrer'}
                  </span>
                </div>`);
            dests.push(dm);
          });
          destRefs.current.set(livreurId, dests);

          // ── Tracer l'itinéraire ORS pour ce livreur ──
          const pending = mission.commandes.filter(
            (c) => c.statut_livraison !== 'livre' && c.structure_latitude && c.structure_longitude,
          );
          if (pending.length > 0 && !routeFetching.current.has(livreurId)) {
            routeFetching.current.add(livreurId);
            fetchRoute(
              { lat: pos.latitude, lon: pos.longitude },
              pending.map((c) => ({ lat: c.structure_latitude, lon: c.structure_longitude })),
            ).then((latlngs) => {
              if (!latlngs || !mapRef.current) return;
              const existing = routeRefs.current.get(livreurId);
              if (existing) existing.remove();
              const polyline = L.polyline(latlngs, {
                color:   color.main,
                weight:  5,
                opacity: 0.8,
                dashArray: undefined,
              }).addTo(mapRef.current);
              routeRefs.current.set(livreurId, polyline);
              routeFetching.current.delete(livreurId);
            }).catch(() => routeFetching.current.delete(livreurId));
          }
        }
      }

      // Mettre à jour la polyline si le livreur se déplace (recalcul toutes les 60s)
      if (pos.online && routeRefs.current.has(livreurId)) {
        const mission = missions.find((m) => m.livreur_id === livreurId && m.statut_mission === 'en_route');
        if (mission && !routeFetching.current.has(livreurId)) {
          const pending = mission.commandes.filter(
            (c) => c.statut_livraison !== 'livre' && c.structure_latitude && c.structure_longitude,
          );
          if (pending.length > 0) {
            routeFetching.current.add(livreurId);
            setTimeout(() => {
              fetchRoute(
                { lat: pos.latitude, lon: pos.longitude },
                pending.map((c) => ({ lat: c.structure_latitude, lon: c.structure_longitude })),
              ).then((latlngs) => {
                if (!latlngs || !mapRef.current) return;
                const ex = routeRefs.current.get(livreurId);
                if (ex) ex.remove();
                const polyline = L.polyline(latlngs, {
                  color: color.main, weight: 5, opacity: 0.8,
                }).addTo(mapRef.current);
                routeRefs.current.set(livreurId, polyline);
              }).finally(() => routeFetching.current.delete(livreurId));
            }, 60000); // recalcule toutes les 60s
          }
        }
      }
    });
  }, [positions, livreurs, missions]);

  // ── Zoom sur livreur sélectionné ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const pos = positions.get(selectedId);
    if (pos) {
      mapRef.current.flyTo([pos.latitude, pos.longitude], 15, { duration: 1 });
      markerRefs.current.get(selectedId)?.openPopup();
    }
  }, [selectedId, positions]);

  return (
    <div
      ref={containerRef}
      style={{
        width:    '100%',
        height:   '100%',
        minHeight: '500px',
        display:  'block',
        position: 'relative',
        background: '#e8e8e8',
      }}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGpsPage() {
  const [positions,  setPositions]  = useState<Map<string, LivePosition>>(new Map());
  const [livreurs,   setLivreurs]   = useState<Livreur[]>([]);
  const [missions,   setMissions]   = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Charger livreurs + missions en route
  useEffect(() => {
    apiFetch<Livreur[]>('/admin/livreurs').then(setLivreurs).catch(console.error);

    apiFetch<Record<string, Mission[]>>('/admin/missions')
      .then((data) => {
        if (!data) return;
        const all = Object.values(data).flat();
        setMissions(all.filter((m) => m.statut_mission === 'en_route'));
      })
      .catch(console.error);

    // Snapshot positions déjà connues
    apiFetch<any[]>('/admin/gps/positions')
      .then((data) => {
        if (!data?.length) return;
        setPositions((prev) => {
          const map = new Map(prev);
          for (const p of data) {
            map.set(p.livreur_id, {
              livreur_id:  p.livreur_id,
              livreur_nom: p.livreur_nom,
              latitude:    p.latitude,
              longitude:   p.longitude,
              accuracy:    p.accuracy,
              heading:     p.heading,
              speed:       p.speed,
              mission_id:  p.mission_id,
              timestamp:   p.recorded_at ?? new Date().toISOString(),
              online:      false,
              lastSeen:    p.recorded_at ?? new Date().toISOString(),
            });
          }
          return map;
        });
      })
      .catch(console.error);
  }, []);

  // Rafraîchir les missions toutes les 30s (statuts livreurs)
  useEffect(() => {
    const id = setInterval(() => {
      apiFetch<Record<string, Mission[]>>('/admin/missions')
        .then((data) => {
          if (!data) return;
          const all = Object.values(data).flat();
          setMissions(all.filter((m) => m.statut_mission === 'en_route'));
        })
        .catch(console.error);
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Socket.IO GPS live
  const handleUpdate = useCallback((pos: GpsUpdate) => {
    setPositions((prev) => {
      const map = new Map(prev);
      map.set(pos.livreur_id, { ...pos, online: true, lastSeen: pos.timestamp });
      return map;
    });
  }, []);

  const handleOffline = useCallback((livreurId: string) => {
    setPositions((prev) => {
      const map = new Map(prev);
      const ex  = map.get(livreurId);
      if (ex) map.set(livreurId, { ...ex, online: false });
      return map;
    });
  }, []);

  useGpsAdmin(handleUpdate, handleOffline);

  const posArray    = Array.from(positions.entries());
  const onlineCount = posArray.filter(([, p]) => p.online).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '14px 24px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/admin" style={{ color: '#9ca3af', fontSize: '20px', textDecoration: 'none' }}>
            ←
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Suivi GPS livreurs
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {onlineCount > 0
                ? `${onlineCount} livreur${onlineCount > 1 ? 's' : ''} en route`
                : 'Aucun livreur actif'}
              {' · '}temps réel
            </p>
          </div>

          {/* Légende couleurs */}
          {posArray.filter(([, p]) => p.online).length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {posArray
                .filter(([, p]) => p.online)
                .map(([livreurId, pos], i) => {
                  const livreur = livreurs.find((l) => l.id === livreurId);
                  const color   = getColor(livreurs.findIndex((l) => l.id === livreurId));
                  const name    = livreur?.nom ?? pos.livreur_nom ?? '?';
                  return (
                    <div key={livreurId} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '999px',
                      background: color.light, border: `1px solid ${color.main}33`,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.main }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: color.main }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{
        display: 'flex', gap: '16px', padding: '16px',
        flex: 1, height: 'calc(100vh - 72px)', overflow: 'hidden',
      }}>

        {/* Sidebar */}
        <aside style={{
          width: '240px', flexShrink: 0,
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: '14px', overflowY: 'auto',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
            position: 'sticky', top: 0, background: 'white',
            fontSize: '13px', fontWeight: 600, color: '#374151',
          }}>
            Livreurs
          </div>

          {posArray.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center',
                          fontSize: '13px', color: '#9ca3af' }}>
              Aucune position reçue.<br/>
              <span style={{ fontSize: '12px' }}>
                Les livreurs apparaissent dès qu'ils démarrent une mission.
              </span>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {posArray.map(([livreurId, pos], i) => {
                const colorIdx = livreurs.findIndex((l) => l.id === livreurId);
                const color    = getColor(colorIdx >= 0 ? colorIdx : i);
                const livreur  = livreurs.find((l) => l.id === livreurId);
                const name     = livreur?.nom ?? pos.livreur_nom ?? livreurId.slice(0, 8);
                const mission  = missions.find((m) => m.livreur_id === livreurId);
                const isSelected = selectedId === livreurId;

                return (
                  <li key={livreurId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <button
                      onClick={() => setSelectedId(isSelected ? null : livreurId)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 14px',
                        background: isSelected ? color.light : 'none',
                        border: 'none', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: '10px',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: pos.online ? color.main : '#9ca3af',
                        border: '2px solid white',
                        boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600,
                                    color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap' }}>
                          {name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px',
                                    color: pos.online ? color.main : '#9ca3af' }}>
                          {pos.online ? '● En route' : '○ Hors ligne'}
                        </p>
                        {mission && (
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>
                            {mission.circuit} · {mission.commandes.filter(c => c.statut_livraison === 'livre').length}/{mission.commandes.length} livrées
                          </p>
                        )}
                        {pos.online && pos.speed != null && (
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                            {(pos.speed * 3.6).toFixed(0)} km/h
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Carte — hauteur fixe calculée */}
        <div style={{
          flex: 1, background: 'white', border: '1px solid #e5e7eb',
          borderRadius: '14px', overflow: 'hidden', minWidth: 0,
        }}>
          <AdminGpsMap
            positions={positions}
            livreurs={livreurs}
            missions={missions}
            selectedId={selectedId}
          />
        </div>
      </div>
    </div>
  );
}
