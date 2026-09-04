# Workers drain estructurados · SDD-0415 · evidencia local

Fecha: 2026-09-04

Alcance: `bug-notifications-drain`, `client-notifications-drain`, `push-drain`
y `workflow-drain`

Fuera de alcance: los otros diez cron, Edge Functions, ejecución de workers,
proveedores externos, Cloud, push, `main`, despliegue, datos y limpieza

## Resultado

Los cuatro workers comparten ahora un contexto de request que centraliza:

- autorización cerrada con `CRON_SECRET` sólo por header;
- evento `cron.authorization_denied` y respuesta 403 correlacionada;
- evento `cron.completed`, duración y conteos agregados permitidos;
- evento `cron.drain_failed` y respuesta 500 genérica ante una excepción;
- `x-request-id` estable en todos los caminos.

El outbox de bugs suma sus canales email/Telegram antes de registrar métricas;
no incluye destinatarios ni payloads. Los otros workers exponen sólo sus conteos
operativos (`processed`, `delivered`, `skipped`, `noted`, `deferred`, `failed`).

## Evidencia ejecutada

- RED: 12/12 pruebas fallaron antes del cambio por ausencia de correlación,
  evento o contención de excepciones.
- GREEN directo: 16/16 entre las cuatro rutas y el logger central.
- Suite completa: 7.328/7.328 pruebas en 580 archivos.
- TypeScript y ESLint: correctos.
- Build de producción: 158 rutas, compilación y generación correctas.
- Sentinels inyectados: Bearer, correo, ruta tenant y mensaje crudo; ninguno
  aparece en el log JSON ni en la respuesta 500.

## Límites y seguridad operativa

Las funciones drain fueron reemplazadas por dobles locales; no se abrió ninguna
cola, no se llamó Resend, Telegram o Web Push y no hubo escritura. El nuevo catch
sólo cambia el borde HTTP de una excepción no controlada: ahora devuelve un error
genérico correlacionado en vez de delegar una respuesta opaca al framework.

## Estado

- SDD-0415: **done local**.
- Cron adoptados acumulados: 7/17; quedan 10 y luego las Edge Functions.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada sigue abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
