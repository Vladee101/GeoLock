const KEY = 'owned_drops';

export interface OwnedDrop { slug: string; owner_token: string }

export function getOwned(): OwnedDrop[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

export function saveOwned(drop: OwnedDrop) {
  const list = getOwned();
  localStorage.setItem(KEY, JSON.stringify([...list, drop]));
}

export function getOwnerToken(slug: string): string | null {
  return getOwned().find(d => d.slug === slug)?.owner_token ?? null;
}
