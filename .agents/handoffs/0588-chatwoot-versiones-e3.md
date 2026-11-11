# Handoff — SDD-0588, etapa E3 del programa SDD-0582 (pasos 3.1 a 3.4)

- **Fecha:** 2026-10-30
- **Worker:** Claude, owner `local_e3-versiones` (sesión iniciada por el Director `local_535053f4…`)
- **Rama:** `codex/0582-e3-versiones`, en el worktree `.claude/worktrees/sad-kowalevski-241d34`
- **Base:** apilada sobre `codex/0582-e2-poc`; mergeada su punta `c1d081b3b` (2026-10-30) antes de registrar el cron
- **Reserva:** SDD-0588, local: `refs/heads/codex/sdd-reserve-0588-chatwoot-versiones-e3` en `74b81928`. El stub no se integra; la spec real vive en esta rama
- **Migraciones:** **0507** (asignada por el Director el 2026-10-30) y **0509** (3.4). **0509 tomada por E3 y confirmada por el Director el 2026-10-30**: no estaba asignada (el Director había pedido la 0508 libre para E9 y E2 la tomó), y él la revisó en todas las ramas. Las dos **NO APLICADAS**, declaradas en `migrations-baseline.json › pendingBelowCutoff`

## OBJETIVO ORIGINAL

E3 «Actualizaciones desde Studio»: 3.1 runbook de versiones, 3.2 vigilante de versiones y 3.3 pantalla «Actualizaciones» solo para admin, con «Pedir actualización», que deja un registro y no despliega nada. El 3.4 (IA) quedó fuera hasta que Sam eligió el motor. El 2026-10-30, por selector, eligió «GLM de la oficina (Recomendado)», y el Director lo encargó con este alcance: paquete solo de código, informe por pieza propia con «seguro / revisar / no actualizar», llave propia del servidor, topes, timeout, respaldo sin IA, doble del motor y prueba negativa de secretos. Nada en el VPS de agentes ni en la oficina.

## COMPLETADO

| Paso | Entrega | Estado en el checklist |
|---|---|---|
| 3.1 | [`docs/runbooks/chatwoot-versiones.md`](../../docs/runbooks/chatwoot-versiones.md): RPO 0 mensajes / RTO ≤ 30 min, ventana de 21:00 a 23:00 en Caracas, de lunes a jueves, drenaje de Sidekiq (TSTP), respaldo conjunto en el momento, prueba en copia (`chatwoot-ensayo`), smoke S1–S10, recuperación del tráfico (Sidekiq, reintentos de Meta, reconciliación de Studio) y vuelta atrás a/b/c. Ampliado el 2026-10-30 a pedido del Director con el tercer initializer, `zz_dtd_revocar_sesiones.rb` (paso 2.7 de E2, texto tomado de su handoff 0585): fila en «Pieza propia», corrida `prueba-revocar-sesiones.sh` en §4 con su control C1 en rojo, y S6–S7 en el smoke, que pasa a S1–S12 | aceptado (2026-10-30); ampliación sin aceptar todavía |
| 3.2 | `lib/studio/chatwoot/versiones{,-fuentes,-queries,-vigilante}.ts` y el cron `/api/cron/chatwoot-versiones` (13:15 UTC), registrado en `vercel.json` con el crontab regenerado. Guarda en `chatwoot_version_checks`; avisa por push a los admins una vez por versión | aceptado (2026-10-30) |
| 3.3 | `/studio/admin/actualizaciones` (layout `requireModuleView("admin")`, acciones con `tenantAdminGate`): instalada, publicada, notas en texto plano, «Revisar ahora» y «Pedir actualización» → `chatwoot_update_requests`. Entrada: **una línea** en `admin/page.tsx` (grupo PRO) | aceptado (2026-10-30) |
| 3.4 | «Analizar con IA» en `/studio/admin/actualizaciones`. Archivos: `lib/studio/chatwoot/analisis.ts` (paquete, cortes, prompt, lectura de la respuesta e informe sin IA), `analisis-superficie.ts` (lee del disco la superficie de DTD; en producción viaja por `outputFileTracingIncludes`), `analisis-motor.ts` (diff de GitHub, llamada a GLM, caché, tope y uno a la vez) y `analisis-queries.ts`. La acción `analizarConIa` solo analiza el salto pendiente. Guarda en `chatwoot_version_analyses` (0509). Llave en `DTD_CHATWOOT_IA_GLM_KEY`, declarada vacía en los dos `.env.example` | entregado |

