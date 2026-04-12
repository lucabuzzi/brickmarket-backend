const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  if (!path.startsWith('/')) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiFetch(path, { body, ...options } = {}) {
  const headers = { ...options.headers };
  const token = localStorage.getItem('brickmarket_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let finalBody = body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(apiUrl(path), { ...options, headers, body: finalBody });
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
