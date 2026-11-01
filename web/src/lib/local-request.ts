const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

function isLocal(url: string) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * L'API locale n'a ni compte ni mot de passe : elle refuse un nom d'hôte étranger (une page qui
 * fait pointer son domaine sur 127.0.0.1) et les écritures envoyées depuis un autre site.
 */
export function isLocalRequest(method: string, host: string | null, origin: string | null) {
  if (!host || !isLocal(`http://${host}`)) return false;
  return !origin || READ_ONLY.has(method) || isLocal(origin);
}
