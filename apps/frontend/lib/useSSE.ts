'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from './api';

interface SSEState<T> {
  lastEvent: T | null;
  events: T[];
  connected: boolean;
  error: string | null;
}

/**
 * Hook SSE : ouvre un EventSource, écoute les événements,
 * retourne le dernier état reçu.
 *
 * Requirements: 7.3, 9.2
 */
export function useSSE<T = unknown>(
  eventName: string,
  url?: string,
): SSEState<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const sseUrl = url || `${API_BASE}/events`;

  const [state, setState] = useState<SSEState<T>>({
    lastEvent: null,
    events: [],
    connected: false,
    error: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = getAccessToken();
    const fullUrl = token ? `${sseUrl}?token=${encodeURIComponent(token)}` : sseUrl;

    const es = new EventSource(fullUrl, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('connected', () => {
      setState((s) => ({ ...s, connected: true, error: null }));
    });

    es.addEventListener(eventName, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as T;
        setState((s) => ({
          ...s,
          lastEvent: data,
          events: [...s.events.slice(-49), data], // Garder 50 derniers
        }));
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      setState((s) => ({ ...s, connected: false, error: 'Connexion SSE perdue' }));
      es.close();
      // Reconnexion automatique après 5 secondes
      retryRef.current = setTimeout(connect, 5000);
    };
  }, [sseUrl, eventName]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return state;
}
