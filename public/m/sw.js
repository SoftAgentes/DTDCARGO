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

self.addEventListener("install", () => {
  console.log("[SW]", SW_VERSION, "install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW]", SW_VERSION, "activate");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: passthrough sin cache (V2).
});

// ─────────────────────────────────────────────────────────────
// Push (Sprint 4 v3)
// ─────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
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

// ─────────────────────────────────────────────────────────────
// pushsubscriptionchange (SDD-0146 Fase 5)
// ─────────────────────────────────────────────────────────────
// El browser rota el endpoint → re-suscribimos con la MISMA VAPID key y
// posteamos al endpoint UNIFICADO, que resuelve identidad por cookie dtd_op
// (operario) o sesión Supabase (staff). Best-effort: si falla, el user re-activa
// en la próxima visita.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSub = event.oldSubscription || null;
        const oldEndpoint = oldSub ? oldSub.endpoint : null;
        const appServerKey =
          (oldSub && oldSub.options && oldSub.options.applicationServerKey) ||
          (event.newSubscription &&
            event.newSubscription.options &&
            event.newSubscription.options.applicationServerKey) ||
          undefined;

        const newSub =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey,
          }));

        await fetch("/api/m/push/resubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            old_endpoint: oldEndpoint,
            subscription: newSub.toJSON(),
          }),
        });
      } catch {
        // best-effort: sin re-suscripción el user la re-activa manualmente.
      }
    })(),
  );
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
