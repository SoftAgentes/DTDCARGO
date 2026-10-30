---
sdd: "0588"
title: "Actualizaciones de Chatwoot desde Studio (etapa E3 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E3» (Sam)"
created: 2026-10-30
updated: 2026-10-30
supersedes: null
superseded_by: null
related: ["0582", "0583", "0584", "0585"]
confidencialidad: interno
---

# SDD-0588 — Actualizaciones de Chatwoot desde Studio (E3)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E3 «Actualizaciones desde Studio»** (decisión H), pasos **3.1, 3.2 y 3.3** del [checklist](../0582-chatwoot-piloto/checklist.md). El paso **3.4** (análisis con IA del diff de versiones) **no entra**: espera el OK de Sam sobre el motor.

## Contexto

- Chatwoot `v4.19.1-ce` corre en el VPS desde el 2026-10-29 ([SDD-0583](../0583-chatwoot-vps-e1/spec.md)), fijado por etiqueta y digest.
- DTD le monta dos initializers propios en solo lectura: la **redacción de logs** (paso 1.7) y el **candado de `/register` y `/deregister`** (paso 4.2, [SDD-0584](../0584-chatwoot-proteccion-register/spec.md), PR aparte, todavía no desplegado). Una subida mal hecha puede dejarlos **sin efecto en silencio**: el candado protege el número de WhatsApp que se comparte con Kommo.
- Pedido de Sam (respuesta 5 de la 0582): «un botón en Studio que muestre qué implica cada versión, con análisis por IA». El análisis es el 3.4; esta SDD entrega el aviso, la pantalla y el procedimiento.

## Alcance

| Paso | Entrega |
|---|---|
| 3.1 | [Runbook de versiones](../../runbooks/chatwoot-versiones.md): RPO/RTO, ventana, drenaje de Sidekiq, respaldo conjunto en el momento, prueba en copia, paso a producción, smoke S1–S10 y recuperación del tráfico. Comprobación explícita de los dos initializers, por línea de arranque **y** por comportamiento |
| 3.2 | Vigilante: cron diario `/api/cron/chatwoot-versiones` que compara `GET https://chat.dtdcargo.com/api` con los releases públicos de `chatwoot/chatwoot` y guarda la revisión en `chatwoot_version_checks` (0507). Avisa por push a los admins una vez por versión nueva |
| 3.3 | Pantalla **Administración › Actualizaciones** (`/studio/admin/actualizaciones`), solo para admin: versión instalada, disponible, notas de cada versión pendiente, «Revisar ahora» y «Pedir actualización», que guarda un registro en `chatwoot_update_requests` (0507) y **no despliega nada** |

**Fuera:** el análisis con IA (3.4), cualquier cambio en el VPS, en Meta o en el Chatwoot vivo, y subir de versión de verdad (cada subida es su propia tarea con OK nominal).

## Decisiones

