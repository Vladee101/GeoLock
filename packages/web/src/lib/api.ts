const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw await res.json();
  if (res.status === 204) return undefined as T; // DELETE /drops/:slug (T-07) has no body
  return res.json() as Promise<T>;
}
