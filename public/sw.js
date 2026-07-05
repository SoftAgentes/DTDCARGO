/**
 * Service Worker para Bug Reporter push notifications (SDD-0036 Fase 5).
 *
 * Recibe push events del navegador y muestra Notification con título +
 * body + click handler que abre la URL del bug en el Studio.
 *
 * Registro: se hace desde el client cuando el user activa push desde
 * Mi perfil → Preferencias.
 *
 * Update strategy: skipWaiting + clients.claim para que cambios bajen
 * sin esperar al next reload.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "DTD Studio", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "DTD Studio";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/brand/dtdcargo-isologo-primary.png",
    badge: payload.badge || "/brand/dtdcargo-isologo-mono-dark.png",
    tag: payload.tag || "dtd-bug",
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// pushsubscriptionchange (SDD-0146 Fase 5): el browser rotó el endpoint →
// re-suscribimos y actualizamos la sub en el Studio. La sesión Supabase (cookie
// path "/") viaja con el fetch → el route resuelve la identidad del user.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSub = event.oldSubscription || null;
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
        // El SW es compartido Studio + portal. Posteamos a AMBAS rutas: cada una
        // acepta a SU población (staff via user_tenants / cliente via client_users) y
        // rechaza a la otra (403, ignorado). Así el re-suscribe funciona para los dos.
        const payload = JSON.stringify({ subscription: newSub.toJSON() });
        await Promise.allSettled([
          fetch("/api/studio/push/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
          }),
          fetch("/api/portal/push/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
          }),
        ]);
      } catch {
        // best-effort: el user re-activa desde Mi perfil si hace falta.
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/studio";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una pestaña del Studio abierta, foco + navigate ahí
        for (const client of clientList) {
          if (client.url.includes("/studio") && "focus" in client) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused) {
                return focused.navigate(url);
              }
            });
          }
        }
        // Si no, abre nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
