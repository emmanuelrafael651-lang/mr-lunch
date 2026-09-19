const CACHE_NAME = "mr-lunch-v3";

const APP_FILES = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/manifest.json"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const request = event.request;

    // Las llamadas a la API siempre van directo al servidor.
    if (new URL(request.url).pathname.startsWith("/api/")) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                const copy = response.clone();

                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, copy);
                });

                return response;
            })
            .catch(() => caches.match(request))
    );
});