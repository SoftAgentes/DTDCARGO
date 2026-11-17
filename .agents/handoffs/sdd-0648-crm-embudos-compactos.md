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
- [x] Pruebas, typecheck, eslint y gates de docs: PASÓ con el turno del DG (detalle en «Validación» de la spec).
- [x] `/ui-check`: hecho, y Sam aprobó aplicar los tres hallazgos; aplicados (nombre como objetivo de 32 px, espaciado en escala, `nowrap` en Canal). Su vitest/typecheck corre en CI.
- [ ] Capturas antes/después: NO EJECUTADAS. Por orden del DG, el Preview no se usa (comparte base con producción); el DG despliega en prueba.dtdcargo.com tras la revisión.
- [x] PR en borrador contra main; va después de la #621.

## Coordinación

- Sesión «CRM: filtros Leads, Leads con código y Clientes» (local_4f181d38) es dueña de `crm-tablero.ts`, `crm-tablero-queries.ts` y `CrmEmbudosClient.tsx` (salvo el bloque que monta el tablero). Aquí se tocaron hunks mínimos en esos archivos y en `CrmEmbudosClient.test.tsx` (dos pruebas pasan del `<select>` al menú). Correr `git merge-tree` contra su rama antes de publicar.

## Pendientes de esta tarea

- D8 (la ficha no se cierra con un clic fuera): pregunta abierta a Sam; no implementada.
- Verificar en navegador que `:has()` levanta el tope solo en Embudos.

## FUERA DE ALCANCE DETECTADO

- El `node_modules` del checkout principal está junction-eado con `retira-espera-0548`: un `pnpm` en cualquiera de los dos borra los paquetes del otro.
- Lista propia de conversaciones (D5) y TikTok como fuente propia (D4, migración).

## Revisión independiente (2026-11-17)

- Sin fugas de seguridad. Cambios pedidos y hechos: «Abrir chat» y «Conversaciones» solo con `puedeAbrirBandeja` (rol `bandeja` + flag `chatwoot_inbox`); «Conversaciones» pasa de `KommoClient` a Embudos, junto a Tablero | Lista; la ruta del chat manda a `/studio/dashboard?denied=kommo` sin CRM y a `?chat=sin_bandeja` sin Bandeja; pruebas nuevas de `CrmVistaEmbudo` y de la ruta; la #621 traída en `ebc71fc69`.
- Pruebas de esta ronda: NO EJECUTADAS en la PC (orden del DG); el portón es CI.

## CI rojo y merge con la SDD-0655 (2026-11-17)

- CI en `3103801e3` FALLÓ en `claridad-t5d-contract.test.ts` (SDD-0603 5d): el contrato exige «Abrir ›» (`studio-btn-ghost sm`) como parada de teclado y el nombre con `tabIndex={-1}`. Se restituyó sin tocar el contrato; el nombre conserva su zona de 32 px para el ratón.
- main trajo la #621 y la SDD-0655 (Bandeja como pestaña del CRM). Conflictos en `BandejaClient.tsx`, `bandeja/page.tsx`, `KommoClient.tsx` y `studio.css`: se tomó main en los tres primeros (más el ancho de Embudos en `KommoClient`) y se conservaron los dos bloques de CSS. Se retiran el enlace «Conversaciones», `?volver=crm`, «← Volver al embudo» y sus textos i18n: la pestaña Bandeja los reemplaza. `puedeAbrirBandeja` usa `accesoCrm` de la 0655.

