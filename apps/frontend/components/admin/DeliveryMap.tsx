'use client';

import { useEffect, useRef, useState } from 'react';

interface Etape {
  structure_id: string;
  structure_nom: string;
  lat: number;
  lon: number;
  ordre: number;
  livre: boolean;
}

interface DeliveryMapProps {
  etapes: Etape[];
  onMarkDelivered?: (structureId: string) => void;
}

// Coordonnées du restaurant — Cotonou, Bénin
const RESTAURANT = { lat: 6.3654, lon: 2.4183, nom: 'Restaurant' };

/**
 * Récupère le tracé de route réel via OSRM (OpenStreetMap Routing Machine, gratuit).
 */
async function fetchRoute(
  points: Array<{ lat: number; lon: number }>,
): Promise<Array<[number, number]>> {
  if (points.length < 2) return points.map((p) => [p.lat, p.lon]);

  const coords = points.map((p) => `${p.lon},${p.lat}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    if (data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
    }
  } catch { /* fallback ligne droite */ }

  return points.map((p) => [p.lat, p.lon]);
}

export function DeliveryMap({ etapes, onMarkDelivered }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then(async (L) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!).setView([RESTAURANT.lat, RESTAURANT.lon], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const sorted = [...etapes].sort((a, b) => a.ordre - b.ordre);
      const allPoints = [RESTAURANT, ...sorted.map((e) => ({ lat: e.lat, lon: e.lon }))];

      // --- Marqueur restaurant ---
      const restaurantIcon = L.divIcon({
        html: `<div style="background:#1f2937;color:white;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">R</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: '',
      });
      L.marker([RESTAURANT.lat, RESTAURANT.lon], { icon: restaurantIcon })
        .addTo(map)
        .bindPopup('<strong>Restaurant</strong><br>Point de depart');

      // --- Marqueurs structures ---
      sorted.forEach((etape) => {
        const color = etape.livre ? '#16a34a' : '#2563eb';
        const icon = L.divIcon({
          html: `<div style="background:${color};color:white;width:34px;height:34px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${etape.ordre}</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17], className: '',
        });

        const popupContent = `
          <div style="min-width:160px">
            <strong style="font-size:14px">${etape.structure_nom}</strong><br>
            <span style="color:#6b7280;font-size:12px">Arret n°${etape.ordre}</span><br><br>
            ${etape.livre
              ? '<span style="color:#16a34a;font-weight:bold">Livraison confirmee</span>'
              : onMarkDelivered
                ? `<button id="btn-${etape.structure_id}" style="background:#2563eb;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;width:100%;margin-top:4px">Confirmer la livraison</button>`
                : '<span style="color:#d97706">En attente</span>'
            }
          </div>`;

        const marker = L.marker([etape.lat, etape.lon], { icon }).addTo(map);
        marker.bindPopup(popupContent);

        if (onMarkDelivered && !etape.livre) {
          marker.on('popupopen', () => {
            const btn = document.getElementById(`btn-${etape.structure_id}`);
            if (btn) btn.onclick = () => onMarkDelivered(etape.structure_id);
          });
        }
      });

      // --- Tracé de la route via OSRM ---
      const routePoints = await fetchRoute(allPoints);
      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
      const routeLayer = L.polyline(routePoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      routeLayerRef.current = routeLayer;

      // Ajuster la vue pour inclure tous les points
      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints.map((p) => [p.lat, p.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [etapes, onMarkDelivered]);

  return (
    <div>
      {/* Légende */}
      <div className="flex items-center gap-6 mb-2 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-gray-900 inline-block"></span> Restaurant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-blue-600 inline-block"></span> A livrer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-green-600 inline-block"></span> Livre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-1 bg-blue-600 inline-block rounded"></span> Itineraire
        </span>
      </div>
      <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 'calc(100vh - 400px)', minHeight: 500 }} />
    </div>
  );
}
