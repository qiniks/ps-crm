// Resolves a user-supplied "next" redirect target safely: only ever
// returns a URL on the same origin as the request, falling back to
// `fallbackPath` for anything else. Callers must use the returned URL
// object directly in NextResponse.redirect() — never convert it back to
// a string and re-parse it, since a validated URL's own pathname can
// itself begin with "//" (WHATWG allows this), and re-parsing THAT as a
// bare string elsewhere is a protocol-relative redirect all over again.
export function resolveSafeRedirect(
  rawNext: string | null,
  requestUrl: string,
  fallbackPath: string
): URL {
  const requestOrigin = new URL(requestUrl).origin;
  const fallback = new URL(fallbackPath, requestUrl);

  if (!rawNext) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(rawNext, requestUrl);
  } catch {
    return fallback;
  }

  if (resolved.origin !== requestOrigin) return fallback;
  // A same-origin absolute URL's pathname can itself start with "//" —
  // reject it too, as defense in depth against any future caller that
  // does convert this URL back to a string.
  if (resolved.pathname.startsWith("//")) return fallback;

  return resolved;
}
