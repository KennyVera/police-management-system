export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

const TOKEN_KEY = "sgp_token";
const USER_KEY = "sgp_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      data.detail ||
      data.non_field_errors?.[0] ||
      (typeof data === "object" ? Object.values(data).flat()?.[0] : null) ||
      "Error de solicitud";
    throw new Error(detail);
  }
  return data;
}

export async function loginRequest({ email, password, remember }) {
  return apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
}

export async function logoutRequest() {
  try {
    await apiFetch("/api/auth/logout/", { method: "POST" });
  } finally {
    clearSession();
  }
}

export async function meRequest() {
  return apiFetch("/api/auth/me/");
}
