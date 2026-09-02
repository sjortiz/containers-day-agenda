const NAME_HASH_KEY = 'talk-track-name';

export function eventShareUrl(sourceUrl: string, name: string): string {
  const url = new URL(sourceUrl);
  const params = new URLSearchParams(url.hash.slice(1));
  params.set(NAME_HASH_KEY, name);
  url.hash = params.toString();
  return url.href;
}

export function parseEventShareUrl(raw: string): { sourceUrl: string; name: string | null } {
  const url = new URL(raw);
  const params = new URLSearchParams(url.hash.slice(1));
  const name = params.get(NAME_HASH_KEY)?.trim() || null;
  params.delete(NAME_HASH_KEY);
  url.hash = params.toString();
  return { sourceUrl: url.href, name };
}
