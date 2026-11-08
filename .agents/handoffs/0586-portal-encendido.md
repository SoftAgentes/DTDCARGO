# Handoff · SDD-0586 paso 10.5 — guion de encendido de `chatwoot_portal`, preparado y sin correr

- **Owner:** Claude Worker «10.5», en la sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), que coordina con el Director General.
- **Claim:** `worker-10.5-encendido`.
- **Ruta y rama:** `DTD-worktrees/0586-portal-encendido`, rama `codex/0586-portal-encendido`, desde `main` en `efd7e70f6` (la #434 fusionada).
- **Pedido:** el DG, comunicado por el Subdirector el 2026-11-08. Sam le dio un OK amplio y el DG fijó el orden: publicar la web, encender `chatwoot_portal` (prueba con punta a punta y después producción) y la 0518. Esto es el guion del paso 2, **sin encender nada**.

## Lo hecho

`docs/runbooks/chatwoot-portal-encendido.md`:

- condiciones previas (0519 y 0520 aplicadas; **T1 a T4 todavía no están en `main`**; la vía del atascado; la web publicada);
- qué hace falta por entorno;
- los comandos exactos (corte, encender y apagar el flag por tenant, comprobarlo, y conteos sin PII);
- la punta a punta en prueba, en 13 filas: ida, vuelta, adjunto, destrabar, salud y apagar o encender;
- producción, vuelta atrás y evidencia;
- la lista de lo que queda **⛔ FUERA DEL OK DE HOY**.

Hechos medidos en el código para escribirlo:

- el flag lo cambia solo un platform admin (policy `feature_flags_platform_admin_update`, 0355);
- `listFeatureFlags` no tiene caché;
- el crontab corre `chatwoot-reintentos` cada 5 min (`infra/dtd-cargo/cron/crontab:26`);
- prueba usa la cuenta 2 del mismo Chatwoot (`docs/runbooks/chatwoot-bandeja.md`);
- Conversaciones de Studio todavía no tiene la puerta de solo lectura: no hay ningún `chatwoot_portal` en `app/studio/(app)/conversaciones`.

## Decisiones y riesgos para el DG (I)

- **Encender antes de la 1c:** Studio todavía deja responder. Esas respuestas no van a Chatwoot. Tampoco hay tarjeta del CRM, ni estado, ni conciliación, ni modo de respaldo. El guion lo dice y pide responder solo desde la Bandeja.
- **El corte sin P4 en producción:** deja fuera los 24 hilos y 73 mensajes que Sam eligió cargar. Es una decisión con su OK, y además es escribir en la base.

## FUERA DE ALCANCE DETECTADO

- La PR de T1 a T4 la tiene la hija del correo (no se duplica).
- La PR 2 (P4, la carga) no está escrita.
- La 1c no está escrita.

## Estado

En curso: PR de docs en borrador. Se corre con los OK nominales que el guion marca.
