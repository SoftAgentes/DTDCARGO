# Logs estructurados de crons · SDD-0414 · evidencia local

Fecha: 2026-09-04

Alcance: logger central y adopción en `purge-throttle`,
`bitacora-purge-orphans` y `purge-receipt-orphans`

Fuera de alcance: 14 cron restantes, Edge Functions, proveedor alojado, datos
reales, Cloud, push, `main`, despliegue y limpieza de worktrees

## Resultado

Cada ejecución de los tres cron crea o conserva un identificador seguro,
devuelve `x-request-id` y emite una sola línea JSON por evento. Los eventos
adoptados son:

- `cron.authorization_denied`;
- `cron.completed`;
- `cron.scan_failed`;
- `cron.delete_failed`.

Los registros incluyen únicamente métricas y etiquetas operativas permitidas.
Las claves sensibles se sustituyen por `[REDACTED]`; un error conserva sólo su
tipo y código seguro. Cuando `apiError` recibe el logger estructurado, tampoco
devuelve el detalle crudo en desarrollo, evitando que el mismo dato reaparezca
por un canal lateral.

## Evidencia ejecutada

- RED: módulo inexistente y 7 fallos funcionales por ausencia de header/evento.
- GREEN focal: 21/21 pruebas en cuatro archivos.
- Fallos causales cubiertos: error PostgREST al purgar throttle, error al
  escanear Bitácora y error de Storage al eliminar recibos huérfanos.
- Los sentinels de prueba incluyeron Bearer, correo, ruta de Storage y mensaje
  crudo; ninguno apareció en el log ni en la respuesta correlacionada.
- Suite completa: 7.316/7.316 pruebas en 579 archivos.
- TypeScript, ESLint, docs, gobernanza y registro de componentes: correctos.
- Build de producción: 158 rutas, compilación y generación correctas.

## Semántica preservada

- Autorización sigue cerrada con `CRON_SECRET` por header.
- Los dos recolectores de huérfanos continúan en `dry-run` por defecto.
- Los gates `BITACORA_PURGE_ORPHANS_ENABLED` y
  `PURGE_RECEIPT_ORPHANS_ENABLED` no se activaron.
- Caps, antigüedad mínima, filtros y respuestas funcionales no cambiaron.
- No se consultó Supabase ni se borró objeto alguno: todas las pruebas usan
  dobles locales.

## Alcance residual

El helper ya es reusable, pero el ítem agregado del checklist permanece abierto:
faltan adoptar y probar directamente los otros 14 cron y luego las Edge
Functions. Los consumidores antiguos de `apiError` conservan su comportamiento
hasta que cada dominio migre con su propia prueba; este slice no afirma haber
saneado logs que no tocó.

## Estado

- SDD-0414: **done local**.
- Checklist general: **59/106 (55,7 %)**; no sube porque la casilla agrupa cron
  y Edge Functions completos.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
