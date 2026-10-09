/** Matches `#/a/b` against route paths such as `a/:id`; returns the route and its decoded params. */
export function matchRoute(routes, hash) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  for (const route of routes) {
    const pattern = route.path.split("/");
    if (pattern.length !== parts.length) continue;
    const params = {};
    const ok = pattern.every((p, i) => {
      if (p.startsWith(":")) {
        try {
          params[p.slice(1)] = decodeURIComponent(parts[i]);
        } catch {
          return false;
        }
        return true;
      }
      return p === parts[i];
    });
    if (ok) return { route, params };
  }
  return null;
}
