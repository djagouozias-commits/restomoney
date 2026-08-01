'use client';

/**
 * LocationPicker — Carte Leaflet robuste pour sélection GPS
 *
 * Solution définitive au problème de tuiles morcelées :
 * - Le conteneur de la carte a TOUJOURS une hauteur fixe en px (pas %, pas calc)
 * - invalidateSize() est appelé au bon moment via requestAnimationFrame
 * - ResizeObserver surveille tout changement de taille du conteneur
 * - window 'resize' déclenche aussi invalidateSize()
 * - La carte est détruite proprement au démontage (pas de double init)
 */

import { useEffect, useRef, useState } from 'react';

const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || '';

const DEFAULT_LAT = 6.3654;
const DEFAULT_LON = 2.4183;
const MAP_HEIGHT = 480; // hauteur fixe en px — JAMAIS de % ici

interface Props {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
}

interface Suggestion {
  formatted: string;
  lat: number;
  lon: number;
}

const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export function LocationPicker({ lat, lon, onChange }: Props) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const LRef         = useRef<any>(null);
  const roRef        = useRef<ResizeObserver | null>(null);
  const mounted      = useRef(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [gpsLoading,      setGpsLoading]      = useState(false);
  const [gpsError,        setGpsError]        = useState('');
  const [query,           setQuery]           = useState('');
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Force-invalidate helper ───────────────────────────────────────────────
  function forceResize() {
    const map = mapRef.current;
    if (!map) return;
    // requestAnimationFrame garantit que le DOM est peint avant le calcul
    requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });
  }

  // ── Init Leaflet ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mounted.current || !containerRef.current) return;
    mounted.current = true;

    // Vérification : le conteneur doit déjà avoir sa hauteur avant init
    // (MAP_HEIGHT px est défini inline, donc c'est garanti)

    import('leaflet').then((mod) => {
      const L = mod.default ?? mod;
      LRef.current = L;

      // Fix Next.js icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const initLat = lat && lat !== 0 ? lat : DEFAULT_LAT;
      const initLon = lon && lon !== 0 ? lon : DEFAULT_LON;

      // Création de la carte
      const map = L.map(containerRef.current!, {
        center:      [initLat, initLon],
        zoom:        15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map);

      // Pin rouge précis
      const pinIcon = L.divIcon({
        html: `
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
            <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
                  fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
            <circle cx="14" cy="14" r="5" fill="white"/>
          </svg>`,
        className:  '',
        iconSize:   [28, 40],
        iconAnchor: [14, 40],
      });

      const marker = L.marker([initLat, initLon], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChange(r6(p.lat), r6(p.lng));
      });

      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        onChange(r6(e.latlng.lat), r6(e.latlng.lng));
      });

      // Curseur croix pour précision
      if (containerRef.current) {
        containerRef.current.style.cursor = 'crosshair';
      }

      mapRef.current = map;

      // ── invalidateSize — séquence complète ──────────────────────────────
      // 1. Immédiat (rAF)
      forceResize();
      // 2. Après le prochain cycle d'événements
      setTimeout(forceResize, 50);
      // 3. Après CSS transitions potentielles
      setTimeout(forceResize, 300);
      // 4. Long délai de sécurité (animation panneau parent)
      setTimeout(forceResize, 800);

      // ── ResizeObserver ─────────────────────────────────────────────────
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        roRef.current = new ResizeObserver(forceResize);
        roRef.current.observe(containerRef.current);
      }

      // ── window resize ──────────────────────────────────────────────────
      window.addEventListener('resize', forceResize);
    });

    return () => {
      window.removeEventListener('resize', forceResize);
      roRef.current?.disconnect();
      roRef.current = null;
      mapRef.current?.remove();
      mapRef.current    = null;
      markerRef.current = null;
      mounted.current   = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync marker quand lat/lon changent de l'extérieur ────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!lat || !lon) return;
    markerRef.current.setLatLng([lat, lon]);
    mapRef.current.flyTo([lat, lon], 17, { duration: 0.8 });
    // invalidateSize après flyTo
    setTimeout(forceResize, 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const handleGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("Géolocalisation non disponible sur ce navigateur.");
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(r6(pos.coords.latitude), r6(pos.coords.longitude));
        setGpsLoading(false);
      },
      () => {
        setGpsError("Impossible d'obtenir la position. Vérifiez les permissions GPS.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── Recherche d'adresse (Geoapify autocomplete) ───────────────────────────
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      if (!GEOAPIFY_KEY) return;
      setSearchLoading(true);
      try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&lang=fr&limit=6&apiKey=${GEOAPIFY_KEY}`;
        const res  = await fetch(url);
        const data = await res.json();
        setSuggestions((data.features ?? []).map((f: any) => ({
          formatted: f.properties.formatted,
          lat:       f.properties.lat,
          lon:       f.properties.lon,
        })));
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const pickSuggestion = (s: Suggestion) => {
    onChange(r6(s.lat), r6(s.lon));
    setQuery(s.formatted);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%' }}>

      {/* Label + coordonnées + bouton GPS */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
            Localisation sur la carte <span style={{ color: '#ef4444' }}>*</span>
          </div>
          {lat && lat !== 0 ? (
            <div style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace', marginTop: '2px' }}>
              {lat.toFixed(6)}, {lon.toFixed(6)}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
              Cliquez sur la carte ou recherchez une adresse
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: gpsLoading ? '#93c5fd' : '#2563eb',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '8px 16px', fontSize: '14px', fontWeight: 600,
            cursor: gpsLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {gpsLoading
            ? '⏳ Localisation...'
            : '📍 Ma position actuelle'}
        </button>
      </div>

      {gpsError && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '10px' }}>
          {gpsError}
        </div>
      )}

      {/* Recherche d'adresse */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="🔍  Rechercher une adresse, un quartier..."
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #d1d5db', borderRadius: '8px',
            padding: '10px 14px', fontSize: '15px', outline: 'none',
          }}
        />
        {searchLoading && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                         fontSize: '13px', color: '#6b7280' }}>
            ⏳
          </span>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <ul style={{
            position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', listStyle: 'none',
            margin: '4px 0 0', padding: 0, overflow: 'hidden',
          }}>
            {suggestions.map((s, i) => (
              <li key={i} style={{ borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <button
                  type="button"
                  onMouseDown={() => pickSuggestion(s)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '14px', color: '#374151',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  📍 {s.formatted}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── LA CARTE ─────────────────────────────────────────────────────────
          Règle absolue : hauteur fixe en px, jamais en %
          C'est la seule façon de garantir que Leaflet voit une taille réelle.
      ────────────────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          width:        '100%',
          height:       `${MAP_HEIGHT}px`,   // ← FIXE EN PX, jamais %
          borderRadius: '12px',
          border:       '1px solid #d1d5db',
          overflow:     'hidden',
          display:      'block',
          position:     'relative',           // requis par Leaflet
          background:   '#e8e8e8',            // gris visible pendant le chargement
        }}
      />

      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
        Cliquez sur la carte pour placer le point, ou faites glisser le marqueur.
      </div>
    </div>
  );
}