| ID | Decisión | Por qué |
|---|---|---|
| E3-D1 | **El pedido es un registro, no un despliegue.** «Pedir actualización» inserta una fila y lo dice en pantalla; nada en Studio tiene credenciales del VPS | Decisión H: el análisis «solo informa», y la puerta de despliegue de la 0582 es un OK nominal de Sam |
| E3-D2 | **Un pedido por versión destino y tenant** (`unique (tenant_id, to_version)`). Pedir otra vez la misma responde «ya pedida» | El registro es para el Director y Sam; repetirlo no agrega información |
| E3-D3 | **El vigilante solo lee fuentes públicas sin credenciales:** `/api` de Chatwoot (pública) y la API de releases de GitHub sin token. Una revisión al día; «Revisar ahora» reutiliza una de menos de 10 min | GitHub admite 60 pedidos por hora por IP sin token; no hace falta un secreto nuevo |
| E3-D4 | **Sin datos personales en las revisiones.** Las notas de Chatwoot nombran a quien contribuye (`by @usuario in …`, «New Contributors»); se quitan antes de guardar, igual que todo HTML crudo (etiquetas y comentarios). Las notas se muestran como **texto plano**, y el enlace solo si apunta a `github.com/chatwoot/chatwoot/releases/` | revisar-datos-ve (§ abajo); contenido de un tercero |
| E3-D5 | **Aviso una vez por versión:** el push sale solo si la última revisión **sin error** no mostraba esa misma versión. Un error de lectura no avisa: un `/api` caído ya lo avisa Uptime Kuma | Evitar ruido sin perder el aviso |
| E3-D6 | **Escribe solo service_role** en `chatwoot_version_checks`; el admin solo lee. Los pedidos los crea el admin con su propio cliente (RLS: admin, su tenant, `requested_by = auth.uid()`, revisión citada visible) | Que nadie pueda fabricar una «versión disponible» desde Studio |
| E3-D7 | **Navegación de una línea:** una sección más en Administración (grupo PRO), con `requireModuleView("admin")` en el layout y `requireRole("admin")` en cada acción | Pedido del Director para minimizar conflictos con E2 y E6.3 |
| E3-D8 | **Comprobación de los initializers por comportamiento** (runbook §4 y S2–S5): controles en rojo de `ensayo-local.sh` (A1) y `prueba-register.sh` (C), dueño del método interceptado y sonda de redacción. La línea «activa» del arranque no basta | Un método renombrado deja el candado cargado pero inútil |

## Migración 0507 (NO APLICADA)

`supabase/migrations/0507_chatwoot_versiones.sql`, declarada en `migrations-baseline.json › pendingBelowCutoff`. Número **asignado por el Director** el 2026-10-30, comprobado contra todas las ramas y worktrees (la más alta ocupada era la 0506). Contrato `supabase/tests/0507_chatwoot_versiones.test.sql` (26 aserciones) en `lib/studio/__tests__/chatwoot-versiones.migration.test.ts`: contrato verde, control rojo, 9 mutantes que caen en su aserción y preflight de reaplicación.

Sin la 0507, todo degrada sin romper: el cron responde `omitido`, la pantalla dice «Todavía no hay revisiones» y «Pedir actualización» responde un error traducido.

## Criterios de aceptación

- [x] **3.1** Runbook con RPO/RTO, ventana, drenaje, respaldo conjunto, prueba en copia, producción, smoke y recuperación del tráfico; comprobación explícita del candado de `/register` y de la redacción de logs en §4 y S2–S5.
- [x] **3.2** El cron compara `/api` con los releases, guarda la revisión sin datos personales y avisa una vez por versión nueva (pruebas puras, de fuentes, del vigilante con doble que filtra y de la ruta).
- [x] **3.3** Pantalla solo admin con versión instalada, disponible, notas y «Pedir actualización» que deja registro y no despliega; `/ui-check` pasado (3 ajustes aplicados: `--ink-mute` como texto → `--ink-soft`, notas en `--f-sans`, alineación del icono sin px sueltos).
- [ ] `pnpm verify` en el turno que asigne el Director.
- [x] Cron registrado en `vercel.json` (13:15 UTC) y el crontab regenerado sobre la punta de `codex/0582-e2-poc` del 2026-10-30 (`c1d081b3b`).

## Privacidad (revisar-datos-ve)

| Dato | Dónde | Base y minimización |
|---|---|---|
| Versión instalada y publicada, notas de releases | `chatwoot_version_checks` | Datos técnicos públicos. Se quitan las menciones a personas (E3-D4); retención de 180 días |
| uuid de quien pide | `chatwoot_update_requests.requested_by` | Trazabilidad interna de una decisión operativa. Solo el uuid; sin nombre ni correo; `on delete set null` |

Nada de lo que sale a la red lleva datos de DTD: el pedido a GitHub no tiene parámetros propios y el de `/api` no lleva credenciales.