**Initializers de DTD en el runbook.** El candado de `/register` y la redacción de logs se comprueban así:
- en el ensayo local, con los controles en rojo: A1 de `ensayo-local.sh` y C de `prueba-register.sh`;
- tras subir, por la línea de arranque (S2, S4);
- por comportamiento: el dueño del método interceptado y `HTTParty::Request.ancestors` (S3), y una sonda de redacción (S5).

El candado vive en la PR de 4.2 (SDD-0584), todavía sin desplegar. Mientras no lo esté, S2 y S3 se registran como NO APLICA.

**Decisiones:** E3-D1 a E3-D14 (las del 3.4 son E3-D9 a E3-D14, con la tabla de IA-01 y la allowlist), en la [spec](../../docs/specs/0588-chatwoot-versiones-e3/spec.md).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| PGlite de la 0507 (`chatwoot-versiones.migration.test.ts`) | PASÓ 13/13: contrato de 26 aserciones, control rojo, 9 mutantes, preflight y declaración |
| Vigilante, fuentes, ruta, acciones y panel | PASÓ (32 + 18) |
| Mutantes manuales del vigilante: `sinError` fuera y limpieza de `@usuario` fuera | los dos mueren |
| `rbac-actions-guard` (inventario 78 → 79 archivos, 450 → 452 acciones) | PASÓ 457/457 |
| `build-crontab --check` y su prueba (22 crons) | PASÓ |
| `tsc --noEmit` del proyecto | PASÓ (antes del merge de E2) |
| ESLint de los archivos nuevos | PASÓ, 0 avisos |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `check-pending-migration-symbols` | 0507 declarada en AMARILLO. **El gate sale ROJO tras el merge de E2 por una declaración de E2** (ver FUERA DE ALCANCE) |
| `/ui-check` | OK con ajustes menores; aplicados 3 (`--ink-mute` como texto → `--ink-soft`, notas en `--f-sans`, alineación sin px) |
| Pantalla en el navegador | **NO EJECUTADO**: necesita sesión de Studio con datos y la 0507 aplicada en una base local; cubierto por las pruebas del panel |
| `pnpm verify` (2026-10-30 16:03–17:07Z, sobre `b9e1e3e54`, a pedido de Sam: «Corre verify ya»; sin otro verify vivo al arrancar) | **FALLÓ** (exit 1): 14 de 17 pasos corrieron. **PASÓ:** lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check y build. **FALLÓ:** harness, test, pending-migration-symbols y e2e (detalle abajo). **NO DISPONIBLE:** migrations-applied (sin `.env.local` en el worktree), sql-tests y schema-rebuild (sin Docker) |
| **3.4** · pruebas del análisis y de las acciones (`analisis.test.ts` 19, `analisis-superficie.test.ts` 7, `analisis-motor.test.ts` 18, `actions.test.ts` 14) | PASÓ 58/58, con doble del motor GLM y de GitHub. La prueba negativa arma el paquete con `.env`, `.env.example`, `secretos/`, un initializer y un diff con llaves, y valores reales en `process.env`; ninguno llega al mensaje del motor. El lector de superficie se prueba sobre un árbol trampa y sobre el repo real (0 archivos descartados por secreto) |
| **3.4** · panel (`ActualizacionesPanel.test.tsx`) | PASÓ 15/15 (6 nuevas: botón, tope, informe con IA y sin IA, «no actualizar» y texto plano) |
| **3.4** · mutantes de código (`mutantes-34.cjs` en el scratchpad, uno por vez, restaurando el archivo en `finally`) | 20 de 21 MUERTOS; control sin mutar 58/58 antes y después. Sobrevivía M10 (`sinDiff ||` en la recomendación sin IA): sin diff todas las piezas ya quedan en «medio», así que era código de más y se quitó |
| **3.4** · PGlite de la 0509 (`chatwoot-analisis.migration.test.ts`) | PASÓ 14/14: contrato de 21 aserciones, control rojo, 9 mutantes, preflight de reaplicación y preflight sin la 0507 |
| **3.4** · `rbac-actions-guard` (452 → 453 acciones), `next-config`, `build-crontab`, `versiones*` | PASÓ (458, 24, 11 y 27) |
| **3.4** · `tsc --noEmit`, ESLint de los archivos tocados y `check-pending-migration-symbols` | PASÓ; 0 avisos; 0 ROJO, 8 AMARILLO (la 0509 declarada con 5 evidencias y las líneas de `actions.ts` resincronizadas) |
| **3.4** · `/ui-check` del panel | Revisión en línea con la rúbrica: tokens `var(--*)`, `Badge` con texto para recomendación y riesgo, `ActionButton` ghost (el primario sigue siendo «Pedir actualización»), rutas en mono, sin HTML del motor. Sin hallazgos que corregir |
| **3.4** · llamada real a Z.AI | **NO EJECUTADO**: usar la llave real es una puerta de integración con OK de Sam. Endpoint por defecto: la API de pago `api.z.ai/api/paas/v4`; el del Coding Plan (`coding/paas/v4`) solo se usa si se configura a propósito. La respuesta real y el modelo `glm-4.6` quedan **NO VERIFICADOS** |
| `knowledge:status` | structural/semantic INVALID y Archify/Obsidian PENDING en este worktree; Graphify no corrido (lo publica el Director) |

