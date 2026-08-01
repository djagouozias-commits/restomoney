const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Access token stocké en mémoire (pas localStorage)
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Envoie le cookie refreshToken
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Wrapper fetch avec :
 * - Injection du JWT access token
 * - Refresh automatique si 401
 * - Normalisation des erreurs
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // N'ajoute pas Content-Type si FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Tentative de refresh si 401
  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
    // Refresh échoué → rediriger vers login
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiException('AUTH_SESSION_EXPIRED', 'Session expirée', 401);
  }

  if (!res.ok) {
    let errorData: { error?: string | ApiError; code?: string; message?: string } = {};
    try { errorData = await res.json(); } catch { /* ignore */ }

    // Support deux formats : { error: string, code: string } et { error: { code, message } }
    let code = 'UNKNOWN_ERROR';
    let message = `HTTP ${res.status}`;

    if (typeof errorData?.error === 'string') {
      message = errorData.error;
      code = errorData.code || code;
    } else if (typeof errorData?.error === 'object' && errorData.error !== null) {
      const err = errorData.error as ApiError;
      code = err.code || code;
      message = err.message || message;
    } else if (errorData?.message) {
      message = errorData.message;
    }

    throw new ApiException(code, message, res.status);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
