---
sdd: "0414"
title: Logs estructurados y correlacionados para crons
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0146", "0183", "0184"]
confidencialidad: interno
---

# SDD-0414 · Logs estructurados y correlacionados para crons

## Preguntas operativas

Este primer slice debe permitir responder, sin leer payloads ni datos de
negocio:

1. ¿Qué ejecución exacta fue rechazada, terminó o falló?
2. ¿Corrió en `dry-run` o `live` y cuántos objetos revisó o eliminó?
3. ¿El fallo ocurrió autorizando, escaneando o eliminando, y hubo borrado
   parcial antes del error?
4. ¿Puede soporte compartir un único `x-request-id` sin exponer
   `CRON_SECRET`, rutas de Storage, correos ni mensajes crudos del proveedor?

## Contrato acotado

- Emitir una línea JSON por evento con `timestamp`, `level`, `event`,
  `component` y `requestId` estables.
- Aceptar un `x-request-id` válido o generarlo en el límite HTTP, y devolverlo
  en toda respuesta del cron.
- Aplicar allowlist a campos operativos y redactar claves sensibles. Los errores
  conservan sólo nombre y código seguro, nunca mensaje o stack.
- Adoptar el logger en los tres cron con prueba directa existentes:
  `purge-throttle`, `bitacora-purge-orphans` y `purge-receipt-orphans`.
- Mantener respuestas, autorización, dry-run, caps y semántica de borrado.

## Fuera de alcance

- Migrar en esta rebanada los demás cron o las Edge Functions.
- Añadir un proveedor de observabilidad, cambiar variables alojadas o desplegar.
- Leer datos reales, activar gates `live`, aplicar migraciones, hacer push,
  integrar en `main` o limpiar worktrees.

## Allowlist exacta

- `lib/observability/structured-logger.ts` y sus pruebas.
- `lib/http/api-error.ts`.
- Los route handlers y pruebas de los tres cron nombrados en el contrato.
- Esta spec, su acta, los índices generados y el checklist del saneamiento.

## Aceptación

- [x] RED demuestra ausencia de correlación, JSON estable y redacción central.
- [x] Toda salida de los tres cron devuelve `x-request-id`.
- [x] Éxito, rechazo y fallos emiten eventos estables y consultables.
- [x] Ninguna salida probada contiene Bearer, secret, correo, ruta o mensaje
      crudo del error.
- [x] Las pruebas funcionales existentes conservan autorización y borrado.
- [x] Gates proporcionales quedan verdes y el alcance residual se documenta.

## Gobernanza

- `SGE-00.05`: cumplimiento; contrato y evidencia versionados.
- `SGE-00.07`: cumplimiento; una única abstracción reusable.
- `AUD-01` / `AUD-02`: cumplimiento; eventos correlacionables sin PII.
- `SEC-01`: cumplimiento; secretos y errores crudos quedan excluidos.
- `MP-01`: no aplica; no cambia persistencia ni autorización de datos.

## Evidencia de cierre

- 21/21 pruebas focales, incluida la reproducción RED inicial.
- 7.316/7.316 pruebas completas en 579 archivos.
- TypeScript, ESLint, docs, gobernanza y componentes verdes.
- Build de producción correcto con 158 rutas.
- Acta: `docs/audits/2026-09-04-structured-request-logging.md`.