### Los 4 rojos del verify

| Paso | Causa | Estado |
|---|---|---|
| harness | `scripts/tests/verify-e2e-sin-supabase.node.mjs`: `e2e/ficha-chat.spec.ts` (paso 2.6 de E2) no estaba en el inventario | **Rojo heredado del 2.6, corregido en `850a6ff91`.** Tras hacer merge de E2 `5451c818d`: la prueba del script PASÓ 15/15 |
| pending-migration-symbols | Declaración de E2 `BandejaBadge.tsx:19` vencida | Corregida por E2 en `5451c818d` (19→21). Tras el merge: 0 ROJO, 6 AMARILLO declarados (la 0507 entre ellos) |
| test | 1.ª corrida: `infra/ops/tests/migraciones.test.mjs` › `prueba-migraciones-produccion.sh` cortado a los 600 s. Reintento: 13.600 pruebas pasaron, pero quedaron 2 «Failed to start forks worker» (`app/p/[token]/…`), falta de RAM con 4 GB libres | Ambiental: ninguna prueba de E3 falló. Sin repetir (corrida pesada) |
| e2e | `e2e/sin-scroll-horizontal.spec.ts:119` (CTA de Shipping Mark → `/registro`, SDD-0580) excedió el `waitForURL` de 20 s en chromium en las dos corridas; en mobile-chrome, flaky | Ajeno al diff de E3 (sitio público). Sin repetir. FUERA DE ALCANCE |

### Verify completo del 3.4 — 2026-10-31 (09:26Z a 10:06Z, punta `b04e63abcca1c715817cb9cd30f0db5b9f0e3d76`, Docker 29.9.1)

