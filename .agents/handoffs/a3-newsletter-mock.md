# A3 — Newsletter: mensaje correcto cuando Resend está simulado

Rama: `claude/a3-newsletter-mock-staging-27a0da`. PR en borrador contra `main`; no se mergea (merge = publicación).

## Qué cambió

`lib/studio/newsletter/sender.ts`: `mock_no_key` tiene dos causas y ahora el mensaje las distingue.

| Caso | Mensaje |
|---|---|
| Llave ausente (campaña) | `RESEND_API_KEY no está configurada.` (igual que antes) |
| Llave ausente (prueba) | `RESEND_API_KEY no está configurada; la prueba no salió.` (igual que antes) |
| Entorno de prueba (`APP_ENV=staging`, `code: "app_env_staging"`) | `Estás en el entorno de prueba: el envío está simulado a propósito y no sale ningún correo real.` (la prueba añade ` La prueba no salió.`) |

- Campaña: se decide por `result.code === RESEND_SIMULADO_PRUEBA`.
- Prueba interna: `sendEmail` no propaga `code`, así que se replica el orden de `envioSimulado` (llave presente y `resolveAppEnv() === "staging"`). Tocar `send-email.ts` queda fuera de la lista de archivos permitidos.
- Sin secretos: sólo aparece el nombre de la variable en el caso de llave ausente, como antes.

## Consumidores revisados

- UI del Studio: `app/studio/(app)/marketing/newsletter/actions.ts:176` devuelve `result.error` tal cual; hereda el texto nuevo sin cambios. No se tocó pantalla, así que no aplica `/ui-check`.
- `mail_logs` / destinatarios: en la campaña se siguen guardando con el `error` crudo `mock_no_key` (persistencia, no pantalla). Sin cambios.

## Pruebas

- Nueva: `lib/studio/newsletter/__tests__/sender-mock-no-key.test.ts` (4 casos: staging y llave ausente, en prueba y en campaña).
- Ajustada: `sender-secreto-vacio.test.ts` (su mock de `resend-api` ahora exporta `RESEND_SIMULADO_PRUEBA`).
- **Control rojo:** con `sender.ts` de `HEAD` los 2 casos de staging FALLAN y los 2 de llave ausente pasan; con el cambio, los 4 pasan.

## Cierre (por el diff)

- Vitest `lib/studio/newsletter` + `lib/studio/mail`: PASÓ (10 archivos, 92 pruebas).
- `tsc --noEmit`: PASÓ (exit 0).
- ESLint de archivos tocados: NO DISPONIBLE. `node_modules` compartido (junction al checkout principal) está dañado: `Cannot find module 'es-to-primitive/es2015'`. No lo reparé para no tocar el árbol de otras sesiones.
- `pnpm verify`: NO EJECUTADO (corrida pesada; requiere turno del Director General).
- Revisión de voseo: sin formas de voseo en lo escrito.

## Pendientes de esta tarea

- Correr ESLint de los 3 archivos cuando haya un `node_modules` sano.
- `pnpm verify` si el Director lo autoriza.

## FUERA DE ALCANCE DETECTADO

1. `node_modules` del checkout principal sin `es-to-primitive` (rompe ESLint para quien lo use).
2. `sendEmail` (`lib/studio/mail/send-email.ts:225`) descarta el `code` y guarda `error: "no_key"` también en staging; `mail-health` lo leerá como falta de llave. Propagar el `code` es tarea aparte.

## Impacto documental

Ninguno canónico. Graphify/Obsidian: NO DISPONIBLE en este worktree.

## Checklist

Listo: mensaje distinto, pruebas con control rojo, tsc, Vitest vecino, handoff.
Pendiente: ESLint, `pnpm verify`, revisión y merge por el Director.
