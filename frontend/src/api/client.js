// Single entry point to the backend: everything goes through the API gateway.
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, token, signal } = {}) {
  const headers = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined || isForm ? body : JSON.stringify(body),
    signal,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  intentions: (locale, opts) => request(`/content/intentions?locale=${locale}`, opts),
  news: (locale, limit, opts) => request(`/content/news?locale=${locale}${limit ? `&limit=${limit}` : ''}`, opts),
  newsItem: (slug, locale, opts) => request(`/content/news/${encodeURIComponent(slug)}?locale=${locale}`, opts),
  project: (slug, locale, opts) => request(`/content/projects/${encodeURIComponent(slug)}?locale=${locale}`, opts),
  partners: (opts) => request('/content/partners', opts),
  sendMessage: (body) => request('/contact', { method: 'POST', body }),

  fabrication: {
    catalog: (locale, opts) => request(`/fabrication/catalog?locale=${locale}`, opts),
    submit: (formData) => request('/fabrication/requests', { method: 'POST', body: formData }),
    track: (token, locale, opts) => request(`/fabrication/track/${encodeURIComponent(token)}?locale=${locale}`, opts),
  },

  me: (token) => request('/auth/me', { token }),
  admin: {
    news: (token) => request('/admin/news', { token }),
    createNews: (token, body) => request('/admin/news', { method: 'POST', token, body }),
    updateNews: (token, id, body) => request(`/admin/news/${id}`, { method: 'PATCH', token, body }),
    deleteNews: (token, id) => request(`/admin/news/${id}`, { method: 'DELETE', token }),
    messages: (token, status) => request(`/admin/messages${status ? `?status=${status}` : ''}`, { token }),
    updateMessage: (token, id, status) => request(`/admin/messages/${id}`, { method: 'PATCH', token, body: { status } }),
    fabrication: {
      list: (token, params = {}) => {
        const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
        return request(`/admin/fabrication/requests${query ? `?${query}` : ''}`, { token });
      },
      get: (token, id) => request(`/admin/fabrication/requests/${id}`, { token }),
      quote: (token, id, body) => request(`/admin/fabrication/requests/${id}/quote`, { method: 'POST', token, body }),
      setStatus: (token, id, status, message) =>
        request(`/admin/fabrication/requests/${id}/status`, { method: 'POST', token, body: { status, message } }),
      addNote: (token, id, note) => request(`/admin/fabrication/requests/${id}/notes`, { method: 'POST', token, body: { note } }),
    },
  },
};
