/**
 * Service worker mínimo para la PWA del operario CN (SDD-0028 Fase 1).
 *
 * V1 stub: solo presencia. Permite que el browser detecte la web como
 * "installable" y la muestre con el ícono del manifest.
 *
 * NO cachea respuestas aún — todas las requests van directo al network.
 * Eso significa que sin wifi la PWA no funciona (mismo que web normal).
 *
 * V2 (futuro SDD): cache del app shell estático + queue offline de
 * receipts pendientes con Background Sync.
 */

const SW_VERSION = "dtd-operario-v1";

self.addEventListener("install", (event) => {
  console.log("[SW]", SW_VERSION, "install");
  // Skip waiting: nuevo SW activa inmediato (en V2 considerar prompt al user).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW]", SW_VERSION, "activate");
  // Claim clients sin requerir reload
  event.waitUntil(self.clients.claim());
});

// Por ahora, fetch passthrough sin cache.
// La presencia del listener es lo que hace al browser tratar el origin
// como "service-worker-controlled" (parte del install criteria de Chrome).
self.addEventListener("fetch", (event) => {
  // No-op: dejar pasar
});
