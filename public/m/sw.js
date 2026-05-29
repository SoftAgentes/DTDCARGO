/**
 * Service worker de las PWAs operario (SDD-0028 Fase 1 + Sprint 4 v3).
 *
 * - install/activate: skipWaiting + claim para activar inmediato.
 * - fetch: passthrough sin cache (V2 sumará app shell offline).
 * - push (Sprint 4): muestra notification con title/body/url del payload.
 * - notificationclick (Sprint 4): focusea una tab abierta de la PWA o
 *   abre una nueva en la URL del payload.
 *
 * El payload viene del worker drain server-side (lib/.../send-operario-push):
 *   { title, body, tag?, requireInteraction?, data: { url } }
 */

const SW_VERSION = "dtd-operario-v2-push";

self.addEventListener("install", (event) => {
  console.log("[SW]", SW_VERSION, "install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW]", SW_VERSION, "activate");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // No-op: passthrough sin cache (V2).
});

// ─────────────────────────────────────────────────────────────
// Push (Sprint 4 v3)
// ─────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // Si no es JSON, usar el texto crudo como body
    payload = { title: "DTD", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "DTD Cargo";
  const options = {
    body: payload.body || "",
    tag: payload.tag || undefined,
    renotify: !!payload.tag, // si hay tag, re-notifica al reemplazar
    requireInteraction: !!payload.requireInteraction,
    icon: "/brand/dtdcargo-isologo-primary.png",
    badge: "/brand/dtdcargo-isologo-mono-dark.png",
    data: payload.data || { url: "/m" },
    // Vibración corta (Android) · WCAG-safe (patrón breve, no continuo)
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/m";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una tab de la PWA abierta, enfocarla y navegar
        for (const client of clientList) {
          if (client.url.includes("/m") && "focus" in client) {
            client.focus();
            if ("navigate" in client && targetUrl) {
              return client.navigate(targetUrl).catch(() => {});
            }
            return;
          }
        }
        // Si no, abrir una nueva ventana
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
