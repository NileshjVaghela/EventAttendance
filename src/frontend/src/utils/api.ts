const API_BASE = import.meta.env.VITE_API_URL || "";

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("idToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
