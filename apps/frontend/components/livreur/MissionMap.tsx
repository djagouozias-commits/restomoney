'use client';

/**
 * MissionMap — Carte Leaflet + OpenRouteService pour livreurs
 *
 * Fonctionnalités :
 * - Itinéraire calculé via OpenRouteService (driving-car)
 * - Distance restante et ETA mis à jour en temps réel
 * - Recalcul auto si le livreur s'écarte de plus de 80m de la route
 * - Marqueurs : position livreur (vert), destination (rouge pin)
 * - Hauteur fixe en px pour éviter le bug Leaflet de tuiles morcelées
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const ORS_KEY      = process.env.NEXT_PUBLIC_ORS_KEY      || '';
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || '';
const MAP_HEIGHT   = 360; // px fixe
const REROUTE_THRESHOLD_M = 80; // recalcule si déviation > 80m

export interface Waypoint {
  lat: number;
  lon: number;
  label: string;
}

interface Props {
  waypoints:  Waypoint[];
  currentLat: number | null;
  currentLon: number | null;
}

// ── ORS route helper ──────────────────────────────────────────────────────────

interface RouteResult {
  latlngs:   [number, number][];
  distanceM: number;
  durationS: number;
}

async function fetchOrsRoute(
  from: { lat: number; lon: number },
  waypoints: Waypoint[],
): Promise<RouteResult | null> {
  if (!ORS_KEY || waypoints.length === 0) return null;

  const coords = [
    [from.lon, from.lat],
    ...waypoints.map((w) => [w.lon, w.lat]),
  ];

  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_KEY,
      },
      body: JSON.stringify({ coordinates: coords }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const summary   = feature.properties?.summary ?? {};
    const latlngs: [number, number][] = feature.geometry.coordinates.map(
      (c: number[]) => [c[1], c[0]],
    );

    return {
      latlngs,
      distanceM: summary.distance ?? 0,
      durationS: summary.duration ?? 0,
    };
  } catch (err) {
    console.error('[ORS]', err);
    return null;
  }
}

// ── Haversine distance (m) ────────────────────────────────────────────────────

function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
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

// Minimum distance from a point to a polyline segment
function distToSegment(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): number {
  const dx = bLon - aLon;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversine(pLat, pLon, aLat, aLon);
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  return haversine(pLat, pLon, aLat + t * dy, aLon + t * dx);
}

function distToRoute(lat: number, lon: number, route: [number, number][]): number {
  if (route.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = distToSegment(lat, lon, route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MissionMap({ waypoints, currentLat, currentLon }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const routeLayerRef   = useRef<any>(null);
  const livMarkerRef    = useRef<any>(null);
  const destMarkersRef  = useRef<any[]>([]);
  const LRef            = useRef<any>(null);
  const initDoneRef     = useRef(false);
  const routeRef        = useRef<[number, number][]>([]);
  const prevPosRef      = useRef<{ lat: number; lon: number } | null>(null);

  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);

  const forceResize = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
  }, []);

  // ── Draw route on map ────────────────────────────────────────────────────
  const drawRoute = useCallback((result: RouteResult) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    routeRef.current = result.latlngs;
    setDistanceM(result.distanceM);
    setDurationS(result.durationS);

    if (routeLayerRef.current) routeLayerRef.current.remove();
    routeLayerRef.current = L.polyline(result.latlngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);

    forceResize();
  }, [forceResize]);

  // ── Fetch + draw initial route ────────────────────────────────────────────
  const fetchAndDrawRoute = useCallback(async (fromLat: number, fromLon: number) => {
    const result = await fetchOrsRoute({ lat: fromLat, lon: fromLon }, waypoints);
    if (result) drawRoute(result);
  }, [waypoints, drawRoute]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDoneRef.current || !containerRef.current) return;
    initDoneRef.current = true;

    import('leaflet').then((mod) => {
      const L = mod.default ?? mod;
      LRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const center: [number, number] = waypoints.length > 0
        ? [waypoints[0].lat, waypoints[0].lon]
        : [6.3654, 2.4183];

      const map = L.map(containerRef.current!, { center, zoom: 13 });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;

      // Destination markers (rouge pin SVG)
      waypoints.forEach((wp, i) => {
        const icon = L.divIcon({
          html: `
            <div style="position:relative;text-align:center;width:32px">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
                <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
                      fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
                <text x="14" y="19" text-anchor="middle" fill="white"
                      font-size="13" font-weight="700" font-family="system-ui">${i + 1}</text>
              </svg>
            </div>`,
          className:  '',
          iconSize:   [32, 40],
          iconAnchor: [16, 40],
        });
        const m = L.marker([wp.lat, wp.lon], { icon })
          .addTo(map)
          .bindPopup(`<strong>${i + 1}. ${wp.label}</strong>`);
        destMarkersRef.current.push(m);
      });

      // Fit bounds to waypoints
      if (waypoints.length > 1) {
        map.fitBounds(L.latLngBounds(waypoints.map((w) => [w.lat, w.lon])), { padding: [40, 40] });
      }

      // invalidateSize sequence
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
        mapRef.current   = null;
        initDoneRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update livreur marker + reroute logic ─────────────────────────────────
  useEffect(() => {
    if (currentLat == null || currentLon == null || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    // Livreur marker (point vert pulsant)
    const livIcon = L.divIcon({
      html: `
        <div style="position:relative;width:24px;height:24px">
          <div style="
            position:absolute;inset:0;border-radius:50%;
            background:rgba(22,163,74,.3);
            animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
          "></div>
          <div style="
            position:absolute;top:4px;left:4px;
            width:16px;height:16px;border-radius:50%;
            background:#16a34a;border:3px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,.3);
          "></div>
        </div>
        <style>
          @keyframes ping {
            75%,100%{transform:scale(2);opacity:0}
          }
        </style>`,
      className:  '',
      iconSize:   [24, 24],
      iconAnchor: [12, 12],
    });

    if (livMarkerRef.current) {
      livMarkerRef.current.setLatLng([currentLat, currentLon]);
      livMarkerRef.current.setIcon(livIcon);
    } else {
      livMarkerRef.current = L.marker([currentLat, currentLon], { icon: livIcon })
        .addTo(map)
        .bindPopup('Votre position');
    }

    // Fetch initial route quand on obtient la première position
    if (!prevPosRef.current && waypoints.length > 0) {
      fetchAndDrawRoute(currentLat, currentLon);
    }

    // Recalcul auto si déviation > seuil
    if (
      routeRef.current.length > 0 &&
      distToRoute(currentLat, currentLon, routeRef.current) > REROUTE_THRESHOLD_M &&
      !rerouting &&
      waypoints.length > 0
    ) {
      setRerouting(true);
      fetchOrsRoute({ lat: currentLat, lon: currentLon }, waypoints)
        .then((result) => {
          if (result) drawRoute(result);
        })
        .finally(() => setRerouting(false));
    }

    prevPosRef.current = { lat: currentLat, lon: currentLon };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLat, currentLon]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%' }}>
      {/* Info bar — distance + ETA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        padding: '10px 16px',
        background: rerouting ? '#fef3c7' : '#eff6ff',
        borderBottom: '1px solid #dbeafe',
        fontSize: '14px', fontWeight: 600,
      }}>
        {rerouting && (
          <span style={{ color: '#d97706' }}>⟳ Recalcul en cours...</span>
        )}
        {!rerouting && distanceM !== null && (
          <>
            <span style={{ color: '#1d4ed8' }}>📍 {formatDistance(distanceM)}</span>
            {durationS !== null && (
              <span style={{ color: '#1d4ed8' }}>⏱ {formatDuration(durationS)}</span>
            )}
          </>
        )}
        {!rerouting && distanceM === null && waypoints.length > 0 && (
          <span style={{ color: '#6b7280' }}>Calcul de l'itinéraire...</span>
        )}
      </div>

      {/* Carte — hauteur fixe en px */}
      <div
        ref={containerRef}
        style={{
          width:    '100%',
          height:   `${MAP_HEIGHT}px`,
          display:  'block',
          position: 'relative',
          background: '#e8e8e8',
        }}
      />
    </div>
  );
}
