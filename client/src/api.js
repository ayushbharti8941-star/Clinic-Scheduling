const TOKEN_KEY = "clinic.token";
const USER_KEY = "clinic.user";

// In production, set VITE_API_URL to the Render backend origin
// (no trailing slash), e.g. https://clinic-scheduling.onrender.com
// Locally, leave it unset so Vite's /api proxy is used.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