Turno del Director (2026-10-31 09:25Z), que antes comprobó con `@()` que no había procesos pesados vivos y que `4579948d2` (punta de E2) es ancestro de la punta. La corrida cubre el 3.4 y el código de 2.7 y 2.8 de E2. Se lanzó con `corepack pnpm verify` desde la sesión, y esta vez el e2e sí encontró los navegadores. Log en el scratchpad de la sesión (`verify-b04e63a.log`, 15.330 líneas). Exit 1; 16 de 17 pasos corrieron.

| Comprobación | Resultado | Propio, heredado o de carga |
|---|---|---|
| harness, lint (0 errores), rsc-boundary, typecheck, edge-functions (4) | PASÓ | — |
| test | PASÓ: 933 archivos y 13.855 pruebas (1 omitida), en 660 s. Sin «Failed to start forks worker» ni timeouts | — |
| docs:check (568 specs), numbering, feature-constants (6), components:check, governance:check | PASÓ | — |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` | — |
| pending-migration-symbols | PASÓ: 0 ROJO · 8 AMARILLO (0507 y 0509 entre ellos) | — |
| sql-tests (Postgres en Docker) | FALLÓ: 251 contratos pasan y 3 fallan: `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_reverso_al_anular_factura_carrera` (el preflight de la 0497 sobre `excepcion_al_cierre_vigente(uuid)` no coincide). `0507_chatwoot_versiones` y `0509_chatwoot_version_analyses` **pasan** | **Heredado** (SDD-0573, el mismo trío que en el verify del 2.7) |
| schema-rebuild | PASÓ: 496 migraciones (478 aplicadas y 18 solo de ledger), aislamiento de 219 tablas | — |
| e2e (249 casos, 8 workers, 5,9 min) | FALLÓ: 228 PASÓ, 20 omitidas y 1 FALLÓ: `e2e/sin-scroll-horizontal.spec.ts:119` en chromium (CTA de Shipping Mark → `/registro`, `waitForURL` de 20 s, también en el reintento). Dos casos pasaron en el reintento: `company-photo-carousel` y `calculadora-semantic-colors`. `e2e/ficha-chat.spec.ts` PASÓ en chromium, mobile-chrome y mobile-safari | **Heredado** (Shipping Mark, sitio público, el mismo rojo del verify del 2.7) |
| build de producción | PASÓ; `tsconfig.json` restaurado | — |

No hubo rojos de carga, así que no hizo falta re-correr nada aislado.

Después del merge de `5451c818d` también pasaron: `build-crontab --check` (22 crons de `vercel.json`) y 532 pruebas (las de E3, RBAC y crontab).

## COMMITS

`18e4383a7` spec + runbook (3.1) · `9c2b0619e` vigilante + 0507 (3.2) · `3e6fae7e5` pantalla (3.3) · `ce6ed41fa` checklist · `2a39aeca1` merge de E2 `c1d081b3b` · `8e1dc526b` cron registrado · (este handoff y la spec, en el commit siguiente).

## PR / BRANCH

`codex/0582-e3-versiones`, PR en borrador con base `codex/0582-e2-poc` (link en el reporte al Director).

## PENDIENTES DE ESTA TAREA

1. ~~`pnpm verify`~~: corrido, con los 4 rojos explicados arriba. El 3.4 entró a la cola de `pnpm verify` del Director, detrás del 2.7 de E2. La segunda corrida (2026-10-31, sobre `b04e63abc`) falló solo por rojos heredados: 3 contratos SQL de SDD-0573 y Shipping Mark. Sigue abierto hasta un verify verde, que depende de arreglar esos rojos ajenos.
2. ~~Confirmar la 0507~~: asignada por el Director. Pidió además guardar las notas sin HTML crudo: `limpiarNotas` quita etiquetas y comentarios (prueba más un mutante que muere).
3. ~~Aplicar la 0507~~: aplicada el 2026-11-04 a las 21:11:07Z por el Director General, con el mandato de Sam. Cierre al final de la spec.
5. ~~Aplicar la 0509~~: aplicada el 2026-11-04 a las 21:11:29Z, mismo mandato y mismo cierre.
8. **Decisión del motor (E3-D15), 2026-10-30:** «Solo GLM» y «US$50 al mes». Será una API key de pago de Z.AI aparte del plan de la oficina, con su propio tope, que crea Sam al arrancar. E7 usa el mismo proveedor y el mismo tope. Después, el Director pidió «No implementes el 3.4 todavía», cuando ya estaba publicado (`c2a91dcab`). Le pregunté si lo deja o lo saca, y respondió que **se queda** y que la fila 3.4 **entra a la cola de verify** detrás del 2.7 de E2. La URL por defecto ya es la de la API de pago (`api.z.ai/api/paas/v4`), con una prueba que lo fija; el Coding Plan solo entra si se configura a propósito.
6. Puerta de integración del 3.4: con OK de Sam, poner la llave en el entorno del servidor de Studio (`DTD_CHATWOOT_IA_GLM_KEY`, propia; no la variable de la oficina) y hacer una corrida real con la API key de pago (E3-D15). Sin la llave, el análisis sale «sin IA».
7. ~~Aceptación de Sam del 3.4~~: **aceptado** (Sam, 2026-10-31 (~10:15Z), en el chat del Director: «Acepto los 5 (Recomendado)». La pregunta cubría 2.7, 2.8, 3.4, 5.1 y 5.2 y decía que aceptar no fusiona ni despliega nada hasta el 1 de noviembre). Queda la aceptación de la ampliación del 3.1 (`zz_dtd_revocar_sesiones.rb`).
4. ~~Aceptación de Sam de 3.1 a 3.3~~: aceptados el 2026-10-30 («Acepto todo», a la pregunta del Director «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?»).

## FUERA DE ALCANCE DETECTADO

- **Declaración vencida de E2.** `sdd-0585-chatwoot-eventos` en `pending-migration-symbol-declarations.json` cita `app/studio/(app)/_components/BandejaBadge.tsx:19` y `chatwoot_conversations` en líneas que el commit `e626c8cab` (paso 2.6) movió: «if (n === 0) return null;» ahora está en la 21. En la punta de E2 (`c1d081b3b`) la declaración también dice `:19`, así que el gate sale ROJO allí igual. No lo toqué (archivo de E2).
- **`ensayo-local.sh` fija `4.19.1`** en C1 y tras restaurar: cada subida tiene que cambiarlo (anotado en el runbook §3 paso 4). Convendría parametrizarlo cuando se haga la primera subida.
- **Monitor «Chatwoot · versión» de Uptime Kuma** busca `"version":"4.19.1"`: se cambia en su UI después de cada subida (runbook §6).

## Impacto documental

- Canónicos nuevos: `docs/runbooks/chatwoot-versiones.md` y `docs/specs/0588-chatwoot-versiones-e3/spec.md`; el índice `docs/specs/README.md` está regenerado.
- 3.4: spec §«Paso 3.4» y §«Migración 0509»; runbook §3 paso 2 (el informe es un apoyo, no reemplaza el diff); fila de Z.AI en `docs/legal/privacidad/inventario-terceros.md` §2, entre los que no reciben datos personales.
- Checklist de la 0582: filas 3.1 a 3.3 en `aceptado` (2026-10-30) y 3.4 en `entregado`. En esta rama el avance pasa de 18,6 % a 21,6 % (25 ÷ 115,5), salida de `avance-checklist`.
- Graphify, Archify y Obsidian: pendientes para el Director desde la main integrada; aquí no se emitieron recibos.

## HANDOFF AL DIRECTOR

SDD-0588, pasos 3.1 a 3.4. 3.1 a 3.4 aceptados (3.4 el 2026-10-31). Migraciones 0507 y 0509 sin aplicar; la 0509 espera que el Director confirme el número. PR en borrador apilada sobre E2. Falta un `pnpm verify` verde (el del 2026-10-30 cayó por rojos ajenos) y la puerta de integración con la llave real de GLM.
