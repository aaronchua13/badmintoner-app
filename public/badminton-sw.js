const CACHE_PREFIX = "badminton-queue-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v3`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v3`;
const MAX_ASSETS = 160;
const isAsset = (url) =>
  url.origin === self.location.origin &&
  url.pathname.startsWith("/_next/static/");
const isRsc = (request) =>
  request.headers.get("RSC") === "1" ||
  new URL(request.url).searchParams.has("_rsc");
async function saveAsset(request, response) {
  if (
    !response.ok ||
    response.type === "opaque" ||
    response.headers.get("content-type")?.includes("text/html")
  )
    return;
  const cache = await caches.open(ASSET_CACHE);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - MAX_ASSETS))
      .map((key) => cache.delete(key)),
  );
}
async function cacheShell(response) {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    return;
  const html = await response.clone().text();
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(
      (match) =>
        new URL(match[1].replaceAll("&amp;", "&"), self.location.origin),
    )
    .filter(isAsset);
  // Cache critical resources before replacing the shell so an incomplete update stays recoverable.
  await Promise.all(
    [...new Set(urls.map((url) => url.href))].map(async (url) => {
      const result = await fetch(url);
      if (!result.ok) throw new Error("Missing shell asset");
      await saveAsset(url, result);
    }),
  );
  await (await caches.open(SHELL_CACHE)).put("/queuing", response);
}
self.addEventListener("install", (event) => {
  event.waitUntil(cacheShellFromNetwork().then(() => self.skipWaiting()));
});
async function cacheShellFromNetwork() {
  await cacheShell(await fetch("/queuing", { cache: "reload" }));
}
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (
          name.startsWith(CACHE_PREFIX) &&
          name !== SHELL_CACHE &&
          name !== ASSET_CACHE
        )
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isRsc(request)
  )
    return;
  if (request.mode === "navigate" && url.pathname === "/queuing") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok)
            event.waitUntil(cacheShell(response.clone()).catch(() => {}));
          return response;
        } catch {
          return (
            (await (await caches.open(SHELL_CACHE)).match("/queuing")) ??
            new Response(
              "Open the queuing page online once to enable offline use.",
              { status: 503, headers: { "Content-Type": "text/plain" } },
            )
          );
        }
      })(),
    );
  } else if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const client = event.clientId
          ? await self.clients.get(event.clientId)
          : null;
        if (client && new URL(client.url).pathname !== "/queuing")
          return fetch(request);
        const cached = await (await caches.open(ASSET_CACHE)).match(request);
        if (cached) return cached;
        const response = await fetch(request);
        event.waitUntil(saveAsset(request, response.clone()).catch(() => {}));
        return response;
      })(),
    );
  }
});
