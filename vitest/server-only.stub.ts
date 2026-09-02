/**
 * Stub vacío de `server-only` para Vitest.
 *
 * `server-only` no existe como módulo en disco — Next.js lo aliasea en su propio
 * bundler para tirar en build si un módulo server se importa desde un client
 * component. Vitest no tiene ese alias, así que la resolución estática de
 * `import "server-only"` falla en import-analysis (antes de que `vi.mock` runtime
 * pueda interceptar). Lo apuntamos acá (vía `resolve.alias` en `vitest.config.mts`)
 * para poder testear módulos server-only (p.ej. `lib/studio/identity/providers/*`)
 * sin levantar el bundler de Next. No tiene efecto en producción.
 */

export {};
