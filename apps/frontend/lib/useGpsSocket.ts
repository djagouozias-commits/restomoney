'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export interface GpsUpdate {
  livreur_id: string;
  livreur_nom?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  mission_id?: string | null;
  timestamp: string;
}

// ── Hook for ADMIN: receive live GPS updates ──────────────────────────────────
export function useGpsAdmin(
  onUpdate: (pos: GpsUpdate) => void,
  onOffline: (livreurId: string) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('gps:update', (data: GpsUpdate) => {
      onUpdate(data);
    });

    socket.on('gps:offline', ({ livreur_id }: { livreur_id: string }) => {
      onOffline(livreur_id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[GPS Socket] connect error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return socketRef;
}

// ── Hook for LIVREUR: send GPS position ──────────────────────────────────────
export function useGpsTracker(missionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const lastSentRef = useRef<number>(0);
  const THROTTLE_MS = 2500; // envoie toutes les ~2.5 secondes

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || socketRef.current) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[GPS] Connected, starting geolocation watch');
      activeRef.current = true;

      if (!navigator.geolocation) {
        console.warn('[GPS] Geolocation not supported');
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (!activeRef.current) return;

          // Throttle : n'envoie pas plus d'une fois toutes les THROTTLE_MS ms
          const now = Date.now();
          if (now - lastSentRef.current < THROTTLE_MS) return;
          lastSentRef.current = now;

          socket.emit('gps:position', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            mission_id: missionId,
            timestamp: new Date().toISOString(),
          });
        },
        (err) => console.warn('[GPS] watchPosition error:', err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 2000,   // accepte une position vieille de 2s max
          timeout: 10000,
        },
      );
    });

    socket.on('disconnect', () => {
      activeRef.current = false;
    });

    socket.on('connect_error', (err) => {
      console.warn('[GPS Socket] connect error:', err.message);
    });
  }, [missionId]);

  const disconnect = useCallback(() => {
    activeRef.current = false;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect };
}
