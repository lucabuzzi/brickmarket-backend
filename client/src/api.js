// Relative on purpose: Vite's dev proxy (and the production server) forward
// /api, /uploads and /health to the backend on whatever host served this page,
// so this works from localhost, a LAN IP (e.g. viewing the site from a phone), or in production.
export const SERVER_URL = '';
export const API_BASE = `${SERVER_URL}/api`;
export const TOKEN_STORAGE_KEY = 'brickmarket_token';
export const AUTH_ENDPOINTS = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  me: '/api/auth/me',
  google: '/api/auth/google',
  apple: '/api/auth/apple',
};

export const LISTING_ENDPOINTS = {
  create: '/api/listings',
  mine: '/api/listings/user/me',
};

/** Resolves an image URL, prepending SERVER_URL if it's a relative local path */
export function normalizeImageUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('http')) return url;
  
  // 1. Uniform slashes and remove double slashes
  let path = url.replace(/\\/g, '/').replace(/\/+/g, '/');
  
  // 2. Remove leading slash
  if (path.startsWith('/')) path = path.substring(1);
  
  // 3. Ensure 'uploads/' prefix if it's a local filename
  // If the path doesn't start with uploads/ AND it's not a full URL, add it.
  if (!path.startsWith('uploads/')) {
    path = `uploads/${path}`;
  }
  
  return `/${path}`;
}

/** Formats a duration in milliseconds as an F1-style race clock: M:SS.CC (minutes:seconds.centiseconds) */
export function formatRaceTime(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '-:--.--';
  const totalCentis = Math.round(ms / 10);
  const minutes = Math.floor(totalCentis / 6000);
  const seconds = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Special case: if path already starts with 'api/', don't double it
  if (cleanPath.startsWith('api/')) {
    return `${SERVER_URL}/${cleanPath}`;
  }
  
  return `${API_BASE}/${cleanPath}`;
}

export async function apiFetch(path, { body, ...options } = {}) {
  const headers = { ...options.headers };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  let finalBody = body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(apiUrl(path), { ...options, headers, body: finalBody, credentials: 'include' });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Errore richiesta');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** POST multipart (FormData). Non impostare Content-Type: il browser aggiunge il boundary. */
export async function apiPostForm(path, formData, options = {}) {
  const headers = { ...options.headers };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Errore richiesta');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
