# Handoff · SDD-0648 · CRM › Embudos compactos

- **Owner:** Worker CRM Embudos (sesión local_ff4cf9f4…, claim `local-0648-crm-embudos`)
- **Ruta:** `DTD-worktrees/0648-crm-embudos-compactos` · **Rama:** `codex/0648-crm-embudos-compactos` desde `origin/main` cb199c4a7
- **SDD:** `docs/specs/0648-crm-embudos-compactos/spec.md`. Número asignado por el Director General; reserva en `refs/dtd/reservations/0648` y `codex/sdd-reserve-0648-crm-embudos-compactos` (local, sin publicar).
- **Permisos:** PR contra main al terminar, sin fusionar. Nada de producción, VPS ni migraciones.

## Objetivo

Tarjeta compacta, logo por canal, ancho completo, vista Lista y chat a pantalla completa (D1–D7 de la spec).

## Estado

- [x] Spec con D1–D6 literales, D7 y allowlist.
- [x] Código: `crm-canal.ts`, `crm-chat.ts`, `CanalLogo`, tarjeta con `ActionMenu`, `CrmVistaEmbudo` (Tablero/Lista), `CrmEmbudosLista`, ruta `/studio/crm/chat/[tarjetaId]`, «← Volver al embudo» en la Bandeja, «Abrir chat» en la ficha, ancho completo con `.studio-content:has([data-ancho-completo])`, excepción D1 en BRAND.
- [ ] Pruebas: NO EJECUTADAS. El worktree no tiene `node_modules` y el de main quedó roto (incidente del 2026-11-16, 17:30, causado por esta sesión al correr `pnpm sdd:next` en main). Hace falta el `pnpm install` del Director General y luego turno de PC.
- [ ] `/ui-check` sobre el diff, capturas antes/después y PR.

## Coordinación

- Sesión «CRM: filtros Leads, Leads con código y Clientes» (local_4f181d38) es dueña de `crm-tablero.ts`, `crm-tablero-queries.ts` y `CrmEmbudosClient.tsx` (salvo el bloque que monta el tablero). Aquí se tocaron hunks mínimos en esos archivos y en `CrmEmbudosClient.test.tsx` (dos pruebas pasan del `<select>` al menú). Correr `git merge-tree` contra su rama antes de publicar.

## Pendientes de esta tarea

- D8 (la ficha no se cierra con un clic fuera): pregunta abierta a Sam; no implementada.
- Verificar en navegador que `:has()` levanta el tope solo en Embudos.

## FUERA DE ALCANCE DETECTADO

- El `node_modules` del checkout principal está junction-eado con `retira-espera-0548`: un `pnpm` en cualquiera de los dos borra los paquetes del otro.
- Lista propia de conversaciones (D5) y TikTok como fuente propia (D4, migración).
